import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf } from '../../../domain/asset/shapeEdits';
import { VERTEX_GRAB_RADIUS_PX, VERTEX_HANDLE_RADIUS_PX } from '../../editor/handleMetrics';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { boundsOfZones } from '../../editor/viewport/zoneExtent';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { selectionHandles } from '../selection/handles';
import { facingTip } from './anchorLayer';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * What the designer draws for its selection (symbols spec, Decision 10): the selected outline
 * restroked in the accent, a mark per handle the active mode offers, and a ring on the anchor or the
 * facing tip. Every mark is sized in SCREEN pixels on a world-space layer, like `anchorLayer.ts`.
 *
 * **One Konva `Rect` per mark**, square or round by `cornerRadius`, so the canvas renders a single
 * `v-for` and never a `<template>` fragment inside its `VLayer`.
 */
export interface HandleMarkConfig {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	/** `0` for a box handle; the radius for a round one, which makes the rect a circle. */
	readonly cornerRadius: number;
	/** Absent on the anchor/facing ring, which must not hide the mark it surrounds. */
	readonly fill?: string;
	readonly stroke: string;
	readonly strokeWidth: number;
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
}

const SELECTED_STROKE_PX = 2;
const HANDLE_STROKE_PX = 1.5;

/** The ring is drawn at the GRAB radius, so it shows exactly the region a press will take. */
const RING_RADIUS_PX = VERTEX_GRAB_RADIUS_PX;

type PointSelection = Exclude<DesignerSelection, { readonly kind: 'footprint' | 'clearance' | 'detail' }>;

function pointOf(shape: AssetShape, selection: PointSelection, worldPerPixel: number): Point {
	return selection.kind === 'anchor' ? shape.anchor : facingTip(shape, worldPerPixel);
}

function mark(at: Point, radius: number, style: 'square' | 'round' | 'ring', tokens: ThemeTokens): HandleMarkConfig {
	return {
		x: at.x,
		y: at.y,
		width: radius * 2,
		height: radius * 2,
		offsetX: radius,
		offsetY: radius,
		cornerRadius: style === 'square' ? 0 : radius,
		...(style === 'ring' ? {} : { fill: tokens.canvasBackground }),
		stroke: tokens.accent,
		strokeWidth: HANDLE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}

export function selectionMarks(
	shape: AssetShape | null,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	tokens: ThemeTokens,
	worldPerPixel: number,
): { readonly outline: OutlineConfig | null; readonly handles: readonly HandleMarkConfig[] } {
	if (shape === null || selection === null) return { outline: null, handles: [] };
	if (!isOutlineSelection(selection)) {
		return { outline: null, handles: [mark(pointOf(shape, selection, worldPerPixel), RING_RADIUS_PX * worldPerPixel, 'ring', tokens)] };
	}
	const outline = outlineOf(shape, selection);
	return {
		outline: outline === null
			? null
			: {
				points: flatPoints(polygonPolyline(outline, ARC_TOLERANCE_PX * worldPerPixel)),
				closed: true,
				stroke: tokens.accent,
				strokeWidth: SELECTED_STROKE_PX,
				strokeScaleEnabled: false,
				listening: false,
				perfectDrawEnabled: false,
			},
		handles: selectionHandles(shape, selection, mode, worldPerPixel).map((handle) =>
			mark(handle.at, VERTEX_HANDLE_RADIUS_PX * worldPerPixel, handle.role.kind === 'box' ? 'square' : 'round', tokens),
		),
	};
}

/**
 * What `Shift+2` frames: a selected outline's curve-aware box, or the anchor or facing tip as a point
 * (`fitViewport` keeps the zoom and centres on a point). `null` — nothing to frame — with no
 * selection or for a part the shape does not have.
 */
export function selectionFrame(shape: AssetShape, selection: DesignerSelection | null, worldPerPixel: number): BoundingBox | null {
	if (selection === null) return null;
	if (!isOutlineSelection(selection)) {
		const at = pointOf(shape, selection, worldPerPixel);
		return { min: at, max: at };
	}
	const outline = outlineOf(shape, selection);
	return boundsOfZones(outline === null ? [] : [outline]);
}
