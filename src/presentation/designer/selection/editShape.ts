import type { ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { createSerialQueue } from '../../editor/tools/serial-queue';

/** A pure whole-shape edit from `shapeEdits.ts`/`detailEdits.ts`: the edited shape, or why not. */
export type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit, dispatched
 * as ONE `SetAssetShape` conditional on the version the step read, or not dispatched at all.
 *
 * An edit may answer `null` for "nothing to do on the shape I was handed" (Amendment 2) — a key whose
 * part a queued Delete already removed. That resolves `no-write` and dispatches nothing, so it pushes
 * no undo entry: `CommandHistory` pushes one for ANY ok result a command answers, which is why the
 * check lives here and never inside a command.
 *
 * It RESOLVES every outcome rather than reporting one, so a field can show a refusal beside itself
 * and a key binding can hand it to `notifyIfRefused` — which sends a pre-write `Validation` refusal to
 * a notice and a write-boundary one to the save indicator, so one door serves both halves.
 */
export type EditShape = (edit: (shape: AssetShape) => ReturnType<ShapeEdit> | null) => Promise<DispatchResult>;

/**
 * The designer leaf's ONE write chain (symbols spec, Amendment 2): a step runs only once every earlier
 * one has SETTLED, its read-back included. So a step that reads the design reads what the previous
 * write left, and two gestures made before the first refresh lands compose rather than the second
 * being refused as a version conflict against the user's own first.
 *
 * **Every write door on this surface joins it** (AD03): every tool's dispatch (through the runtime's
 * queued dispatcher); `commitHeight`, which borrows that same queued dispatcher rather than being a
 * tool itself; every `editShape` call — the arrow keys, the canvas's own Delete and Ctrl+D, the
 * selection inspector, and Edit dimensions' SCALING path (`scaleDesignToDimensions`, taken whenever
 * the footprint is already measured); and the five that `runtime.ts` enqueues explicitly — undo,
 * redo, set background, Start from preset (`applyShape`) and Edit dimensions'
 * REPLACE-WITH-RECTANGLE path (`setFootprintFromDimensions`, taken for an unscaled drawing or no
 * shape at all).
 *
 * Those five dispatched DIRECTLY until AD03, and the cost was never an overwrite: a press or key
 * made while one of them was still awaiting its read-back read the OLD version and was refused as a
 * version conflict. Refusing the user's own next gesture is a worse answer than sequencing it, and
 * undo could begin before the write it was about had settled — so they wait their turn now.
 *
 * What may NOT join it is a step already running inside it: `editShape` writes through a second,
 * UNQUEUED mapping of the same dispatcher for exactly that reason.
 *
 * `writing` and `settled` are the Select tool's two questions for a press (`DesignerSelectTool`'s
 * `hold`): is a write still queued, and when will every write queued so far have landed. `settled`
 * queues an empty step rather than counting one, so it never reads as writing itself.
 *
 * The queue is `createSerialQueue`, shared rather than copied, so a step that rejects cannot wedge the
 * steps behind it; `pending` is decremented in a `finally` for the same reason.
 */
export function createWriteChain(): {
	readonly enqueue: <T>(step: () => Promise<T>) => Promise<T>;
	readonly writing: () => boolean;
	readonly settled: () => Promise<void>;
} {
	const queue = createSerialQueue();
	let pending = 0;
	return {
		enqueue: (step) => {
			pending += 1;
			return queue(async () => {
				try {
					return await step();
				} finally {
					pending -= 1;
				}
			});
		},
		writing: () => pending > 0,
		settled: () => queue(() => Promise.resolve()),
	};
}

/**
 * `design` is read INSIDE the step — a designer leaf edits and re-reads without remounting, and a step
 * queued behind a write must see what that write left. Nothing read yet, or nothing drawn, is
 * `no-write`: there is no shape for an edit to act on, which is not a refusal. What a caller acts ON —
 * the selection — is captured before it calls, never inside the step.
 *
 * `write` must NOT be the chain's own queued dispatcher: a step dispatching through it would wait behind
 * itself. The runtime hands the fault-mapped dispatcher unqueued.
 *
 * A fault in `design()`, the edit or `write` rejects the returned promise rather than throwing at the
 * call. Nothing catches that rejection: `write` resolves every coded refusal, so only a programming
 * fault gets here — and the key bindings `void` the promise, so it surfaces as an unhandled rejection.
 */
export function createEditShape(
	enqueue: <T>(step: () => Promise<T>) => Promise<T>,
	design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
	write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape {
	return (edit) =>
		enqueue(async (): Promise<DispatchResult> => {
			const current = design();
			if (current === null || current.shape === null) return ok('no-write');
			const next = edit(current.shape);
			if (next === null) return ok('no-write');
			if (!next.ok) return err(next.error);
			return await write(next.value, current.geometryVersion);
		});
}
