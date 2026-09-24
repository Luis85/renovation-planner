import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { boxResize } from '../../../core/geometry/boxHandles';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, isErr, ok, unwrap, type Result } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { scaleRoundedRect } from '../../../domain/asset/cornerRadius';
import {
	moveAnchor,
	moveOutline,
	moveVertex,
	outlineOf,
	partNotFound,
	resizeBox,
	rotateOutline,
	setFacing,
	type OutlinePart,
} from '../../../domain/asset/shapeEdits';
import { isOutlineSelection, type DesignerSelection } from './designerSelection';
import type { HandleRole } from './handles';

/** A body drag, or a handle. An `edge` handle is Bend edges', which `CurveTool` drives, so it is not a role here. */
export type DragRole = { readonly kind: 'body' } | Exclude<HandleRole, { readonly kind: 'edge' }>;

export interface DragStart {
	/** The design the gesture started on. */
	readonly shape: AssetShape;
	readonly selection: DesignerSelection;
	readonly role: DragRole;
	/** World point of the press. */
	readonly from: Point;
}

export interface DragOptions {
	readonly shift: boolean;
	readonly snapRotation: (radians: number) => number;
}

/** The selected outline's box, or `part-not-found` for a selection the shape no longer has. */
function boxOf(shape: AssetShape, part: OutlinePart): Result<BoundingBox, ValidationError> {
	const outline = outlineOf(shape, part);
	return outline === null ? err(partNotFound(part)) : ok(unwrap(boundingBoxOf(outline)));
}

/**
 * The shape this drag would write if released at `to` (symbols spec, Decision 10 and Amendment 1).
 * `to` is already snapped by the caller where snapping applies. Pure: the tool calls it on every move
 * for the preview and once more at release for the write, so the two cannot disagree.
 *
 * The anchor and the facing have no handles, so their drags ignore `role`: the anchor moves by the
 * pointer's travel, and the facing takes the pointer's bearing from the anchor.
 *
 * **A box handle keeps a rounded rectangle one** (AD18-R21): `scaleRoundedRect` rebuilds it in the new box
 * with its radius kept or clamped, by the rule a typed Width or Depth takes, and answers `null` for every
 * other part — which then scales as before, as does a rounded rectangle turned off the axes, since the
 * typed path does not keep that one's radius either. Shift is left out: a proportional scale keeps the
 * outline a rounded rectangle already, with the radius scaled by the same factor, as it always has.
 */
export function draggedShape(start: DragStart, to: Point, options: DragOptions): Result<AssetShape, ValidationError> {
	const { shape, selection, role, from } = start;
	if (!isOutlineSelection(selection)) {
		if (selection.kind === 'anchor') {
			return moveAnchor(shape, { x: shape.anchor.x + to.x - from.x, y: shape.anchor.y + to.y - from.y });
		}
		const bearing = Math.atan2(to.y - shape.anchor.y, to.x - shape.anchor.x);
		return setFacing(shape, options.shift ? options.snapRotation(bearing) : bearing);
	}
	if (role.kind === 'body') return moveOutline(shape, selection, { dx: to.x - from.x, dy: to.y - from.y });
	if (role.kind === 'vertex') return moveVertex(shape, selection, role.index, to);
	const box = boxOf(shape, selection);
	if (isErr(box)) return box;
	if (role.kind === 'box') {
		const { factors, origin } = boxResize(box.value, role.index, to, options.shift);
		const rounded = selection.kind === 'detail' && !options.shift ? scaleRoundedRect(shape, selection.id, factors, origin) : null;
		return rounded ?? resizeBox(shape, selection, factors, origin);
	}
	const centre = { x: (box.value.min.x + box.value.max.x) / 2, y: (box.value.min.y + box.value.max.y) / 2 };
	const by = Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x);
	return rotateOutline(shape, selection, options.shift ? options.snapRotation(by) : by, centre);
}
