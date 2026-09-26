import { isErr, ok, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { EntityVersion } from '../ports/versioning';
import type { DiagnosticEntityKind } from '../ports/diagnostics';
import { activeWriteIncidentRegistry } from '../incidents/WriteIncidentRegistry';

/**
 * What a dispatched reversible gesture DID, beside whether it succeeded.
 *
 * **`ok` is not evidence that anything was written, and treating it as such shipped a false
 * assurance.** `UndoableCommand` used to resolve `Result<void, AppError>` under a docblock
 * arguing that "`CommandHistory` only ever needs to know whether a write succeeded, not what
 * it returned" — true of the stacks, which is all that existed when it was written, and false
 * of design slice 13's save indicator, whose whole subject is whether this Plan's data is
 * safely written. `SaveStateStore` states the rule categorically: only a write that actually
 * succeeded may clear a `save-error`. With `void` as the success type the tracker had to
 * INFER one from the other, and every successful no-op cleared a badge left by a real
 * persistence failure.
 *
 * There is no safe default for that inference, which is why this is a value and not a
 * convention. Reading every `ok` as a write is the defect above. Reading every `ok` as a
 * no-write is worse in the other direction — a genuine successful save would never clear the
 * badge, and the indicator would rest on `save-error` for the session.
 *
 * **Required rather than optional, deliberately.** A `void | 'no-write'` widening would have
 * changed two call sites and left every other `ok(undefined)` compiling, which makes this a
 * SELF-DECLARED property: the next command that writes nothing and forgets to say so would
 * reintroduce the same defect silently. As a required union every `ok(...)` in every adapter
 * is a build error until somebody decides, which is the same shape design slice 15 records
 * for adding a dialog kind — four of its five edits are build failures and only the last is
 * something the compiler cannot make you write.
 *
 * **The four no-write successes that exist today**, so the union has subjects rather than
 * only a rationale:
 *
 * - `ReversibleAssignAssetCommand.execute()` when the asset is already assigned to the zone.
 *   `AssignAssetCommand` returns `ok({ created: false })` from a read, having saved nothing.
 * - the same adapter's `undo()` when its recorded outcome is `'found'` — undo deletes only
 *   what execute created, so there is nothing to delete and nothing to write.
 * - `CommandHistory.undo()` on an empty undo stack, and `redo()` on an empty redo stack.
 *   Both resolve `ok` without reaching a command at all.
 *
 * The first is one click in the Inspector, which is what made this a P1 rather than a
 * curiosity.
 *
 * **What this does NOT model, and the distinction is the reason the union has two members
 * rather than a count.** It says whether a dispatch reached the vault, not how much it wrote
 * or which entities moved. A resolution that writes an entity and six Requirements is one
 * `'wrote'`, exactly like a single zone rename — the save indicator asks one question and
 * this answers that question. A consumer wanting more would be asking for something the
 * commands do not report either.
 *
 * It lives in `application/` because the commands PRODUCE it: the reversible adapters are
 * application code and may not import `presentation/`, where `UndoableCommand` itself lives
 * and satisfies this structurally.
 */
export type DispatchOutcome = 'wrote' | 'no-write';

/**
 * What a dispatch resolves to, on both channels — declared once beside the outcome it
 * carries.
 *
 * It was a private `type DispatchResult = Result<DispatchOutcome, AppError>` in SEVEN
 * places — four under `src/`, three under `tests/` — byte-identical in every one, plus
 * sixty-odd sites spelling the same thing inline. One line is under the clone detector's
 * floor, so nothing could see the copies at all.
 *
 * **`private-type-leak` showed two of the seven, and that is the lesson worth keeping.** The
 * rule reports an exported signature naming a private type, so it found the two aliases that
 * reached one and was silent about the five that did not. A static-analysis category is a
 * LENS, not a census: it answers the question it was written to ask, and the count it returns
 * is not the size of the thing it points at. The other five turned up only because clearing
 * those two meant grepping for the shape.
 *
 * Here rather than in `presentation/`, because `application/` may not import that layer and
 * the reversible adapters resolve the same shape.
 */
export type DispatchResult = Result<DispatchOutcome, AppError>;

/**
 * The same answer, plus the version the write actually produced — what a reversible adapter
 * needs and a plain dispatcher does not.
 *
 * **A UNION rather than an optional field, and that is the whole of why this type exists.**
 * The adapters used to learn the version by reading the port back after the command returned,
 * and a peer writing in the window between those two operations was recorded as this
 * gesture's: the undo then presented the PEER's version, matched the store, and restored the
 * pre-gesture document over their edit. The read-back helper's own header named that residue
 * and named this remedy — "only a version reported by the write itself closes that" — and
 * writing it down bought nothing, which is this repository's own "a documented residue reads
 * as surveyed ground" arriving in the file that wrote the sentence. That helper is gone with
 * the read it performed; `ReversibleAssetDesignCommands` records `ran.value.version` instead.
 *
 * A `version: EntityVersion | null` beside a free `outcome` would have left the pairing to a
 * convention: a caller could read `'wrote'` and find `null`, or record a version for a
 * dispatch that wrote nothing, and neither is a build error. Discriminating on `outcome` makes
 * "wrote, and here is what it produced" the only representable success that carries one.
 *
 * **`secondaryVersion` is OPTIONAL, and Task B7's `SetAssetBackground` is its first and only
 * writer.** Every design command but that one touches exactly one resource, so `version` alone
 * has always been the whole answer; `SetAssetBackground` writes the note AND clears the
 * sidecar's calibration in one gesture, and its adapter needs BOTH resulting versions to
 * restore either resource conditionally on undo — the exact reasoning above (a read-back would
 * reopen the peer-write window this type exists to close) applied to the SECOND resource a
 * two-write command touches. Every other command leaves it absent, and every other adapter
 * ignores it, which is what keeps this an addition rather than a second thing every caller has
 * to reason about.
 */
export type VersionedDispatch =
	| { readonly outcome: 'no-write' }
	| { readonly outcome: 'wrote'; readonly version: EntityVersion; readonly secondaryVersion?: EntityVersion };

export type VersionedDispatchResult = Result<VersionedDispatch, AppError>;

/**
 * The plain `execute` door, expressed as the versioned one with its extra fact dropped —
 * the shape `SetRequirementQuantityOverrideCommand.execute` already takes over its own
 * `executeWithVersion`.
 *
 * One function rather than eight copies of `if (!x.ok) return x; return ok(x.value.outcome)`,
 * so the eight design commands (five shape, height, calibrate, and Task B7's background)
 * cannot drift on what `execute` means, and so a ninth has one obvious thing to call.
 */
export async function plainDispatch(versioned: Promise<VersionedDispatchResult>): Promise<DispatchResult> {
	const done = await versioned;
	return isErr(done) ? done : ok(done.value.outcome);
}

/**
 * The same question on the OTHER channel of the same `Result`: a refusal that left writes
 * standing in the vault.
 *
 * **`DispatchOutcome` answers "did this dispatch write" for successes only, and the failure
 * channel needed the same answer for the same reason.** A `Result` carries an `AppError` and
 * nothing else when it fails, so slice 13's save indicator had to INFER the answer from the
 * error's category — pre-write categories neutral, everything else reported. That inference
 * is sound exactly while every raise site in those categories really is pre-write, and
 * `deleteResolution.ts` holds one that is not: `applyAll` writes a Requirement per referent,
 * and a refusal on the third has already saved the first two. A failing compensation then
 * leaves them standing, and the category axis reports the whole thing as `Reference` — which
 * `affectsSaveState` reads as "wrote nothing" and settles the indicator to `Saved` over a
 * half-written plan. The category cannot see a write; only the code that performed one can.
 *
 * **Additive, and that is the whole reason this shape was chosen over the two that were
 * rejected before it.** `affects-save-state.ts` turned down carving `requirement.not-found`
 * out by CODE (it is genuinely pre-write at its other raise sites, so the carve-out would
 * trade a false silence for a false badge on an override of a Requirement somebody else
 * deleted) and turned down re-labelling the refusal's CATEGORY (which changes the sentence
 * `toUserMessage` resolves for it, and error-to-surface mapping is slice 17's territory).
 * A flag beside the error changes neither: `category`, `code` and `message` are untouched, so
 * every consumer that reads them reads exactly what it read before, and the one consumer that
 * asks about persistence gets an answer nothing had to infer.
 *
 * **23 producers in 17 files, dated rather than trusted, because this count has already gone
 * stale FIVE times now — the fourth time inside the very edit that was fixing the third, and
 * this is the fifth.** BP-02 slice 2 task 2's own count paragraph said "23 lines … of which
 * that one is the self-count," naming exactly one self-match. That was already wrong the
 * moment it was written: the SAME edit added `AffectedEntityKind`'s docblock a few dozen lines
 * below, and that docblock quoted this identical grep pattern too, to explain how ITS
 * membership was measured — a second self-matching line the first paragraph never counted,
 * because a paragraph about an instrument counting itself did not re-check itself against its
 * own sibling. That produced "24 lines, 2 self-matches, 22 producers in 16 files," which then
 * went stale a fifth time when BP-02 slice 2 task 4 Part B added `relocateEvidence.ts` as a new
 * producer and left this paragraph unrun — exactly the failure mode this sentence already
 * warned about, landing again in the task named to fix a different, unrelated set of findings.
 * Re-run on 2026-09-16 (BP-02 slice 2 task 4 review-fix pass), `grep -rn "markUncompensated(" src/`
 * prints **25 lines**, of which **2 are self-matches** — this paragraph's own quoted pattern,
 * and one line in `AffectedEntityKind`'s docblock below that still quotes it to explain its own
 * measurement. 25 lines minus 2 self-matches is 23 producers; `relocateEvidence.ts` is a new
 * file with one producer, so producers now sit in 17 files, six of which spell two calls each.
 * An `import` of this function carries no `(` and is therefore not in the number. The number
 * first moved from 23 producers in 17 files to 22 in 16 earlier in the design-slice history,
 * because a pass NARROWED `project.write-uncompensated` (`ObsidianProjectRepository`) to stop
 * stamping at all — see the empty-folder paragraph below — and has now moved back to 23 in 17
 * for the unrelated reason of a new producer arriving, which is worth stating so a reader does
 * not mistake the coincidence of matching numbers for the count having been reverted.
 *
 * **The DEFINITION below is out of the number too, and NOT because anything excluded it.**
 * It is spelled `markUncompensated<TError extends AppError>(`, so the pattern's `(` never
 * meets it — this repository's own "a grep for `foo(` misses `foo<T>(`" hazard, landing in
 * our favour here by accident rather than by design. Stated because the next reader re-runs
 * the grep, notices the definition is missing from a count of producers, and "corrects" it
 * by widening the pattern to `markUncompensated` — which then matches the definition, the
 * imports and this docblock, and prints a number that is not producers at all.
 *
 * **No list of them is kept here**, and that is the correction rather than laziness. This
 * sentence said "four producers in three files" while five existed, then "five in four" while
 * seventeen did — off by more than 3x — and both times the ENUMERATION is what rotted first,
 * because a producer added in another file cannot edit a list that lives in this one. What is
 * durable is the RULE: each producer sits at a moment the vault is KNOWN to be half-written,
 * and the grep above is the census. Run it.
 *
 * **One member stretched that word and is DECIDED rather than stamped now**:
 * `project.write-uncompensated`'s residue is an EMPTY FOLDER — no note was written, so the
 * vault's data is coherent and "half-written" is true only of the folder tree. This paragraph
 * used to pose that as the question a later slice's gate would have to answer; ADR-0034
 * answers it: a later slice's gate is vault-WIDE (every guarded write pauses while any
 * incident record exists), so stamping this site would pause every unrelated write in the
 * vault over a stray folder nothing else depends on. `ObsidianProjectRepository`'s insert
 * keeps its existing log line (`project.insert-compensation-failed`, one per stranded
 * folder); it is the one raise site that does not call `markUncompensated` at all, and the
 * reason lives at that call site as well as here.
 *
 * The 2026-09-16 pass is the second stale-count repair and it moved the number itself: a sweep
 * of the repository layer found that five of its six compensation paths raised nothing at all
 * — `ObsidianZoneRepository.delete`, `ObsidianPlanRepository`'s `delete` and `insertNew`,
 * `trashNoteBackedEntity` and `ObsidianProjectRepository`'s insert — so a half-written vault
 * on any of them was recorded in a log line and nowhere a surface could see. A sixth turned up
 * beside them in `undoDeleteResolution.rollBack`, which is `deleteResolution.compensate`'s own
 * mirror and had been the one of that pair not stamping.
 *
 * A compensation that succeeds leaves the vault at its pre-state and is deliberately NOT
 * marked with this: neutral is the true answer for the indicator, and `CompensatedWrite` below
 * is how the LEDGER still hears of it. Every one of the six paths above carries a test for
 * that arm too, watched red against a build that stamped unconditionally.
 *
 * **BP-02 slice 2 task 2 widens the stamp from a bare `true` to the entities left standing**,
 * because a later task makes it durable and vault-scoped (ADR-0034) and a durable record that
 * cannot say WHICH files it is about is not evidence a user can act on. `AffectedEntity`
 * below is the shape; ADR-0034's identity ruling states why it is a best-effort SET rather
 * than a guaranteed-complete one, and why that incompleteness is acceptable: the set is
 * evidence for a person to read, never a predicate a gate evaluates.
 */
export interface UncompensatedWrite {
	readonly uncompensatedWrite: readonly AffectedEntity[];
}

/**
 * The closed vocabulary `AffectedEntity.entityKind` may name — an ALIAS of
 * `DiagnosticEntityKind` (`application/ports/diagnostics.ts`), not a parallel union with its
 * own membership.
 *
 * **It was a five-member union measured independently from the raise sites, and that was the
 * defect a review round found.** `noteEntityWrite.ts`'s `trashNoteBackedEntity` takes its kind
 * as a caller-supplied `DiagnosticEntityKind` — the wider, ten-member vocabulary
 * `DiagnosticsLedger.record` already uses — and stamped it here through `kind as
 * AffectedEntityKind`, a cast from the wider vocabulary to the narrower one. A future
 * `DiagnosticEntityKind` this build does not yet raise (`'project'`, `'trade'`, `'supplier'`,
 * `'quote'`, `'plan-geometry'`) would have compiled silently through that cast, defeating the
 * closed union's whole purpose: the type said "these five and no others" while the value
 * flowing into it was drawn from a wider set the type could not see. Making this an alias
 * removes the cast (`noteEntityWrite.ts`) rather than widen-then-narrow it, because the
 * two vocabularies were never actually different sets — both are ADR-0034's and SDD §68's
 * answer to "which entity kinds does this system hand to a content-free report," diagnostics
 * and this stamp being two readers of the same fact. The closure itself still lives at
 * `DiagnosticEntityKind`'s own declaration, unmoved.
 *
 * **What is ACTUALLY raised today, measured from every `markUncompensated(` raise site in
 * `src/` (the same grep the count above runs, read site by site) — kept here as prose because
 * it is real information, and it no longer needs its own narrower type to be true:**
 * `deleteResolution.ts` and `MaterialCommand.ts` name a `requirement`;
 * `reversible-delete-zone-command.ts` and `ObsidianZoneRepository.ts` name a `zone` (and, since
 * this task's threading, the `plan` whose sidecar shares the write); `RenovationCommand.ts`,
 * `StructureCommand.ts`, `GroupGeometryCommand.ts`, `ConfigurePlanReference.ts`,
 * `ConstructionMaterialCommand.ts`, `ObsidianPlanRepository.ts` and, since BP-02 slice 2 task 4
 * Part B, `relocateEvidence.ts` all name a `plan`;
 * `SetAssetBackground.ts` and `ReversibleAssetDesignCommands.ts` name an `asset`; and
 * `noteEntityWrite.ts`'s `trashNoteBackedEntity`'s three real callers pass
 * `'asset'` (`ObsidianAssetRepository.ts`), `'asset-price'`
 * (`ObsidianAssetPriceOverrideRepository.ts`) and `'requirement'`
 * (`ObsidianRequirementRepository.ts`) — of which only the asset caller's spec supplies the
 * `alsoRemove` this stamp's branch requires to be reached at all today. `'project'`, `'trade'`,
 * `'supplier'`, `'quote'` and `'plan-geometry'` are valid members of the alias and no current
 * raise site produces any of them.
 *
 * **What this instrument cannot see, now that the type is exactly as wide as
 * `DiagnosticEntityKind`**: nothing stops a future raise site from stamping any of the five
 * unused members above for a write that has nothing to do with diagnostics' existing use of
 * that kind — the alias buys "this is a real, spelled-correctly entity kind," not "this kind
 * is one this stamp has ever meant." That is weaker than the five-member union's claim used to
 * read, and it is the honest version of it: the five-member claim was never true once a cast
 * could feed it a sixth.
 */
export type AffectedEntityKind = DiagnosticEntityKind;

/**
 * One entity a refusal's raise site could name as left inconsistent. The pairing is the
 * codebase's own existing answer to "how do you disambiguate an id" — `SequenceMarker`
 * (`deleteResolution.ts`) already carries `entityId: string` beside `entityKind` under the
 * comment "an ID alone cannot say", and `WriteLedger` already proves a single collection can
 * hold ids from several kinds at the widest brand. Not a branded id: the raise sites bind
 * `ZoneId`, `PlanId`, `AssetId` and `RequirementId` interchangeably into this one shape, and a
 * branded union here would only relocate the widening each site already does.
 */
export interface AffectedEntity {
	/** Which repository would restore this entity — an ID alone cannot say. */
	readonly entityKind: AffectedEntityKind;
	readonly entityId: string;
}

/**
 * Stamp a refusal as having left writes behind, naming what it left, AND record it as a write
 * incident. Returns a copy: the errors these sequences carry are plain data (`AppError` is
 * deliberately not a class), and mutating a caller's value to record something about the
 * caller's own failure is a second surprise on top of the first.
 *
 * **Not side-effect-free, since owner ruling 13: this is the ONE place a stamp is recorded.** The
 * record used to be taken at two doors — `guardCommand` on a stamped result, and the host-rename
 * listener — so a stamp returning through `CommandHistory` over raw ports reached neither, and
 * six raise sites had such a path (`docs/releases/first-beta-readiness/11-q1-stamp-census.md`).
 * Recording where the stamp is MADE closes all of them by construction, and the doors record
 * nothing now, so one stamp is one incident whichever door it leaves by. The record goes into the
 * registry `activeWriteIncidentRegistry()` answers at stamp time — `void`ed, since `record`
 * appends to the in-memory list synchronously and resolves for every fault — and is a no-op when
 * none is installed (a caller composing without a session). A recorded stamp is DURABLE: it is
 * written to `write-incidents.json` and re-read at every load (ADR-0034, D-08), so it pauses
 * every guarded write in the vault across restarts until the user removes that file.
 *
 * Two consequences owner ruling 20 accepted, both pinned in
 * `tests/plugin/undoStampOnHealthyVault.test.ts`: a site that stamps an error already stamped
 * (a compensation over a stamped cause) records a SECOND incident, while a stamp crossing two
 * guarded doors is still one; and once a stamp lands mid-gesture the gate is shut, so a later
 * guarded step of the same gesture — its own compensation included — is refused.
 *
 * **What it cannot see**: a stamp built anywhere but here — `eslint.config.mjs`'s
 * `STAMP_CONSTRUCTION_BAN` refuses the literal spellings in `src/` and states the ones it cannot
 * see — and a stamp made when no registry is installed, which is lost; the keep-alive
 * (`WriteIncidentRegistry.hold`) is what keeps one installed across a teardown for the saves its
 * holders count.
 *
 * **`entities` is REQUIRED, not optional with a default.** An optional parameter would let a
 * new raise site inherit an empty list silently, which is indistinguishable from a site that
 * looked and genuinely found nothing to name — this way every call site DECIDES. An empty
 * array is itself a legal, meaningful argument (`leftWritesBehind` treats it as a presence
 * test, not an equality test) for the raise sites that provably cannot name what they left
 * standing — `undoDeleteResolution.ts`'s `rollBack` among them, commented at its own call.
 */
export function markUncompensated<TError extends AppError>(
	error: TError,
	entities: readonly AffectedEntity[],
): TError & UncompensatedWrite {
	const stamped = { ...error, uncompensatedWrite: entities };
	void activeWriteIncidentRegistry()?.record(stamped);
	return stamped;
}

/**
 * Did this refusal leave writes standing? Asked rather than spelled inline at the call sites,
 * so `uncompensatedWrite` is a string in ONE place and a consumer cannot half-spell it into a
 * predicate that silently answers `false` forever.
 *
 * **A PRESENCE test, not an equality test.** `markUncompensated` can be called with an empty
 * array — "half-written, and this site cannot name what" is still a stamp — so this asks
 * whether the field is an array at all, never whether it is non-empty. An error that was
 * never stamped carries no `uncompensatedWrite` field, so `Array.isArray` on `undefined`
 * answers `false` for it, same as before this task widened the field's type.
 */
export function leftWritesBehind(error: AppError): boolean {
	return Array.isArray((error as Partial<UncompensatedWrite>).uncompensatedWrite);
}

/**
 * The other outcome a compensation can have: it SUCCEEDED, and the resource it put back now
 * carries a version the dispatching history has to learn.
 *
 * `UncompensatedWrite` covers the compensation that refused. This covers the one that worked —
 * which is neutral for the save indicator (the vault is back at its pre-state) and is NOT
 * neutral for a `WriteLedger`: the compensating write was this history's own, dispatched by
 * the command it ran, and a ledger that never hears of it refuses the next undo below as a
 * revision conflict and reads the following gesture's pre-read as a foreign write. Measured:
 * a refused background pick left every earlier sidecar gesture un-undoable for the leaf's life.
 * A read-back by the adapter would reopen the peer window `VersionedDispatch` exists to close,
 * so the command that wrote reports it, on the failure channel, beside the refusal.
 */
export interface CompensatedWrite {
	readonly compensatedVersion: EntityVersion;
}

/** Stamp a refusal with the version its successful compensation produced. Returns a copy. */
export function markCompensated<TError extends AppError>(
	error: TError,
	version: EntityVersion,
): TError & CompensatedWrite {
	return { ...error, compensatedVersion: version };
}

/** The version a refusal's compensation produced, or `null` when it compensated nothing. */
export function compensatedVersionOf(error: AppError): EntityVersion | null {
	return (error as Partial<CompensatedWrite>).compensatedVersion ?? null;
}
