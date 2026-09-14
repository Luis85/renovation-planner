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
 */
export function createEditShape(
	design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
	write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape {
	return (edit) => {
		const current = design();
		if (current === null || current.shape === null) return Promise.resolve<DispatchResult>(ok('no-write'));
		const next = edit(current.shape);
		if (!next.ok) return Promise.resolve<DispatchResult>(err(next.error));
		return write(next.value, current.geometryVersion);
	};
}
