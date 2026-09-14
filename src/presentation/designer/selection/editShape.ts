import type { ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';

/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit from
 * `shapeEdits.ts`/`detailEdits.ts`, dispatched as ONE `SetAssetShape` conditional on the version the
 * leaf read, or not dispatched at all.
 *
 * It RESOLVES every outcome rather than reporting one, so a field can show a refusal beside itself
 * and a key binding can hand it to `notifyIfRefused` — which sends a pre-write `Validation` refusal to
 * a notice and a write-boundary one to the save indicator, so one door serves both halves.
 */
export type EditShape = (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>;

/**
 * `design` is read PER CALL — a designer leaf edits and re-reads without remounting. Nothing read yet,
 * or nothing drawn, is `no-write`: there is no shape for an edit to act on, which is not a refusal.
 *
 * **Every call is chained behind the previous one's settling** — the read, the edit and the write as
 * ONE step, the plan editor's `nudge.ts` fix met again. The dispatcher's queue serialises only the
 * write, a step after this read, and the design is refreshed only by that write's own queued read-back;
 * so two arrow taps before the first refresh landed both edited the same shape against the same
 * version, and the conditional write refused the user's own second tap as a conflict. Chained, each
 * step reads what the previous one wrote. What a caller acts ON — the selection — is captured before it
 * calls, never inside the step.
 *
 * `async`, so a fault in `design()`, the edit or `write` rejects the returned promise rather than
 * throwing at the call. Nothing catches that rejection: `write` is the leaf's fault-mapped
 * `toolDispatcher` (`runtime.ts`), which resolves every coded refusal, so only a programming fault gets
 * here — and the key bindings `void` the promise, so it surfaces as an unhandled rejection.
 */
export function createEditShape(
	design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
	write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape {
	let chain: Promise<unknown> = Promise.resolve();
	return (edit) => {
		const step = chain.then(async (): Promise<DispatchResult> => {
			const current = design();
			if (current === null || current.shape === null) return ok('no-write');
			const next = edit(current.shape);
			if (!next.ok) return err(next.error);
			return await write(next.value, current.geometryVersion);
		});
		// A step that rejected must not wedge every later one behind it: the chain waits for it to SETTLE.
		chain = step.catch(() => undefined);
		return step;
	};
}
