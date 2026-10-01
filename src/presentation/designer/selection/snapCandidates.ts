import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap } from '../../../core/result/Result';
import { detailIsClosed, type AssetDetail } from '../../../domain/asset/AssetDetail';
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

/**
 * One graphic's snap edges. An OPEN one contributes its segments and NOT a closing edge: the wrap
 * that `edgesOf` adds for a ring is a line the object has not got, and snapping to it would pull a
 * drag onto geometry nobody drew.
 */
function graphicEdges(detail: AssetDetail): NonNullable<SnapCandidates['edges']> {
	if (detailIsClosed(detail)) return edgesOf(detail.outline);
	const { points, bulges } = detail.outline;
	return points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1], bulge: bulges?.[index] ?? 0 }));
}

/** A graphic's box centre, which an open path has exactly as a closed one does — a box needs no interior. */
function graphicCentre(points: readonly Point[]): Point {
	const { min, max } = unwrap(boundingBoxOf({ points }));
	return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
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
	// ONE list in the original order — the footprint first, then each graphic — because the
	// alignments below interleave each part's vertices with its own box centre, and a test pins
	// that order. An open graphic differs only in what its EDGES are and in how its centre is
	// derived, never in where it sits in this list.
	const parts: { readonly points: readonly Point[]; readonly edges: NonNullable<SnapCandidates['edges']>; readonly centre: Point }[] = [
		...(skip.has('footprint') ? [] : [{ points: shape.footprint.points, edges: edgesOf(shape.footprint), centre: centreOf(shape.footprint) }]),
		...shape.details
			.filter((detail) => !skip.has(partKey({ kind: 'detail', id: detail.id })))
			.map((detail) => ({ points: detail.outline.points, edges: graphicEdges(detail), centre: graphicCentre(detail.outline.points) })),
	];
	const anchor = skip.has('anchor') ? [] : [shape.anchor];
	return {
		vertices: [...parts.flatMap((part) => part.points), ...anchor],
		edges: parts.flatMap((part) => part.edges),
		alignments: [...parts.flatMap((part) => [...part.points, part.centre]), ...anchor],
	};
}
