import type { AppError, ErrorCategory } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';

/**
 * The categories whose refusals are raised BEFORE the repository is reached, and therefore
 * wrote nothing. Named rather than spelled inline at the comparison, because the docblock
 * below is an account of how each one got here and a `!==` chain gives it nothing to point at.
 */
const PRE_WRITE_CATEGORIES: readonly ErrorCategory[] = ['Validation', 'Domain', 'Reference'];

/**
 * Is this failure one the save indicator should report?
 *
 * **Not every failed `Result` is a save error.** A refusal raised BEFORE the repository is
 * reached wrote NOTHING. Flipping the indicator for one would be wrong twice: it reports a
 * persistence failure that did not happen, and the user gets the inline field message they
 * need PLUS a "save error" badge about data exactly as safe as it was before they typed —
 * and per `save-state-store.ts` only a successful write clears that badge again.
 *
 * **Which categories those are is MEASURED, and this predicate has now measured wrong
 * twice.** The first draft compared against `'Validation'` alone, under a sentence asserting
 * that "a field commit that fails a domain rule resolves a `ValidationError`", which is false
 * here. The second added `'Domain'` and grepped for `'Domain'` — so `Reference`, the category
 * the delete flow and both reversible adapters refuse through, was never looked at, and every
 * one of its refusals settled a sticky `save-error` over data nothing had touched. The
 * generalisable half: a grep written to confirm the widening you already decided on measures
 * that widening and nothing else. The greps that should have run are `grep -rn "'Reference'"
 * src/` and `grep -rn "referenceError(" src/`, and what they print is below.
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
 *   `SetPlanBackground`), each before that command's first write;
 * - `zone.nothing-to-undo` in both reversible zone adapters and `requirement.not-found` in
 *   `ReversibleOverrideBase.execute`, all three raised with nothing recorded to write;
 * - `requirement.zone-not-found` and `requirement.asset-not-found` in
 *   `reversible-assign-asset-command.ts`'s `redoCreate`, which re-checks both entities
 *   before `requirements.save`;
 * - `reference.set-changed`, `reference.referents-exist`, `reference.entity-gone` and
 *   `reference.reassign-target-gone`, all four inside `deleteResolution.ts`'s `prepare` —
 *   the step that takes the locks and reads the pre-state, before `deleteEntity` or any
 *   Requirement write. `reference.set-changed`'s own message says "nothing was written".
 *
 * That set is REACHABLE, not theoretical, and each widening was one keystroke or one click
 * away. The Inspector's two override fields are `type="text"` (`RequirementRow.vue`), so
 * typing `-5` into one raises the first `Domain` site. The Inspector's Delete button opens
 * `deleteZoneFlow.ts`, and confirming a dialog whose referent set moved underneath it raises
 * `reference.set-changed` — a refusal that states its own innocence in its message and still
 * left a persistent "Save error" badge standing behind it.
 *
 * **No category here is a synonym for "wrote nothing", which is why the carve-out exists.**
 * `versioning.ts` raises `revisionConflict` and `externalModification` as `ValidationError`s,
 * and both mean the OPPOSITE: the command reached the repository, the version had moved, and
 * the user's edit was refused and is gone. Reporting `saved` for one of those is the false
 * assurance this whole predicate exists to prevent. So the category is the first cut and the
 * write-boundary codes are carved back out of it, from the table `versioning.ts` exports
 * rather than from a copy. The carve-out applies to the whole pre-write set rather than to
 * `Validation` alone: nothing raises those two codes under `Domain` or `Reference` today, and
 * a future site that did would fail toward reporting rather than away.
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
 * nobody has thought about it. The unsafe default is silence. Three of the eight are in the
 * pre-write set now and five are not (`Persistence`, `Geometry`, `Import`, `Migration`,
 * `Calculation`), which is worth noticing rather than letting grow quietly: the further this
 * set widens, the more the indicator depends on every one of those raise sites STAYING
 * pre-write, and the next widening should be argued against that rather than against the
 * nuisance of a badge.
 *
 * **The residual exposure this creates, stated because it is the unsafe direction.** A
 * `Domain`, `Validation` or `Reference` error raised AFTER a write had already landed would
 * be under-reported: the indicator would settle `saved`, or revert to what it read before the
 * batch, over data whose write half-completed. The greps above found NO such site today —
 * which is "found none", not "none exists", and nothing in the suite or in either linter would
 * notice one being added. `deleteResolution.ts` is where one is likeliest to appear, being the
 * only member of the pre-write set that writes several entities in sequence; today every
 * `Reference` refusal in it is inside `prepare` and every failure after that point is a
 * `RepositoryError`. The two write-boundary codes are the nearest thing to a post-write member
 * and they are carved back out above.
 *
 * **The deeper fix is at the raise sites and is not this slice's to make.** The override
 * commands LOSE information by re-labelling the domain entity's `Validation` errors as
 * `Domain`, and nothing downstream can recover what the label discarded. Changing a category
 * there also changes the sentence `toUserMessage` resolves for it, and error-to-surface
 * mapping is slice 17's declared territory — so slice 13 narrowed the predicate and left the
 * commands alone.
 *
 * **Where this DOES derive from, and where it will have to agree later.** It derives from
 * `WRITE_BOUNDARY_CODES` in `versioning.ts` — the one place those two codes are spelled —
 * and from nothing else. An earlier draft of this docblock said in the present tense that it
 * was "DERIVED from [slice 17's] table" and that "slice 17's no-double-reporting test is what
 * keeps the two in agreement": slice 17 does not exist, so there was no table to derive from
 * and no test to keep anything in agreement. `grep -rn "no-double-reporting" src tests`
 * printed exactly one line, and it was that sentence. Written to the check, in the future
 * tense: when slice 17 authors its error-to-surface table, this predicate is one of the
 * things that table has to agree with, and the agreement will need a check of its own,
 * because nothing today can notice the two disagreeing — the pre-write set above included.
 */
export function affectsSaveState(error: AppError): boolean {
	if (!PRE_WRITE_CATEGORIES.includes(error.category)) return true;
	return WRITE_BOUNDARY_CODES.some((suffix) => error.code.endsWith(`.${suffix}`));
}
