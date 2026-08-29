import type { AppError } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';

/**
 * Is this failure one the save indicator should report?
 *
 * **Not every failed `Result` is a save error.** A field commit that fails a domain rule
 * resolves a `ValidationError` and writes NOTHING — the repository was never reached.
 * Flipping the indicator for it would be wrong twice: it reports a persistence failure that
 * did not happen, and the user would get the inline field message they need plus a "save
 * error" badge about data exactly as safe as it was before they typed.
 *
 * **`Validation` is not a synonym for "wrote nothing", and an earlier draft of this function
 * assumed it was.** `versioning.ts` raises `revisionConflict` and `externalModification` as
 * `ValidationError`s, and both mean the OPPOSITE: the command reached the repository, the
 * version had moved, and the user's edit was refused and is gone. Reporting `saved` for one
 * of those is the false assurance this whole predicate exists to prevent. So the category is
 * the first cut and the write-boundary codes are carved back out of it, from the table
 * `versioning.ts` exports rather than from a copy.
 *
 * **The category comparison is TITLE case**, because `ErrorCategory` is
 * `'Domain' | 'Validation' | 'Persistence' | 'Geometry' | 'Import' | 'Migration' |
 * 'Reference' | 'Calculation'`. A lowercase literal here does not merely fail to match — it
 * fails to compile, and the earlier draft's tests hid that by casting hand-built objects
 * through `unknown`.
 *
 * **Stated as an inequality against one category rather than a list of the ones that count,
 * deliberately.** A new `AppError` category added by a later slice should default to
 * AFFECTING the indicator, because "we might not have written your data" is the safe answer
 * to give while nobody has thought about it. The unsafe default is silence.
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
 * because nothing today can notice the two disagreeing.
 */
export function affectsSaveState(error: AppError): boolean {
	if (error.category !== 'Validation') return true;
	return WRITE_BOUNDARY_CODES.some((suffix) => error.code.endsWith(`.${suffix}`));
}
