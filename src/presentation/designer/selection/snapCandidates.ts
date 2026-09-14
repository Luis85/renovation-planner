import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import { partKey } from './designerSelection';

/**
 * Vertices of the footprint and every detail, plus the anchor — minus the parts whose partKey is in
 * `exclude`. Clearance vertices are not candidates. `{}` for a null shape.
 */
export function designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates {
	if (shape === null) return {};
	const skip = new Set(exclude);
	return {
		vertices: [
			...(skip.has('footprint') ? [] : shape.footprint.points),
			...shape.details
				.filter((detail) => !skip.has(partKey({ kind: 'detail', id: detail.id })))
				.flatMap((detail) => detail.outline.points),
			...(skip.has('anchor') ? [] : [shape.anchor]),
		],
	};
}
