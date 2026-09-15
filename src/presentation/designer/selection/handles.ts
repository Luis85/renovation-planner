import type { Point } from '../../../core/geometry/Point';
import { arcPoint } from '../../../core/geometry/circularArc';
import { BOX_HANDLE_COUNT, boxHandlePoint } from '../../../core/geometry/boxHandles';
import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf } from '../../../domain/asset/shapeEdits';
import { ROTATION_HANDLE_OFFSET_PX } from '../../editor/handleMetrics';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from './designerSelection';

export type HandleRole =
	| { readonly kind: 'box'; readonly index: number }
	| { readonly kind: 'rotate' }
	| { readonly kind: 'vertex'; readonly index: number }
	| { readonly kind: 'edge'; readonly index: number };

export interface SelectionHandle {
	readonly role: HandleRole;
	readonly at: Point;
}

/**
 * The handles a selection offers in a mode (symbols spec, Decision 10). `[]` for no selection, for
 * the anchor or the facing — each is dragged as itself — and for a part the shape lacks. The box is
 * the outline's curve-aware extent, so an arc bowing past its corners is inside it.
 *
 * `unwrap` rather than a refusal arm: every shape reaching here has been through
 * `validateAssetShape`, whose outlines always have a box.
 */
export function selectionHandles(
	shape: AssetShape,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	worldPerPixel: number,
): SelectionHandle[] {
	if (!isOutlineSelection(selection)) return [];
	const outline = outlineOf(shape, selection);
	if (outline === null) return [];
	const { points } = outline;
	if (mode === 'points') return points.map((at, index): SelectionHandle => ({ role: { kind: 'vertex', index }, at }));
	if (mode === 'bend') {
		return points.map((start, index): SelectionHandle => ({
			role: { kind: 'edge', index },
			at: arcPoint({ start, end: points[(index + 1) % points.length], bulge: outline.bulges?.[index] ?? 0 }, 0.5),
		}));
	}
	const box = unwrap(boundingBoxOf(outline));
	return [
		...Array.from({ length: BOX_HANDLE_COUNT }, (_, index): SelectionHandle => ({ role: { kind: 'box', index }, at: boxHandlePoint(box, index) })),
		{ role: { kind: 'rotate' }, at: { x: boxHandlePoint(box, 1).x, y: box.min.y - ROTATION_HANDLE_OFFSET_PX * worldPerPixel } },
	];
}
