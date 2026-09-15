import { boxHandlePoint } from '../../../core/geometry/boxHandles';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap } from '../../../core/result/Result';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent } from '../../editor/tools/editor-tool';
import { isOutlineSelection, partKey } from './designerSelection';
import type { DragStart } from './selectionDrag';

/** Where a drag lands — the `to` `draggedShape` is handed — and the guides that say why. */
export interface DragTarget {
	readonly to: Point;
	readonly guides: LineSegment[];
}

interface Snap {
	readonly context: EditorContext;
	readonly candidates: SnapCandidates;
	readonly tolerance: number;
	/** The pointer's travel since the press. */
	readonly travel: Point;
}

const carry = (snap: Snap, feature: Point): Point => ({ x: feature.x + snap.travel.x, y: feature.y + snap.travel.y });

function snapFeature(snap: Snap, feature: Point): DragTarget {
	const result = snap.context.snapService.snapPointWithGuides(carry(snap, feature), snap.candidates, snap.tolerance);
	return { to: result.point, guides: result.guides };
}

/** A body move stays a translation: the outline carried by the travel, corrected by ONE vector. */
function snapBody(snap: Snap, outline: CurvedPolygon, raw: Point): DragTarget {
	const moving = outline.points.map((point) => carry(snap, point));
	const result = snap.context.snapService.snapTranslation(moving, snap.candidates, snap.tolerance);
	return { to: { x: raw.x + result.correction.dx, y: raw.y + result.correction.dy }, guides: result.guides };
}

/**
 * A corner handle snaps like a vertex. A SIDE handle is an edge's midpoint — no feature a vertex or an edge could
 * land on — so it snaps its one moving coordinate to alignments and the grid only, and keeps only the guide along
 * that axis: an x-alignment guide is vertical, a y-alignment guide horizontal.
 */
function snapBoxHandle(snap: Snap, outline: CurvedPolygon, index: number): DragTarget {
	const box = unwrap(boundingBoxOf(outline));
	const handle = boxHandlePoint(box, index);
	const fixed = boxHandlePoint(box, (index + 4) % 8);
	if (handle.x !== fixed.x && handle.y !== fixed.y) return snapFeature(snap, handle);
	const alongX = handle.x !== fixed.x;
	const moved = carry(snap, handle);
	const { alignments, grid } = snap.candidates;
	const result = snap.context.snapService.snapPointWithGuides(moved, { alignments, grid }, snap.tolerance);
	return {
		to: alongX ? { x: result.point.x, y: moved.y } : { x: moved.x, y: result.point.y },
		guides: result.guides.filter((guide) => (alongX ? guide.start.x === guide.end.x : guide.start.y === guide.end.y)),
	};
}

/**
 * Where a designer drag lands (asset designer snapping spec 2026-09-15, §2.1): a vertex, the anchor, a body and a
 * box handle snap against the other parts (`partKey` excludes the dragged one) at the screen tolerance the draw
 * tools use; the facing, the rotate handle and a Shift (proportional) resize take the raw point.
 *
 * **What snaps is the MOVED feature, not the pointer** — the feature where the pointer's travel since the press
 * has carried it. A press a few millimetres off the anchor would otherwise snap the POINTER and land the anchor
 * those millimetres off the vertex it visibly snapped to. The features are handed back differently because
 * `draggedShape` reads them differently: a vertex's and a box handle's `to` is the new POSITION, while the anchor
 * and a body move by `to − from`, so their `to` is `from` carried by the snapped travel.
 */
export function dragTarget(context: EditorContext, start: DragStart, event: EditorPointerEvent): DragTarget {
	const raw = event.worldPoint;
	const { role, selection, shape, from } = start;
	const snap: Snap = {
		context,
		candidates: context.snapCandidates([partKey(selection)]),
		tolerance: SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel(),
		travel: { x: raw.x - from.x, y: raw.y - from.y },
	};
	// A vertex handle is only drawn on an outline the pressed shape has, so this cast hides no null.
	if (role.kind === 'vertex') return snapFeature(snap, (outlineOf(shape, selection as OutlinePart) as CurvedPolygon).points[role.index]);
	if (selection.kind === 'anchor') {
		const moved = snapFeature(snap, shape.anchor);
		return { to: { x: from.x + moved.to.x - shape.anchor.x, y: from.y + moved.to.y - shape.anchor.y }, guides: moved.guides };
	}
	if (!isOutlineSelection(selection)) return { to: raw, guides: [] };
	// Likewise: a body drag or a box handle is only reachable on the outline part that was hit on, or that
	// part's handles drawn around, the pressed `shape` — captured together with `selection` at press — so this
	// lookup cannot miss either.
	const outline = outlineOf(shape, selection) as CurvedPolygon;
	if (role.kind === 'body') return snapBody(snap, outline, raw);
	if (role.kind === 'box' && !event.modifiers.shift) return snapBoxHandle(snap, outline, role.index);
	return { to: raw, guides: [] };
}
