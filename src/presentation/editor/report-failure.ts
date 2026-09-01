import type { AppError } from '../../core/errors/AppError';
import { noticeOnlySinks, notifyFault, notifyOperationFailure } from '../notices/notify';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { Logger } from '../../application/ports/Logger';
import { surfaceError, type SurfaceSinks } from '../errors/surfaceError';
import { isTechnicalFault } from '../../core/errors/technical-fault';
import { affectsSaveState } from './save-state/affects-save-state';

/**
 * Where an editing leaf's failure goes once the save indicator has had its chance at it, and
 * the two last-stop doors a dispatch bound to a click needs.
 *
 * Extracted from `runtime.ts` so the rule is ONE function with several importers rather than
 * one spelled out at each of them — `CLAUDE.md`'s "one rule with two doors is two rules unless
 * one function holds it", and this rule has already been got wrong at five separate sites in
 * as many review rounds. The asset designer is the second surface to dispatch through it, which
 * is what moved `reportDispatchFault` and `notifyIfRefused` in here beside it: both were
 * `runtime.ts` locals under docblocks that said "in this leaf", and there are two leaves now.
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

/**
 * The last stop for an UNEXPECTED technical fault on a dispatch (SDD §65 reserves throws
 * for those; every expected failure is a `Result`). Resolves `null` when one happened, so
 * a caller can tell "the dispatch reported a refusal" from "the dispatch never got to
 * report anything".
 *
 * It exists because every dispatch in an editing leaf is ultimately bound to a click handler
 * — `@click="runtime.undo()"`, the Inspector's delete — and a Vue click handler discards the
 * promise it is handed. Without this, a fault surfaced as a console unhandled rejection and
 * the UI simply stopped responding to that button, which is the one failure mode worse than
 * an error message.
 *
 * There is no `AppError` to translate here — the throw never reached a guard, or it came from
 * one of the raw repository PORTS a leaf's bundle still hands out — so `notifyFault` maps it
 * into the same coded `PersistenceError` a guarded service would have produced, LOGS the raw
 * cause under the caller's event name, and prints the mapped copy. The exception's own message
 * never reaches the user, and the developer half is not lost with it: no guard ran below this,
 * so this is the only step in THIS path where both representations can be produced together
 * (SDD §66).
 *
 * `event` is the CALLER's, because two surfaces dispatch through this and a log line has to
 * say which door faulted. It is the one thing this function cannot know for itself.
 */
export async function reportDispatchFault(
	logger: Logger,
	event: string,
	operation: Promise<DispatchResult>,
): Promise<DispatchResult | null> {
	try {
		return await operation;
	} catch (cause) {
		notifyFault(cause, logger, event);
		return null;
	}
}

/**
 * `reportDispatchFault`'s other half: an EXPECTED refusal that RESOLVES rather than throws
 * (SDD §65). `CommandHistory.undoNow`/`redoNow` deliberately leave a refused undo/redo ON
 * its stack rather than popping it, so without this the button stays enabled, does
 * nothing, and says nothing about why. A caller chains
 * `notifyIfRefused(reportDispatchFault(logger, event, op))` to cover both halves — throw and
 * resolved refusal — in one line.
 *
 * **Design slice 17 narrowed what happens next, and the narrowing is the point.** Every
 * dispatch reaching here has already passed through `withSaveStateTracking`, which asks
 * `affectsSaveState` and flips the save indicator for anything that wrote or might have.
 * Toasting it as well reported ONE failure through TWO widgets that can drift apart — the
 * toast dismisses and the indicator does not, or the reverse. `reportDispatchFailure` above is
 * where that decision is made, once, for both surfaces.
 */
export async function notifyIfRefused(operation: Promise<DispatchResult | null>): Promise<void> {
	const result = await operation;
	if (result === null || result.ok) return;
	reportDispatchFailure(result.error);
}
