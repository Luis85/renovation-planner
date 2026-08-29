import type { AppError } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';

/**
 * Is this failure one the save indicator should report?
 *
 * **Not every failed `Result` is a save error.** A refusal raised BEFORE the repository is
 * reached wrote NOTHING. Flipping the indicator for one would be wrong twice: it reports a
 * persistence failure that did not happen, and the user gets the inline field message they
 * need PLUS a "save error" badge about data exactly as safe as it was before they typed —
 * and per `save-state-store.ts` only a successful write clears that badge again.
 *
 * **Which categories those are is MEASURED, and the first draft of this predicate measured
 * nothing.** It compared against `'Validation'` alone, under a sentence asserting that "a
 * field commit that fails a domain rule resolves a `ValidationError`". That is false here.
 * `grep -rn "'Domain'" src/` prints nine lines outside this file: seven raise sites — four
 * in `SetRequirementQuantityOverride.ts`, one in `SetRequirementCostOverride.ts`, one in
 * `reversible-override-commands.ts` and one in `reversible-assign-asset-command.ts` — plus
 * the `ErrorCategory` union member and the `DomainError` alias in `AppError.ts`. **Every one
 * of the seven is pre-write**, read from the code rather than assumed:
 *
 * - `SetRequirementQuantityOverride`'s `applyQuantityOverride` refuses a negative quantity
 *   outright, and re-wraps three of the domain entity's own `Validation` errors —
 *   `withQuantityOverride`, `computeEstimatedCost` and `withCalculatedCost` — as `Domain`.
 *   All four precede its `requirements.save`.
 * - `SetRequirementCostOverride`'s `write` re-wraps `withCostOverride` the same way, before
 *   its own `save`.
 * - `undo.before-execute` in both reversible adapters is raised when there is no snapshot to
 *   restore, so no write is attempted at all.
 *
 * That set is REACHABLE, not theoretical: the Inspector's two override fields are
 * `type="text"` (`RequirementRow.vue`), so typing `-5` into one is a single keystroke away
 * from the first of them. Until `Domain` joined `Validation` here, that keystroke left a
 * persistent "Save error" badge standing behind the inline field refusal.
 *
 * **`Validation` is not a synonym for "wrote nothing" either, which is why the carve-out
 * exists.** `versioning.ts` raises `revisionConflict` and `externalModification` as
 * `ValidationError`s, and both mean the OPPOSITE: the command reached the repository, the
 * version had moved, and the user's edit was refused and is gone. Reporting `saved` for one
 * of those is the false assurance this whole predicate exists to prevent. So the category is
 * the first cut and the write-boundary codes are carved back out of it, from the table
 * `versioning.ts` exports rather than from a copy. The carve-out applies to the whole
 * pre-write set rather than to `Validation` alone: nothing raises those two codes under
 * `Domain` today, and a future site that did would fail toward reporting rather than away.
 *
 * **The category comparison is TITLE case**, because `ErrorCategory` is
 * `'Domain' | 'Validation' | 'Persistence' | 'Geometry' | 'Import' | 'Migration' |
 * 'Reference' | 'Calculation'`. A lowercase literal here does not merely fail to match — it
 * fails to compile, and an earlier draft's tests hid that by casting hand-built objects
 * through `unknown`.
 *
 * **Still an inequality against a named set rather than a list of the categories that count,
 * deliberately.** A new `AppError` category added by a later slice defaults to AFFECTING the
 * indicator, because "we might not have written your data" is the safe answer to give while
 * nobody has thought about it. The unsafe default is silence.
 *
 * **The residual exposure this widening creates, stated because it is the unsafe direction.**
 * A `Domain` or `Validation` error raised AFTER a write had already landed would now be
 * under-reported: the indicator would settle `saved`, or revert to what it read before the
 * batch, over data whose write half-completed. The same grep found NO such site today — which
 * is "found none", not "none exists", and nothing in the suite or in either linter would
 * notice one being added. The two write-boundary codes are the nearest thing to it and they
 * are carved back out above.
 *
 * **The deeper fix is at the raise sites and is not this slice's to make.** Those commands
 * LOSE information by re-labelling the domain entity's `Validation` errors as `Domain`, and
 * nothing downstream can recover what the label discarded. Changing a category there also
 * changes the sentence `toUserMessage` resolves for it, and error-to-surface mapping is slice
 * 17's declared territory — so slice 13 narrowed the predicate and left the commands alone.
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
	if (error.category !== 'Validation' && error.category !== 'Domain') return true;
	return WRITE_BOUNDARY_CODES.some((suffix) => error.code.endsWith(`.${suffix}`));
}
