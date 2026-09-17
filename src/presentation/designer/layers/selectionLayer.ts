import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { detailIsClosed, detailPolyline } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { ROTATION_HANDLE_OFFSET_PX, VERTEX_GRAB_RADIUS_PX, VERTEX_HANDLE_RADIUS_PX } from '../../editor/handleMetrics';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { boundsOfZones } from '../../editor/viewport/zoneExtent';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { selectionHandles, type HandleRole } from '../selection/handles';
import { facingTip } from './anchorLayer';
import { CLEARANCE_DASH_PX } from './clearanceLayer';
import { DETAIL_DASH_PX } from './detailsLayer';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * What the designer draws for its selection (symbols spec, Decision 10): the selected outline
 * restroked in the accent, in its part's own dash; a mark per handle the active mode offers, with
 * Transform's rotate handle drawn as the plan editor's curved arrow on a stem, the way Konva's
 * Transformer draws its rotater; and a ring, over a halo, on the anchor or the facing tip. Every mark is sized in SCREEN pixels on a
 * world-space layer, like `anchorLayer.ts`.
 *
 * **One Konva `Rect` per mark**, so the canvas renders a single `v-for` and never a `<template>`
 * fragment inside its `VLayer`: square with no `cornerRadius`, a diamond with `rotation`, round with
 * its radius as `cornerRadius`. vue-konva UNSETS a key a later config omits (`applyNodeProps`), so
 * `rotation` and `dash` are present only where they apply and a node reused across a mode or
 * selection change sheds them.
 */
export interface HandleMarkConfig {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	/** `0` for a box or bend handle; the radius for a round one, which makes the rect a circle. */
	readonly cornerRadius: number;
	/** `45` on a Bend edges handle, which turns its square into a diamond; absent on every other mark. */
	readonly rotation?: number;
	/** Absent on the anchor/facing ring and its halo, which must not hide the mark they surround. */
	readonly fill?: string;
	readonly stroke: string;
	readonly strokeWidth: number;
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
}

const SELECTED_STROKE_PX = 2;

/**
 * 2, not 1.5: a 1.5 px accent handle measured about 3.35:1 against the light theme's white canvas, on
 * WCAG 1.4.11's 3:1 floor, and a thicker stroke renders closer to the token's own colour (selection
 * polish critique, finding 19).
 */
const HANDLE_STROKE_PX = 2;

/** The ring is drawn at the GRAB radius, so it shows exactly the region a press will take. */
const RING_RADIUS_PX = VERTEX_GRAB_RADIUS_PX;

/**
 * A canvas-coloured band drawn BEFORE the ring, from 5 to 8 px out. The ring's 2 px stroke covers 7 to 9
 * px over it, so what reads is the 6 px anchor dot out to 5 px, then 2 px of canvas, then the ring — and
 * the facing's arrowhead stops short of the ring rather than tangling with it. A selected anchor read as a
 * slightly fatter dot without it (critique finding 8). The ring itself stays at the grab radius.
 */
const HALO_RADIUS_PX = 6.5;
const HALO_STROKE_PX = 3;

/** Which mark a handle wears: a box handle square, a bend handle a diamond (critique finding 17), a vertex round. The rotate handle is no mark but a `RotateMark`. */
const HANDLE_STYLE: Record<Exclude<HandleRole['kind'], 'rotate'>, 'square' | 'diamond' | 'round'> = { box: 'square', edge: 'diamond', vertex: 'round' };

/** Where the rotate arrow is drawn, and its stem down to the box's top-middle. */
export interface RotateMark {
	readonly at: Point;
	readonly stem: Omit<OutlineConfig, 'closed'>;
}

type MarkStyle = 'square' | 'diamond' | 'round' | 'ring' | 'halo';

type PointSelection = Exclude<DesignerSelection, { readonly kind: 'footprint' | 'clearance' | 'detail' }>;

function pointOf(shape: AssetShape, selection: PointSelection, worldPerPixel: number): Point {
	return selection.kind === 'anchor' ? shape.anchor : facingTip(shape, worldPerPixel);
}

function mark(at: Point, radius: number, style: MarkStyle, tokens: ThemeTokens): HandleMarkConfig {
	return {
		x: at.x,
		y: at.y,
		width: radius * 2,
		height: radius * 2,
		offsetX: radius,
		offsetY: radius,
		cornerRadius: style === 'square' || style === 'diamond' ? 0 : radius,
		...(style === 'diamond' ? { rotation: 45 } : {}),
		...(style === 'ring' || style === 'halo' ? {} : { fill: tokens.canvasBackground }),
		stroke: style === 'halo' ? tokens.canvasBackground : tokens.accent,
		strokeWidth: style === 'halo' ? HALO_STROKE_PX : HANDLE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}

/**
 * The selected part's own dash — the clearance's, or a `line: 'dashed'` detail's — so dashed keeps meaning
 * overhead or provisional while the part is edited (critique finding 7). `null` for a solid outline.
 */
function outlineDash(shape: AssetShape, part: OutlinePart): readonly number[] | null {
	if (part.kind === 'clearance') return CLEARANCE_DASH_PX;
	return part.kind === 'detail' && shape.details.some((detail) => detail.id === part.id && detail.line === 'dashed') ? DETAIL_DASH_PX : null;
}

/**
 * The selected part restroked in the accent. `closed` widens `OutlineConfig`'s literal `true` for
 * `DetailOutlineConfig`'s reason (AD11): the footprint and the clearance always close, and a detail
 * is the one outline on this surface that may not.
 */
export type SelectedOutlineConfig = Omit<OutlineConfig, 'closed'> & { readonly closed: boolean };

/**
 * The selected part's own drawable run, or `null` when the shape has not got it.
 *
 * **Both kinds, because a selected OPEN graphic used to be restroked as nothing at all.**
 * `outlineOf` answers `null` for a path by design, so the accent outline was simply absent — which
 * nothing could see while nothing could create one, and which AD11's line tool makes visible the
 * moment it draws one and selects it. A detail goes through `detailPolyline`, the kind-aware
 * approximation (`polygonPolyline` drops each segment's last point, so a path drawn through it
 * loses its final vertex); the footprint and the clearance always close.
 */
function selectedRun(
	shape: AssetShape,
	selection: OutlinePart,
	worldPerPixel: number,
): { readonly points: readonly Point[]; readonly closed: boolean } | null {
	const tolerance = ARC_TOLERANCE_PX * worldPerPixel;
	if (selection.kind === 'detail') {
		const detail = shape.details.find((found) => found.id === selection.id);
		return detail === undefined ? null : { points: detailPolyline(detail, tolerance), closed: detailIsClosed(detail) };
	}
	const outline = outlineOf(shape, selection);
	return outline === null ? null : { points: polygonPolyline(outline, tolerance), closed: true };
}

export function selectionMarks(
	shape: AssetShape | null,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	tokens: ThemeTokens,
	worldPerPixel: number,
): { readonly outline: SelectedOutlineConfig | null; readonly handles: readonly HandleMarkConfig[]; readonly rotate: RotateMark | null } {
	if (shape === null || selection === null) return { outline: null, handles: [], rotate: null };
	if (!isOutlineSelection(selection)) {
		const at = pointOf(shape, selection, worldPerPixel);
		return { outline: null, handles: [mark(at, HALO_RADIUS_PX * worldPerPixel, 'halo', tokens), mark(at, RING_RADIUS_PX * worldPerPixel, 'ring', tokens)], rotate: null };
	}
	const run = selectedRun(shape, selection, worldPerPixel);
	const dash = outlineDash(shape, selection);
	const handles = selectionHandles(shape, selection, mode, worldPerPixel);
	const rotate = handles.find((handle) => handle.role.kind === 'rotate');
	return {
		outline: run === null
			? null
			: {
				points: flatPoints(run.points),
				closed: run.closed,
				stroke: tokens.accent,
				strokeWidth: SELECTED_STROKE_PX,
				strokeScaleEnabled: false,
				listening: false,
				perfectDrawEnabled: false,
				...(dash === null ? {} : { dash: [...dash] }),
			},
		handles: handles.flatMap((handle) =>
			handle.role.kind === 'rotate' ? [] : [mark(handle.at, VERTEX_HANDLE_RADIUS_PX * worldPerPixel, HANDLE_STYLE[handle.role.kind], tokens)],
		),
		rotate: rotate === undefined
			? null
			: {
				at: rotate.at,
				stem: {
					points: [rotate.at.x, rotate.at.y + ROTATION_HANDLE_OFFSET_PX * worldPerPixel, rotate.at.x, rotate.at.y],
					stroke: tokens.accent,
					strokeWidth: 1,
					strokeScaleEnabled: false,
					listening: false,
					perfectDrawEnabled: false,
				},
			},
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
