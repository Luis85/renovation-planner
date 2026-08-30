import type { AppError } from '../../core/errors/AppError';
import { noticeOnlySinks, notifyOperationFailure } from '../notices/notify';
import { surfaceError, type SurfaceSinks } from '../errors/surfaceError';
import { isTechnicalFault } from '../errors/technical-fault';
import { affectsSaveState } from './save-state/affects-save-state';

/**
 * Where a Plan Editor failure goes once the save indicator has had its chance at it.
 *
 * Extracted from `runtime.ts` so the rule is ONE function with several importers rather than
 * one spelled out at each of them — `CLAUDE.md`'s "one rule with two doors is two rules unless
 * one function holds it", and this rule has already been got wrong at four separate sites in
 * as many review rounds.
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
 * A refusal that came back from a DISPATCH, reported on whichever surface has not already
 * taken it.
 *
 * **"Dispatched" does not mean "the indicator has it".** `withSaveStateTracking` asks
 * `affectsSaveState`, and for a PRE-WRITE category — `Calculation`, `Domain`, `Validation`,
 * `Reference` — it resolves NEUTRAL: no badge, because nothing was written. A door that assumed
 * every dispatched refusal was carried by the indicator routed those to a save-state sink that
 * is deliberately a no-op, and they reached nobody at all. Calibration is the reachable case:
 * `calibration.degenerate-scale` and `nonFiniteRescaleError` are raised by the command, after
 * dispatch and before `geometry.write`.
 *
 * So this asks the SAME predicate the indicator asked. The two cannot disagree about who
 * reported what, because there is one question and one answer.
 */
export function reportDispatchRefusal(error: AppError): void {
	if (affectsSaveState(error)) {
		surfaceError(error, { kind: 'autosave-write' }, AUTOSAVE_SINKS);
		return;
	}
	notifyOperationFailure(error);
}

/**
 * The same, for the paths that go through `makeCommitField` — the Inspector's own commit and
 * the two override fields in `RequirementRow`.
 *
 * **A FAULT keeps its sentence.** That guard converts a THROW into a resolved `Result`
 * carrying a coded `PersistenceError`, so by this point a technical fault and a refusal the
 * command returned are the same shape. Routed identically, the fault would show a badge
 * reading "Save error" and no cause at all — trading the user's only account of it for
 * consistency. SDD §65 draws the line and `faultError`'s stamp is what carries it here.
 *
 * Every other failure is a refusal and takes the rule above.
 */
export function reportCommitFailure(error: AppError): void {
	if (isTechnicalFault(error)) {
		notifyOperationFailure(error);
		return;
	}
	reportDispatchRefusal(error);
}
