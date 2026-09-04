import type { AppError } from '../../core/errors/AppError';
import { err } from '../../core/result/Result';
import { faultError, noticeOnlySinks, notifyFault, notifyOperationFailure } from '../notices/notify';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { UndoableCommand } from './tools/undoable-command';
import type { Logger } from '../../application/ports/Logger';
import { surfaceError, type SurfaceSinks } from '../errors/surfaceError';
import { isTechnicalFault } from '../../core/errors/technical-fault';
import { affectsSaveState } from './save-state/affects-save-state';

/**
 * Where an editing leaf's failure goes once the save indicator has had its chance at it, and
 * the three last-stop doors a dispatch that nobody awaits needs.
 *
 * TWO of them are for a dispatch bound to a CLICK — `reportDispatchFault` and `notifyIfRefused`,
 * which the Plan Editor's context bar and the asset designer's own toolbar each chain their
 * undo and redo through. The third, `mapDispatchFaults`, is for a
 * dispatch bound to a GESTURE, which is every tool on both surfaces and which had none at all
 * until a review round asked what happens when `run(...)` rejects.
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

/**
 * The phantom brand that makes "this dispatcher's faults have been mapped" a fact a type can
 * hold, borrowed verbatim from `errorSurfacePolicy.ts`'s `Routed` and for the same reason.
 *
 * `declare const` plus `unique symbol`: nothing reads it at runtime and the returned object
 * carries no extra property, so a test may still compare a dispatcher as plain data.
 */
declare const FAULT_MAPPED: unique symbol;

type FaultMapped = { readonly [FAULT_MAPPED]: true };

/**
 * The door a tool dispatches through — a dispatcher whose `run` is guaranteed to RESOLVE, never
 * to reject.
 *
 * `EditorContextDeps.commandDispatcher` is typed as this, which is the whole mechanism: a
 * surface cannot assemble an `EditorContext` without having put its dispatcher through
 * `mapDispatchFaults` first, because nothing outside this module can produce the brand. A THIRD
 * editing surface therefore inherits the guarantee rather than having to remember it — the
 * failure this closes is precisely that the two surfaces that exist today each composed their
 * context by hand and neither wrapped `run`.
 *
 * State it narrowly: the type holds that the mapping was APPLIED, never that the `event` name
 * passed with it is the right one. Two runtimes, two names, and review is the whole instrument
 * for that half.
 */
// `FaultMapped` is UNEXPORTABLE on purpose, and this is the third leak in this repository that
// must not be "fixed" the way the report suggests: exporting it would let a runtime hand
// `createEditorContext` a raw `wrapDispatcher` result with the brand asserted onto it, which is
// the exact composition this type exists to make impossible.
//
// "next line" is LITERAL, and the reported line is the one the private type is NAMED on — not
// this alias's head.
export type ToolDispatcher =
	// fallow-ignore-next-line private-type-leak
	{ run(command: UndoableCommand): Promise<DispatchResult> } & FaultMapped;

/**
 * The THIRD last-stop door in this file, and the one every canvas gesture goes through.
 *
 * `reportDispatchFault` above covers `undo()` and `redo()`, which are bound straight to a click
 * on the context bar (or the designer's own toolbar). It never covered `run(...)` — what all
 * five tools across both surfaces call — and
 * `withStateRefresh`/`withEditorStateRefresh` RE-THROW on rejection by design, while every tool
 * launches its dispatch detached (`void this.commit(...)`, `void this.dispatch(...)`). So a
 * vault fault under a drag was an unhandled rejection: nothing told the user, nothing logged the
 * cause, and the gesture silently did nothing — the one failure mode SDD §66 exists to prevent,
 * standing in the plan editor since design slices 7 and 8.
 *
 * **It MAPS and LOGS, and deliberately does not notify.** `faultError` is the map-once,
 * log-once half of the fault door; the failed `Result` it returns is then indistinguishable in
 * SHAPE from a refusal the command produced, which is exactly what lets the five tools go on
 * inspecting `if (!result.ok)` unchanged and report through the door they already have. That
 * door is `reportDispatchFailure` above, which asks `isTechnicalFault` FIRST and gives a fault
 * its own sentence rather than a "Save error" badge with no cause. Notifying here as well would
 * be the double-report design slice 17 closed.
 *
 * **The `Result` is preserved rather than replaced**, which is the property to keep: a tool that
 * holds a buffer keeps it on a fault exactly as it does on a refusal, because the two arrive on
 * the same channel and the write may or may not have landed either way.
 *
 * The alternative — a `.catch` at each of the five tool call sites — is the shape `runDetached`
 * and `notifyFault` were both written against: a sixth tool would have to remember a `.catch`
 * that nothing checks. Here it is one function, and `ToolDispatcher`'s brand makes it one the
 * compiler will not let a surface skip.
 */
export function mapDispatchFaults(
	dispatcher: { run(command: UndoableCommand): Promise<DispatchResult> },
	logger: Logger,
	event: string,
): ToolDispatcher {
	const mapped = {
		run: async (command: UndoableCommand): Promise<DispatchResult> => {
			try {
				return await dispatcher.run(command);
			} catch (cause) {
				return err(faultError(cause, logger, event));
			}
		},
	};
	return mapped as ToolDispatcher;
}
