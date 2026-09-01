import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { POLYGON_CLOSE_TARGET_RADIUS_PX } from '../../editor/handleMetrics';

/**
 * Where an asset is PLACED and which way it FACES (design slice B4) — the two scalars of
 * `AssetShape` that have no extent of their own and would otherwise be invisible.
 *
 * **Both marks are sized in SCREEN pixels and positioned in world millimetres**, which is the
 * plan editor's convention and the reason every function here takes `worldPerPixel`. These
 * nodes live on a world-space layer carrying the camera's transform, so a radius of
 * `n × worldPerScreenPixel()` renders as exactly `n` pixels at any zoom. The alternative — a
 * world-fixed radius — is `POLYGON_CLOSE_GRAB_RADIUS_PX`'s own recorded first defect: 25 mm is
 * a 2.5 px target at the default zoom and goes sub-pixel when zoomed out.
 *
 * `worldPerPixel` is a PARAMETER rather than something derived here, so that the value comes
 * from `worldPerScreenPixel(viewport, STAGE_PIXELS)` — the one statement of the camera's
 * inverse. CLAUDE.md records three tools each deriving it by projecting `(0,0)` and `(1,0)`
 * back through `screenToWorld` and subtracting, which is a third copy of the transform and
 * loses low-order bits of exactly the quantity being measured on a far-panned canvas.
 */
export interface AnchorMarkConfig {
	readonly x: number;
	readonly y: number;
	/** World millimetres, computed so the mark is a constant number of screen pixels. */
	readonly radius: number;
	readonly fill: string;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
}

export interface FacingConfig {
	readonly points: number[];
	readonly stroke: string;
	readonly strokeWidth: number;
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
	readonly closed?: boolean;
	readonly fill?: string;
}

/**
 * The anchor is drawn at `POLYGON_CLOSE_TARGET_RADIUS_PX` rather than at the smaller
 * `VERTEX_HANDLE_RADIUS_PX`, and the reason is the one `handleMetrics.ts` gives for that pair
 * existing at all: the larger mark is the DISTINGUISHED point. An asset has exactly one anchor
 * — the point a plan positions it by — where a polygon has many ordinary vertices.
 *
 * Taken from that module rather than declared here, because a mark's drawn size and the region
 * that acts on it are numbers that must stay in a known relationship, and Task B5's set-anchor
 * tool is what will need the grab radius beside it.
 */
const ANCHOR_RADIUS_PX = POLYGON_CLOSE_TARGET_RADIUS_PX;

/**
 * How far the facing arrow reaches, in screen pixels, and the size of its head.
 *
 * Declared here rather than in `handleMetrics.ts`, which is deliberate: that module is about
 * vertex marks and the regions that GRAB them, and nothing grabs this arrow — Task B5's
 * set-facing tool takes a drag anywhere on the canvas and reads its direction. A length in a
 * module about grab targets would invite the next author to treat it as one.
 */
const FACING_LENGTH_PX = 44;
const FACING_HEAD_PX = 10;
const FACING_STROKE_PX = 1.5;

export function anchorMark(
	shape: AssetShape | null,
	tokens: ThemeTokens,
	worldPerPixel: number,
): AnchorMarkConfig | null {
	if (shape === null) return null;
	return {
		x: shape.anchor.x,
		y: shape.anchor.y,
		radius: ANCHOR_RADIUS_PX * worldPerPixel,
		fill: tokens.accent,
		listening: false,
		perfectDrawEnabled: false,
	};
}

/**
 * The facing, as a shaft from the anchor and a filled head at its far end.
 *
 * **The head is not decoration.** A bare segment leaving a dot says which LINE the asset is on
 * and not which of its two directions is forward, and `facing` is a direction: `AssetShape`
 * normalises it to `[0, 2π)` precisely because `0` and `π` are different assets. Two configs
 * from one call rather than two exported functions, so a caller cannot draw one without the
 * other and there is one null arm rather than two that could disagree.
 *
 * Anticlockwise from +x, matching `AssetShape.facing`'s own statement of what the number means,
 * and the y term is ADDED rather than subtracted: the canvas and the domain share one
 * coordinate sense here, so the arrow agrees with the number a tool will write.
 *
 * **The trigonometry is left as it falls, and `exactOnAxis`'s repair is deliberately not
 * applied.** `Math.cos(Math.PI / 2)` is 6.1e-17, so a quarter-turn arrow's tip is that far off
 * the axis in world millimetres — sub-nanometre, and invisible. CLAUDE.md records that
 * repair being worth its existence where a coordinate reaches an EXACT-EQUALITY guard (the
 * drawing tool's duplicate-vertex check, which appended a twin); nothing compares these
 * coordinates to anything. Restoring an exact axis value here would be correcting a
 * representation error nobody can observe, in a module that would then own a copy of a rule
 * `snap-service.ts` states.
 */
export function facingArrow(
	shape: AssetShape | null,
	tokens: ThemeTokens,
	worldPerPixel: number,
): { readonly shaft: FacingConfig; readonly head: FacingConfig } | null {
	if (shape === null) return null;
	const dx = Math.cos(shape.facing);
	const dy = Math.sin(shape.facing);
	const { x, y } = shape.anchor;
	const length = FACING_LENGTH_PX * worldPerPixel;
	const head = FACING_HEAD_PX * worldPerPixel;
	const tipX = x + dx * length;
	const tipY = y + dy * length;
	// The head's base, and the two barbs either side of it on the perpendicular `(-dy, dx)`.
	const baseX = tipX - dx * head;
	const baseY = tipY - dy * head;
	const halfWidth = head / 2;
	return {
		shaft: {
			points: [x, y, tipX, tipY],
			stroke: tokens.accent,
			strokeWidth: FACING_STROKE_PX,
			strokeScaleEnabled: false,
			listening: false,
			perfectDrawEnabled: false,
		},
		head: {
			points: [
				tipX,
				tipY,
				baseX - dy * halfWidth,
				baseY + dx * halfWidth,
				baseX + dy * halfWidth,
				baseY - dx * halfWidth,
			],
			stroke: tokens.accent,
			strokeWidth: FACING_STROKE_PX,
			strokeScaleEnabled: false,
			listening: false,
			perfectDrawEnabled: false,
			closed: true,
			fill: tokens.accent,
		},
	};
}
