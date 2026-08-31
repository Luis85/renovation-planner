import type { AppError } from './AppError';

/**
 * Was this `AppError` mapped from a THROW, rather than returned as a refusal?
 *
 * **SDD §65 draws the line and nothing else could.** A refusal is expected: the command
 * considered the request and declined it, and the save indicator carries whether anything was
 * written. A technical fault is not: something below the boundary broke, an `ExceptionMapper`
 * mapped the cause into a coded `PersistenceError`, and the ONLY account the user will ever
 * get of it is the sentence that error resolves to. The two are structurally identical by the
 * time they reach Presentation — both a failed `Result` carrying a `PersistenceError` — so the
 * distinction has to be recorded at the one step that still knows, which is the mapping.
 *
 * Design slice 17 needs it because those two want different surfaces. A save-affecting
 * REFUSAL at an autosave-path site is already reported by the indicator, so a toast beside it
 * is the double-report the slice exists to close. A FAULT routed the same way would show a
 * badge reading "Save error" and no cause at all — trading the user's only explanation for
 * consistency, which is the wrong side of that trade.
 *
 * **It lives in `core/` because the two layers that need it sit on opposite sides of
 * `application/`.** Slice 17 first put it in `presentation/errors/`, which is where its only
 * reader was; the WRITER turned out to be `application/errors/exceptionMapper.ts`, which may
 * not import presentation. `core/` is the one layer both can reach, and `AppError` — the type
 * this decorates — already lives here.
 *
 * **The stamp is a TYPE obligation, not a remembered call.** `ExceptionMapper` is declared to
 * return `AppError & TechnicalFault`, so a mapper that forgets to stamp fails `vue-tsc` at its
 * own `return` rather than shipping a fault that reads as a refusal. That is deliberate and it
 * is the correction of a real defect: this docblock used to say the stamp was applied in
 * `faultError`, "the single site where a thrown cause becomes an `AppError`", and that
 * sentence was false the day it was written. `guardAgainstThrowing.ts`'s catch is a second
 * site, and it is the one EVERY guarded command and query goes through — so a repository
 * exception under a dispatched editor command was mapped, logged, and then routed as an
 * ordinary save-affecting refusal: the indicator raised its badge and the mapped sentence
 * reached nobody. Reported by a review bot on the pull request; `CLAUDE.md`'s own rule is that
 * a docblock saying "the only place X" gets a `grep` in the same edit, and this one never did.
 *
 * The same shape as `markUncompensated` in `application/commands/DispatchOutcome.ts` and for
 * the reason its docblock gives: a report from the code that knows beats an inference from the
 * code that does not. Spelled in ONE place so a consumer cannot half-spell the key into a
 * predicate that silently answers `false` forever.
 */
export interface TechnicalFault {
	readonly technicalFault: true;
}

export function markTechnicalFault<TError extends AppError>(
	error: TError,
): TError & TechnicalFault {
	return { ...error, technicalFault: true };
}

export function isTechnicalFault(error: AppError): boolean {
	return (error as Partial<TechnicalFault>).technicalFault === true;
}
