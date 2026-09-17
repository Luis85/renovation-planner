import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, isErr, type Result } from '../../../core/result/Result';
import { assetError } from '../Asset.errors';
import type { DetailLine } from '../AssetDetail';
import { validateAssetShape, type AssetShape } from '../AssetShape';

/**
 * Preset generators (asset designer symbols spec, Decision 8): typed values in, a validated
 * `AssetShape` out. Pure domain — no text; the presentation labels ids and field keys, and both are
 * closed unions so a missing label is a build error.
 *
 * CONVENTIONS every generator here keeps: centred on the origin; front toward +y (`PRESET_FACING`),
 * so a wall snap puts the back (−y) against the wall; outlines wound top-left → top-right →
 * bottom-right → bottom-left, with which a POSITIVE bulge bows outward.
 */
export type PresetId =
	| 'rect-table' | 'round-table' | 'oval-table' | 'curved-table'
	| 'chair' | 'armchair' | 'sofa'
	| 'toilet' | 'washbasin' | 'shower-tray' | 'bathtub'
	| 'tree' | 'shrub' | 'bed';
export type PresetGroup = 'tables' | 'seating' | 'sanitary' | 'plants-beds';
export type PresetFieldKey = 'width' | 'depth' | 'diameter' | 'length' | 'radius' | 'sweep' | 'seats' | 'canopy' | 'trunk' | 'pillows';

export interface PresetField {
	readonly key: PresetFieldKey;
	/** `length` is millimetres, `angle` degrees, `count` a whole number. */
	readonly kind: 'length' | 'count' | 'angle';
	readonly min: number;
	readonly max: number;
	readonly default: number;
}

export type PresetValues = Readonly<Partial<Record<PresetFieldKey, number>>>;

export interface PresetDrawing {
	readonly footprint: CurvedPolygon;
	readonly clearance: CurvedPolygon | null;
	readonly details: readonly { readonly name: string; readonly outline: CurvedPolygon; readonly line?: DetailLine }[];
}

export interface AssetPreset {
	readonly id: PresetId;
	readonly group: PresetGroup;
	readonly fields: readonly PresetField[];
	build(values: PresetValues): Result<AssetShape, ValidationError>;
}

const PRESET_FACING = Math.PI / 2;

export function defaultValues(preset: AssetPreset): PresetValues {
	return Object.fromEntries(preset.fields.map((field) => [field.key, field.default]));
}

export const incoherent = (message: string): Result<never, ValidationError> => err(assetError('preset-incoherent', message));

function outOfRange(id: PresetId, fields: readonly PresetField[], values: PresetValues): ValidationError | null {
	for (const field of fields) {
		const value = values[field.key];
		const whole = field.kind !== 'count' || Number.isInteger(value);
		if (value === undefined || !Number.isFinite(value) || value < field.min || value > field.max || !whole) {
			return assetError('preset-value-out-of-range', `${id}.${field.key} must be within ${field.min}–${field.max}; got ${String(value)}.`);
		}
	}
	return null;
}

/** Range-checks the values, draws, and composes the typed shape every preset answers. */
export function definePreset(
	id: PresetId,
	group: PresetGroup,
	fields: readonly PresetField[],
	draw: (value: (key: PresetFieldKey) => number) => Result<PresetDrawing, ValidationError>,
): AssetPreset {
	return {
		id,
		group,
		fields,
		build(values) {
			const refused = outOfRange(id, fields, values);
			if (refused !== null) return err(refused);
			// `outOfRange` has checked every declared key, so only a generator asking for an undeclared
			// one reads `undefined` here — and `Number` makes that the NaN validation refuses.
			const drawing = draw((key) => Number(values[key]));
			if (isErr(drawing)) return drawing;
			return validateAssetShape({
				footprint: drawing.value.footprint,
				footprintOrigin: 'typed',
				footprintPending: false,
				clearancePending: false,
				anchorPending: false,
				clearance: drawing.value.clearance,
				anchor: { x: 0, y: 0 },
				facing: PRESET_FACING,
				details: drawing.value.details.map((detail, index) => ({
					id: `detail-${index + 1}`,
					name: detail.name,
					outline: detail.outline,
					line: detail.line ?? 'solid',
					pending: false,
				})),
			});
		},
	};
}

export function rect(width: number, depth: number, cx = 0, cy = 0): CurvedPolygon {
	const halfWidth = width / 2, halfDepth = depth / 2;
	return {
		points: [
			{ x: cx - halfWidth, y: cy - halfDepth },
			{ x: cx + halfWidth, y: cy - halfDepth },
			{ x: cx + halfWidth, y: cy + halfDepth },
			{ x: cx - halfWidth, y: cy + halfDepth },
		],
	};
}

/** The area a person needs in front of an object: its own footprint extended `reach` toward +y. */
export const frontClearance = (width: number, depth: number, reach: number): CurvedPolygon => rect(width, depth + reach, 0, reach / 2);

/** `count` points on a circle from the top, clockwise on screen, every edge bulged by `bulge`. */
function ring(radius: number, count: number, bulge: number, cx: number, cy: number): CurvedPolygon {
	const points = Array.from({ length: count }, (_, index) => {
		const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
		return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
	});
	return { points, bulges: points.map(() => bulge) };
}

const QUARTER_BULGE = Math.tan(Math.PI / 8);
export const circle = (diameter: number, cx = 0, cy = 0): CurvedPolygon => ring(diameter / 2, 4, QUARTER_BULGE, cx, cy);

/** A scalloped outline inside a circle of `diameter`: lobes on a smaller ring, bowed outward, peaks under the circle. */
const LOBE_RING = 0.85;
const LOBE_BULGE = 0.35;
export const lobed = (diameter: number, lobes: number, cx = 0, cy = 0): CurvedPolygon => ring((diameter / 2) * LOBE_RING, lobes, LOBE_BULGE, cx, cy);

/** Two semicircles joined by straight sides, along whichever axis is longer; exact, not approximated. */
export function stadium(sizeX: number, sizeY: number, cx = 0, cy = 0): CurvedPolygon {
	if (sizeX === sizeY) return circle(sizeX, cx, cy);
	if (sizeX > sizeY) {
		const radius = sizeY / 2, straight = sizeX / 2 - radius;
		return { points: rect(2 * straight, sizeY, cx, cy).points, bulges: [0, 1, 0, 1] };
	}
	const radius = sizeX / 2, straight = sizeY / 2 - radius;
	return { points: rect(sizeX, 2 * straight, cx, cy).points, bulges: [1, 0, 1, 0] };
}

/** A rectangle whose front (+y) edge is a semicircle across its full width. Needs `depth > width / 2`. */
export function roundFront(width: number, depth: number): CurvedPolygon {
	const half = width / 2, back = -depth / 2, shoulder = depth / 2 - half;
	return {
		points: [{ x: -half, y: back }, { x: half, y: back }, { x: half, y: shoulder }, { x: -half, y: shoulder }],
		bulges: [0, 0, 1, 0],
	};
}

/**
 * A band between two concentric arcs, convex side toward +y, vertically centred on the origin.
 * Needs `depth < outerRadius` and `sweepDegrees <= 180` (a bulge above 1 is refused).
 */
export function ringSector(outerRadius: number, depth: number, sweepDegrees: number): CurvedPolygon {
	const inner = outerRadius - depth, half = (sweepDegrees * Math.PI) / 360;
	const sin = Math.sin(half), cos = Math.cos(half), bulge = Math.tan(half / 2);
	const centre = (outerRadius + inner * cos) / 2;
	return {
		points: [
			{ x: -inner * sin, y: inner * cos - centre },
			{ x: inner * sin, y: inner * cos - centre },
			{ x: outerRadius * sin, y: outerRadius * cos - centre },
			{ x: -outerRadius * sin, y: outerRadius * cos - centre },
		],
		bulges: [-bulge, 0, bulge, 0],
	};
}

/**
 * A rectangle whose four corners are EXACT quarter circles of `radius` — the same `QUARTER_BULGE`
 * a circle is drawn from, so a corner is a circular arc rather than an approximation of one
 * (C04: "reusing circular arc representation where exact").
 *
 * Eight points, wound as `rect` winds four, with a corner arc on every second edge. `radius` must
 * be positive and strictly under half the shorter side; at exactly half, two of the eight points
 * coincide, and above it the outline crosses itself. **Nothing here checks that**, deliberately:
 * the only caller derives the radius FROM the sides (`roundedRectOutline`, AD11), so an
 * out-of-range value is unreachable from the product, and a guard nothing can drive costs a branch
 * it can never pay back. What a caller handing one in would get is `createCurvedPolygon`'s own
 * refusal, through `validateAssetShape`, which is where every other geometry rule is already asked.
 *
 * No radius is STORED anywhere (AD11, item 2): what is written is ordinary points and bulges, which
 * is the answer presets already give. A later edit therefore maintains nothing — a nonuniform
 * resize keeps each corner's bulge through its new chord, which is r1's stated approximation rather
 * than a circle, and the existing bend handle edits a corner like any other curved edge.
 */
export function roundedRect(width: number, depth: number, radius: number, cx = 0, cy = 0): CurvedPolygon {
	const halfWidth = width / 2, halfDepth = depth / 2;
	const [left, right, top, bottom] = [cx - halfWidth, cx + halfWidth, cy - halfDepth, cy + halfDepth];
	return {
		points: [
			{ x: left + radius, y: top }, { x: right - radius, y: top },
			{ x: right, y: top + radius }, { x: right, y: bottom - radius },
			{ x: right - radius, y: bottom }, { x: left + radius, y: bottom },
			{ x: left, y: bottom - radius }, { x: left, y: top + radius },
		],
		bulges: [0, QUARTER_BULGE, 0, QUARTER_BULGE, 0, QUARTER_BULGE, 0, QUARTER_BULGE],
	};
}
