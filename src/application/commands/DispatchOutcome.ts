import { isErr, ok, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { EntityVersion } from '../ports/versioning';

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
 * **Four producers in three files** — `grep -rn "markUncompensated(" src/`, run in the edit that
 * wrote this: `deleteResolution.ts`'s `compensate` and its `markStalePersisted` re-read,
 * `SetAssetBackground.ts`'s failed calibration restore, and
 * `ReversibleAssetDesignCommands.ts`'s failed sidecar restore on a background undo. Each is
 * at a moment the vault is KNOWN to be half-written. A compensation that succeeds leaves the
 * vault at its pre-state and is deliberately NOT marked with this: neutral is the true answer
 * for the indicator, and `CompensatedWrite` below is how the LEDGER still hears of it.
 */
export interface UncompensatedWrite {
	readonly uncompensatedWrite: true;
}

/**
 * Stamp a refusal as having left writes behind. Returns a copy: the errors these sequences
 * carry are plain data (`AppError` is deliberately not a class), and mutating a caller's
 * value to record something about the caller's own failure is a second surprise on top of
 * the first.
 */
export function markUncompensated<TError extends AppError>(
	error: TError,
): TError & UncompensatedWrite {
	return { ...error, uncompensatedWrite: true };
}

/**
 * Did this refusal leave writes standing? Asked rather than spelled inline at the two call
 * sites, so `uncompensatedWrite` is a string in ONE place and a consumer cannot half-spell it
 * into a predicate that silently answers `false` forever.
 */
export function leftWritesBehind(error: AppError): boolean {
	return (error as Partial<UncompensatedWrite>).uncompensatedWrite === true;
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
