import type { Point } from '../../../../core/geometry/Point';
import type { ZoneDto } from '../../../read-models/PlanDto';
import type { StringKey } from '../../../i18n/locales/en';
import type { ThemeTokenName } from '../../theme/themeTokens';

/**
 * The render model half of SDD §16's pipeline:
 *
 *   Zone → ZoneDto → **ZoneRenderModel** → ZoneShape → vue-konva → Konva node
 *
 * Pure, presentation-only, and mutating nothing. `points` stay world millimetres all the
 * way to `<v-line>` — pan and zoom are the content `Group`'s transform, not a per-vertex
 * conversion — so this mapping is a function of the persisted geometry ALONE and does not
 * take a `Viewport` at all.
 *
 * `id` is the `ZoneId`, never a Konva node reference: §16's rule that a Konva object is
 * never canonical starts by never being an identity either.
 */
export interface ZoneRenderModel {
	readonly id: string;
	readonly zoneType: string;
	readonly status: string;
	/** The zone's name, as drawn on the canvas. */
	readonly label: string;
	/** World millimetres. */
	readonly points: readonly Point[];
}

export function toZoneRenderModel(zone: ZoneDto): ZoneRenderModel {
	return {
		id: zone.id,
		zoneType: zone.zoneType,
		status: zone.status,
		label: zone.name,
		// The DTO's own array, passed through unchanged rather than copied: this reference
		// is what `<v-line>`'s `points` receives, and DoD 5 asserts it is IDENTICAL across
		// a pan — which is the check that the viewport transform really lives on the Group
		// and not in a per-vertex conversion someone reintroduced.
		points: zone.points,
	};
}

/**
 * Zone type → the theme token its fill is resolved from. A `Record` over the vocabulary
 * rather than a `switch`, so adding a `ZoneType` that nothing here answers for is a
 * compile error in slice 3's own file instead of a silent default here.
 */
const ZONE_TYPE_TOKENS: Readonly<Record<string, ThemeTokenName>> = {
	Room: 'zoneRoom',
	Garden: 'zoneGarden',
	Terrace: 'zoneTerrace',
	Driveway: 'zoneDriveway',
	Roof: 'zoneRoof',
	ConstructionArea: 'zoneConstructionArea',
	Custom: 'zoneCustom',
};

/**
 * A `ZoneDto.status`/`zoneType` is a plain `string`, not the domain union — that widening
 * is what a flat read model is FOR, and it is also why both lookups need an answer for a
 * value outside the vocabulary. A zone whose note was hand-edited to an unknown type
 * still has to draw, in the generic appearance, rather than throw inside a render.
 */
export function zoneFillToken(zoneType: string): ThemeTokenName {
	return ZONE_TYPE_TOKENS[zoneType] ?? 'zoneCustom';
}

/**
 * Status, rendered as something OTHER than colour — §85's "status not encoded only by
 * color", set now so slice 6 does not have to retrofit it once zones become interactive.
 *
 * Two non-colour channels, because each fails differently: the dash pattern survives a
 * grayscale print and a colour-blind reader, and the caption survives a zoom level at
 * which a dash pattern is indistinguishable. Dash lengths are in SCREEN pixels, not world
 * millimetres, because the stroke they belong to sets `strokeScaleEnabled: false`.
 */
export interface StatusAppearance {
	readonly dash: readonly number[];
	readonly captionKey: StringKey;
}

const STATUS_APPEARANCE: Readonly<Record<string, StatusAppearance>> = {
	Planned: { dash: [6, 4], captionKey: 'zone.status.planned' },
	InProgress: { dash: [12, 4, 2, 4], captionKey: 'zone.status.in-progress' },
	Complete: { dash: [], captionKey: 'zone.status.complete' },
};

const UNKNOWN_STATUS: StatusAppearance = { dash: [2, 2], captionKey: 'zone.status.unknown' };

export function statusAppearance(status: string): StatusAppearance {
	return STATUS_APPEARANCE[status] ?? UNKNOWN_STATUS;
}

/**
 * Where a zone's caption sits: the top-left of its own bounding box, in world
 * millimetres, so the text rides the content Group's transform like every other
 * world-space node instead of being positioned in pixels.
 *
 * An empty point list answers the origin rather than `NaN` from `Math.min()` of nothing —
 * a Polygon is unvalidated by design (slice 2), so a render model legitimately arrives
 * holding one.
 */
export function labelAnchor(points: readonly Point[]): Point {
	if (points.length === 0) return { x: 0, y: 0 };
	return {
		x: Math.min(...points.map((point) => point.x)),
		y: Math.min(...points.map((point) => point.y)),
	};
}
