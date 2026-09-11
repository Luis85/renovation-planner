import type { AppError } from '../../../core/errors/AppError';
import { err, ok } from '../../../core/result/Result';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';

/** One already-reversible write a composite command runs in order (`PasteCommand`, `DeleteSelectionCommand`). */
export interface ComposedStep { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> }

/** Walks `steps` forward or back in the order given; a step that refuses puts back the ones already moved in this call. */
export async function walkSteps(steps: readonly ComposedStep[], forward: boolean): Promise<DispatchResult> {
	const moved: ComposedStep[] = [];
	for (const step of steps) {
		const result = forward ? await step.execute() : await step.undo();
		if (!result.ok) return restoreSteps(moved, !forward, result.error);
		moved.push(step);
	}
	// An empty `steps` (an undo before the first execute ever ran) walked nothing.
	return ok(moved.length ? 'wrote' : 'no-write');
}

/** Moves `moved` back the way `forward` names, newest first, and returns `error` — marked uncompensated if that fails too. */
export async function restoreSteps(moved: readonly ComposedStep[], forward: boolean, error: AppError): Promise<DispatchResult> {
	for (const step of moved.toReversed()) {
		const back = forward ? await step.execute() : await step.undo();
		// Stopping here rather than continuing to compensate the rest is deliberate:
		// `markUncompensated` sends the editor into reopen-the-floor recovery, so continuing
		// would write against a floor state this command can no longer vouch for.
		if (!back.ok) return err(markUncompensated(error));
	}
	return err(error);
}
