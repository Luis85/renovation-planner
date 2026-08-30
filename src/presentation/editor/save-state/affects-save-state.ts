import type { AppError, ErrorCategory } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { leftWritesBehind } from '../../../application/commands/DispatchOutcome';

/**
 * The categories whose refusals are raised BEFORE the repository is reached, and therefore
 * wrote nothing. Named rather than spelled inline at the comparison, because the docblock
 * below is an account of how each one got here and a `!==` chain gives it nothing to point at.
 */
const PRE_WRITE_CATEGORIES: readonly ErrorCategory[] = [
	'Validation',
	'Domain',
	'Reference',
	'Calculation',
];

/**
 * Is this failure one the save indicator should report?
 *
 * **Not every failed `Result` is a save error.** A refusal raised BEFORE the repository is
 * reached wrote NOTHING. Flipping the indicator for one would be wrong twice: it reports a
 * persistence failure that did not happen, and the user gets the inline field message they
 * need PLUS a "save error" badge about data exactly as safe as it was before they typed —
 * and per `save-state-store.ts` only a successful write clears that badge again.
 *
 * **Which categories those are is MEASURED, and this predicate has now measured wrong three
 * times — each time by looking only where it had already decided to look.** The first draft
 * compared against `'Validation'` alone, under a sentence asserting that "a field commit that
 * fails a domain rule resolves a `ValidationError`", which is false here. The second added
 * `'Domain'` and grepped for `'Domain'`, so `Reference` — the category the delete flow and both
 * reversible adapters refuse through — was never looked at, and every one of its refusals
 * settled a sticky `save-error` over data nothing had touched. The third enumerated
 * `Reference` exhaustively and left `Calculation` in the affecting set on the strength of one
 * sentence in `calculationError`'s own docblock, which turns out to describe its CALLER rather
 * than itself (see below); a calibration refused for coincident points left the same sticky
 * badge. Each pass measured the widening it had already chosen and nothing else. The set is
 * enumerated one category at a time now, which is the only form of this claim a later reader
 * can check.
 *
 * **`Validation`** — the entity's own rules, refused before any `save`.
 *
 * **`Domain`**, seven raise sites: four in `SetRequirementQuantityOverride.ts` (a negative
 * quantity outright, plus `withQuantityOverride`, `computeEstimatedCost` and
 * `withCalculatedCost` re-wrapped from the entity's own `Validation` errors), one in
 * `SetRequirementCostOverride.ts` (`withCostOverride`, the same re-wrap), and
 * `undo.before-execute` in both reversible override adapters, which is raised when there is
 * no snapshot to restore and so attempts no write at all. All of them precede their command's
 * `requirements.save`.
 *
 * **`Reference`**, nineteen raise sites spelling fourteen distinct codes — twelve through
 * `referenceError()` in `application/errors.ts` and seven as object literals — and every one
 * of them is a referent lookup that came back empty, read from the code rather than assumed:
 *
 * - the eight "not found" refusals that OPEN a command (`loadPlan`, `loadZone`,
 *   `loadRequirement`, `CreatePlan`, `CreateZone`, `AssignAsset`, `UpdateAsset`,
 *   `SetPlanBackground`), each before that command's first write. **`loadRequirement` has a
 *   NINTH caller that does not open anything, and the residual-exposure paragraph below is
 *   where it is accounted for**: `requirementResolutionSteps` calls it once per referent,
 *   inside a loop whose earlier iterations have already written;
 * - `zone.nothing-to-undo` in both reversible zone adapters and `requirement.not-found` in
 *   `ReversibleOverrideBase.execute`, all three raised with nothing recorded to write;
 * - `requirement.zone-not-found` and `requirement.asset-not-found` in
 *   `reversible-assign-asset-command.ts`'s `redoCreate`, which re-checks both entities
 *   before `requirements.save`. **Both were reached by a failed READ as well as by an absent
 *   referent until a review bot found it**, each check being one
 *   `isErr(x) || x.value === null` branch: a vault I/O fault arrived here wearing a
 *   `Reference` label, so `Persistence`'s safe default was bypassed by a relabel rather than
 *   by anyone deciding, and the sentence the user got asserted an entity was gone when the
 *   read had established nothing of the kind. The branches are split now and the read's own
 *   error is surfaced, so these two codes mean an absent referent and only that — which is
 *   what makes their place on this list true rather than merely stated;
 * - `reference.set-changed`, `reference.referents-exist`, `reference.entity-gone` and
 *   `reference.reassign-target-gone`, all four inside `deleteResolution.ts`'s `prepare` —
 *   the step that takes the locks and reads the pre-state, before `deleteEntity` or any
 *   Requirement write. `reference.set-changed`'s own message says "nothing was written".
 *
 * **`Calculation`**, twenty-two raise sites spelling twenty distinct codes — twelve as object
 * literals, six through `calculationError()` and four through `calibrationError()` — and
 * every one of them is a derivation refusing its own inputs, before whatever command asked
 * for the figures had written anything:
 *
 * - the eleven pure-function codes in `costPipeline.ts`, `quantityEngine.ts` and `Money.ts`.
 *   These write nothing by construction and surface through their caller, and both callers
 *   that can be dispatched (`AssignAsset.createAndSave` and
 *   `RecalculateRequirement.execute`) return them before their own `requirements.save`;
 * - `requirement.area-failed` in `AssignAsset.createAndSave`, and the six
 *   `calculationError()` codes in `RecalculateRequirement.execute` — every one of the six
 *   precedes that command's `requirements.save`, and nothing after that save can produce a
 *   `Calculation` error;
 * - `plan.degenerate-points` in `validateCalibration`, which is the sidecar READ path;
 * - the three `calibration.*` codes `deriveCalibration` mints plus `nonFiniteRescaleError`,
 *   all four raised in `ReversibleCalibratePlan.execute` before `geometry.write` — and
 *   nothing after that write can produce one either.
 *
 * **The trap in that category, which its own factory's docblock walks straight into.**
 * `calculationError` in `application/errors.ts` describes itself as "raised on the path
 * where the stale marker has already been persisted", which reads as post-write and is not:
 * it describes the CALLER's state — the cascade persists a stale marker and THEN asks for a
 * recalculation — not a write by the command raising it. The one place a `Calculation` error
 * could genuinely escape a half-written sequence is `deleteResolution.ts`'s inline
 * recalculation, and it cannot: a failure there is LOGGED and the sequence continues, because
 * `DeleteResolutionErrors` is `ReferenceError | RepositoryError` and has no room for one. So
 * the category is pre-write by the resolution's error union rather than by anything here, and
 * a later widening of that union is the change that would falsify this paragraph.
 *
 * That set is REACHABLE, not theoretical, and each widening was one keystroke or one click
 * away. The Inspector's two override fields are `type="text"` (`RequirementRow.vue`), so
 * typing `-5` into one raises the first `Domain` site. The Inspector's Delete button opens
 * `deleteZoneFlow.ts`, and confirming a dialog whose referent set moved underneath it raises
 * `reference.set-changed` — a refusal that states its own innocence in its message and still
 * left a persistent "Save error" badge standing behind it. Calibrating a plan with two clicks
 * at the same point raises `calibration.coincident-points`, and a zone whose polygon cannot be
 * measured raises `requirement.area-failed` on the next assignment.
 *
 * **A note on the INSTRUMENT, because measuring this category caught the repository's own
 * rule again.** The first sweep for the codes above used
 * `grep -rhoE "calculationError\(\s*'[^']*'"` and printed four of the six, silently missing
 * `requirement.unsupported-origin` and `requirement.unit-not-area` — both written with the
 * code on the line AFTER the call. "A grep for `foo(` misses `foo<T>(`" is in `CLAUDE.md`, and
 * it was broken here while measuring for the fix that quotes it. The counts above come from a
 * sweep that reads two lines past each call.
 *
 * **No category here is a synonym for "wrote nothing", which is why the carve-out exists.**
 * `versioning.ts` raises `revisionConflict` and `externalModification` as `ValidationError`s,
 * and both mean the OPPOSITE: the command reached the repository, the version had moved, and
 * the user's edit was refused and is gone. Reporting `saved` for one of those is the false
 * assurance this whole predicate exists to prevent. So the category is the first cut and the
 * write-boundary codes are carved back out of it, from the table `versioning.ts` exports
 * rather than from a copy. The carve-out applies to the whole pre-write set rather than to
 * `Validation` alone: nothing raises those two codes under `Domain`, `Reference` or
 * `Calculation` today, and a future site that did would fail toward reporting rather than
 * away.
 *
 * **The category comparison is TITLE case**, because `ErrorCategory` is
 * `'Domain' | 'Validation' | 'Persistence' | 'Geometry' | 'Import' | 'Migration' |
 * 'Reference' | 'Calculation'`. A lowercase literal here does not merely fail to match — it
 * fails to compile, and an earlier draft's tests hid that by casting hand-built objects
 * through `unknown`. The annotation on `PRE_WRITE_CATEGORIES` is what keeps that true now
 * that the comparison is an array rather than a chain of `!==`.
 *
 * **Still an inequality against a named set rather than a list of the categories that count,
 * deliberately.** A new `AppError` category added by a later slice defaults to AFFECTING the
 * indicator, because "we might not have written your data" is the safe answer to give while
 * nobody has thought about it. The unsafe default is silence. **Four of the eight are in the
 * pre-write set now and four are not** (`Persistence`, `Geometry`, `Import`, `Migration`), and
 * a set that has grown to half the vocabulary is worth stopping at rather than letting grow
 * quietly. What remains outside it is the four categories whose whole subject IS the write —
 * two of them, `Import` and `Migration`, having no dispatched raise site at all today. The
 * further this widens the more the indicator depends on every enumerated raise site STAYING
 * pre-write, with nothing checking that; the next widening should be argued against that
 * rather than against the nuisance of a badge, and if a fifth is ever proposed the honest
 * answer is probably that the CATEGORY is the wrong axis and the command should report
 * whether it wrote. **That last sentence has since come true and is no longer a prediction**
 * — see the stamp below, which is the category axis being overruled by a report at the one
 * place a report was available.
 *
 * **The exposure this creates is the unsafe direction, and the part of it that was REACHABLE
 * is now closed by a report rather than by this predicate.** A `Domain`, `Validation`,
 * `Reference` or `Calculation` error raised AFTER a write had already landed would be
 * under-reported: the indicator settles `saved`, or reverts to what it read before the batch,
 * over data whose write half-completed. An earlier draft said "the sweeps above found NO such
 * site today" and named `deleteResolution.ts` as where one was "likeliest to appear" on the
 * strength of "today every `Reference` refusal in it is inside `prepare`". **Both halves were
 * false, and the second was false in the file the first pointed at** — the sweep looked at
 * `deleteResolution.ts` and stopped before `requirementResolutionSteps`, which is in the same
 * file and is the half that writes. The two shapes it holds:
 *
 * - `markStalePersisted` calls `requirements.markStale` — a WRITE — and then re-reads through
 *   `loadRequirement`, which raises `requirement.not-found` (`Reference`) if the note is gone
 *   by then. Strictly post-write, in one call, with no loop needed — and, because `applyAll`
 *   appends to `marker.progress` only after the step RETURNS, a write that no progress record
 *   holds and no compensation restores.
 * - `repointAndMarkStale` opens with `loadRequirement` and can refuse with the same code, or
 *   with the entity's own `repointedTo` refusal — pre-write for ITS requirement and post-write
 *   for every earlier iteration of `applyAll`'s loop, each of which has already saved. Those
 *   earlier writes ARE in `progress`, so `compensate` tries to restore them; when it cannot,
 *   the vault is left half-written.
 *
 * **Both are answered by `markUncompensated`, at the two places that actually know.**
 * `compensate` stamps when a restore refused (or when a completed write has no snapshot to
 * restore from), and `markStalePersisted` stamps its own re-read refusal, whose write is
 * invisible to that loop. `leftWritesBehind` is then the FIRST question this predicate asks,
 * ahead of the category cut, because it is the only input here that is a report rather than
 * an inference. A compensation that SUCCEEDS is deliberately not stamped: the vault is back at
 * its pre-state and neutral is the true answer there.
 *
 * **Why a stamp and not either of the two fixes this file previously rejected**, both of which
 * are still rightly rejected. Carving `requirement.not-found` out by CODE would put a sticky
 * "Save error" on an override of a Requirement somebody else deleted, which wrote nothing —
 * the code is genuinely pre-write at its other raise sites, so the code cannot be the axis.
 * Re-labelling the refusal's CATEGORY would change the sentence `toUserMessage` resolves for
 * it, which is slice 17's declared territory. The stamp does neither: `category`, `code` and
 * `message` are untouched, so every consumer that reads them reads what it read before.
 *
 * **What is still NOT covered, because a fix that reads wider than its check is this file's
 * own recurring defect.** The stamp closes the sites named above and nothing else. A
 * post-write refusal in a pre-write category ANYWHERE ELSE remains under-reported, and neither
 * linter nor the suite can notice a new one being added — the category axis cannot see a
 * write, which is the conclusion the paragraph above reaches from the other end, and the stamp
 * narrows that hole rather than closing the class. `recoverInterruptedSequences` runs its own
 * restore loop and stamps nothing; it is fire-and-forget at load and reaches no indicator, so
 * it is out of scope here rather than covered. The honest general fix is still the one the
 * paragraph above names: a dispatched command reporting whether it wrote, on both channels.
 * `DispatchOutcome` now does that for successes and this stamp does it for the failures that
 * were measured; the rest is unbuilt.
 *
 * **The deeper fix is at the raise sites and is not this slice's to make.** The override
 * commands LOSE information by re-labelling the domain entity's `Validation` errors as
 * `Domain`, and nothing downstream can recover what the label discarded. Changing a category
 * there also changes the sentence `toUserMessage` resolves for it, and error-to-surface
 * mapping is slice 17's declared territory — so slice 13 narrowed the predicate, added the
 * stamp above where a write was actually knowable, and left the commands alone.
 *
 * **Where this DOES derive from, and where it now has to agree.** It derives from
 * `WRITE_BOUNDARY_CODES` in `versioning.ts` — the one place those two codes are spelled —
 * and from nothing else. An earlier draft of this docblock said in the present tense that it
 * was "DERIVED from [slice 17's] table" and that "slice 17's no-double-reporting test is what
 * keeps the two in agreement": slice 17 did not exist, so there was no table to derive from
 * and no test to keep anything in agreement. `grep -rn "no-double-reporting" src tests`
 * printed exactly one line, and it was that sentence. It was rewritten in the FUTURE tense as
 * an obligation on whoever built the table.
 *
 * **Slice 17 landed and that obligation is discharged**, by
 * `tests/presentation/errors/saveStateAgreement.test.ts` — which is deliberately not a
 * derivation. The two answer different questions: `surfaceFor` decides WHICH CONTAINER a
 * failure belongs in, and at an `autosave-write` origin that is the save indicator for every
 * category; this predicate decides what the indicator then SAYS. The check asserts the seam
 * they share, so a build that stopped routing `autosave-write` to `save-state` would leave
 * this predicate colouring a widget nothing sends anything to.
 *
 * **What that check does NOT reach, so the word "agreed" is not read wider than it is**: it
 * holds the `autosave-write` row and the write-boundary carve-out, and it cannot see a
 * post-write refusal in a pre-write category at any site the `markUncompensated` stamp does
 * not cover. That residue is the paragraph above and is unchanged — narrowed by the stamp,
 * not closed, and still invisible to both linters and the suite.
 */
export function affectsSaveState(error: AppError): boolean {
	// Asked FIRST, because it is the only input here that is a report rather than an
	// inference: the code that performed the writes said they are still standing, and no
	// reading of the category can overturn that.
	if (leftWritesBehind(error)) return true;
	if (!PRE_WRITE_CATEGORIES.includes(error.category)) return true;
	return WRITE_BOUNDARY_CODES.some((suffix) => error.code.endsWith(`.${suffix}`));
}
