import type { AppError } from '../../core/errors/AppError';
import { noticeOnlySinks, notifyOperationFailure } from '../notices/notify';
import { surfaceError, type SurfaceSinks } from '../errors/surfaceError';
import { isTechnicalFault } from '../../core/errors/technical-fault';
import { affectsSaveState } from './save-state/affects-save-state';

/**
 * Where a Plan Editor failure goes once the save indicator has had its chance at it.
 *
 * Extracted from `runtime.ts` so the rule is ONE function with several importers rather than
 * one spelled out at each of them — `CLAUDE.md`'s "one rule with two doors is two rules unless
 * one function holds it", and this rule has already been got wrong at five separate sites in
 * as many review rounds.
 *
 * The file is `report-failure` and not `report-refusal`, which is what it was called for one
 * round: a REFUSAL is precisely the thing the function below distinguishes from a fault, so
 * naming the module after one half of its own distinction was the sentence promising more than
 * it delivered in miniature.
 */

/**
 * The sinks a leaf shares, plus the no-op save-state door.
 *
 * `saveState` does nothing because the indicator is driven by `withSaveStateTracking`, one
 * layer below every dispatch, off the same `Result`. Declared once at module scope rather than
 * rebuilt per call, so the arrow is one function and the reason for it lives in one place.
 */
const AUTOSAVE_SINKS: SurfaceSinks = {
	...noticeOnlySinks,
	saveState: () => undefined,
};

/**
 * A failure that came back from a DISPATCH, reported on whichever surface has not already
 * taken it.
 *
 * **A FAULT keeps its sentence, and is asked about FIRST.** Something below the boundary
 * threw, an `ExceptionMapper` turned the cause into a coded `PersistenceError`, and the
 * mapped sentence is the only account of it the user will ever get. By the time it arrives
 * here it is shaped exactly like a refusal the command RETURNED — a failed `Result` carrying a
 * `PersistenceError` — so nothing but the stamp can tell them apart. Routed as a refusal it
 * would raise a badge reading "Save error" and explain nothing, trading the user's only
 * explanation for consistency. SDD §65 draws the line and
 * `core/errors/technical-fault.ts` carries it here.
 *
 * **"Dispatched" does not mean "the indicator has it", which is what decides the rest.**
 * `withSaveStateTracking` asks `affectsSaveState`, and for a PRE-WRITE category —
 * `Calculation`, `Domain`, `Validation`, `Reference` — it resolves NEUTRAL: no badge, because
 * nothing was written. A door that assumed every dispatched refusal was carried by the
 * indicator routed those to a save-state sink that is deliberately a no-op, and they reached
 * nobody at all. Calibration is the reachable case: `calibration.degenerate-scale` and
 * `nonFiniteRescaleError` are raised by the command, after dispatch and before
 * `geometry.write`.
 *
 * So this asks the SAME predicate the indicator asked. The two cannot disagree about who
 * reported what, because there is one question and one answer.
 *
 * **This was TWO functions for one review round, and the reason they merged is the point.**
 * The fault arm lived in a second door used by the `makeCommitField` paths alone, because only
 * that guard's own `catch` produced a stamped fault — a guarded command's throw was mapped by
 * `guardAgainstThrowing` and arrived here unstamped, so the fault arm would have been dead for
 * every other caller. Making the stamp a type obligation on `ExceptionMapper` fixed that, and
 * with both doors able to see a fault there was one rule left and no reason for two functions
 * to hold it.
 */
export function reportDispatchFailure(error: AppError): void {
	if (isTechnicalFault(error)) {
		notifyOperationFailure(error);
		return;
	}
	if (affectsSaveState(error)) {
		surfaceError(error, { kind: 'autosave-write' }, AUTOSAVE_SINKS);
		return;
	}
	notifyOperationFailure(error);
}
