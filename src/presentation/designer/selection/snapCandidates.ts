import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import { partKey } from './designerSelection';

/** An outline's segments, each with its own bulge, as `SnapService.snapToEdge` projects onto them. */
function edgesOf(outline: CurvedPolygon): NonNullable<SnapCandidates['edges']> {
	return outline.points.map((start, index) => ({
		start,
		end: outline.points[(index + 1) % outline.points.length],
		bulge: outline.bulges?.[index] ?? 0,
	}));
}

/** The centre of an outline's curve-aware box — the extent the inspector reads dimensions from. */
function centreOf(outline: CurvedPolygon): Point {
	const { min, max } = unwrap(boundingBoxOf(outline));
	return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
}

/**
 * What a designer gesture may snap to (asset designer snapping spec 2026-09-15, §2.2): the vertices and edges of
 * the footprint and every detail, their vertices and box centres to line up with, and the anchor — minus the
 * parts whose partKey is in `exclude`. The clearance is no target. `{}` for a null shape.
 */
export function designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates {
	if (shape === null) return {};
	const skip = new Set(exclude);
	const outlines = [
		...(skip.has('footprint') ? [] : [shape.footprint]),
		...shape.details
			.filter((detail) => !skip.has(partKey({ kind: 'detail', id: detail.id })))
			.map((detail) => detail.outline),
	];
	const anchor = skip.has('anchor') ? [] : [shape.anchor];
	return {
		vertices: [...outlines.flatMap((outline) => outline.points), ...anchor],
		edges: outlines.flatMap((outline) => edgesOf(outline)),
		alignments: [...outlines.flatMap((outline) => [...outline.points, centreOf(outline)]), ...anchor],
	};
}
