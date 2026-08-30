import type { AppError } from '../../core/errors/AppError';

/**
 * Was this `AppError` mapped from a THROW, rather than returned as a refusal?
 *
 * **SDD §65 draws the line and nothing else could.** A refusal is expected: the command
 * considered the request and declined it, and the save indicator carries whether anything was
 * written. A technical fault is not: something below the boundary broke, `faultError` mapped
 * the cause into a coded `PersistenceError`, and the ONLY account the user will ever get of it
 * is the sentence that error resolves to. The two are structurally identical by the time they
 * reach Presentation — both a failed `Result` carrying a `PersistenceError` — so the
 * distinction has to be recorded at the one place that knows, which is the mapping step.
 *
 * Design slice 17 needs it because those two want different surfaces. A save-affecting
 * REFUSAL at an autosave-path site is already reported by the indicator, so a toast beside it
 * is the double-report the slice exists to close. A FAULT routed the same way would show a
 * badge reading "Save error" and no cause at all — trading the user's only explanation for
 * consistency, which is the wrong side of that trade.
 *
 * Stamped in `faultError`, which is the single site where a thrown cause becomes an
 * `AppError`; `grep -rn "faultError(" src/` prints its definition and FOUR callers —
 * `commitField`, `useFieldCommit`'s continuation guard, `useFormCommit`'s submit guard, and
 * `notifyFault` — every one of them a catch block. So the mark cannot be missed by a fault
 * taking some other route, because there is no other route.
 *
 * The same shape as `markUncompensated` in `application/commands/DispatchOutcome.ts` and for
 * the reason its docblock gives: a report from the code that knows beats an inference from the
 * code that does not. Spelled in ONE place so a consumer cannot half-spell the key into a
 * predicate that silently answers `false` forever.
 */
interface TechnicalFault {
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
