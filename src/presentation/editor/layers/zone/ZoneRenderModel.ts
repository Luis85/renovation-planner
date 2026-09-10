import type { Point } from '../../../../core/geometry/Point';
import type { ZoneDto } from '../../../read-models/PlanDto';
import type { StringKey } from '../../../i18n/locales/en';
import type { ThemeTokenName } from '../../theme/themeTokens';
import { centroid, contains } from '../../../../core/geometry/operations';
import { toSpatialRecordDto } from '../../../read-models/spatialRecords';

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
	/** Calculated from the same geometry as Inspector area; never a stored value. */
	readonly areaMm2: number;
	/** World millimetres. */
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}

export function toZoneRenderModel(zone: ZoneDto): ZoneRenderModel {
	return {
		id: zone.id,
		zoneType: zone.zoneType,
		status: zone.status,
		label: zone.name,
		areaMm2: toSpatialRecordDto(zone).areaMm2,
		// The DTO's own array, passed through unchanged rather than copied: this reference
		// is what `<v-line>`'s `points` receives, and DoD 5 asserts it is IDENTICAL across
		// a pan — which is the check that the viewport transform really lives on the Group
		// and not in a per-vertex conversion someone reintroduced.
		points: zone.points,
		bulges: zone.bulges,
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
 * Status, as a caption key the INSPECTOR reads. It stopped drawing on the canvas on
 * 2026-09-10 (canvas fidelity spec): M01 draws a room as name and area over a wall, and
 * the room list beside it carries the status. §85's "status not encoded only by colour"
 * survives that by having no status channel on the canvas to encode.
 */
export interface StatusAppearance {
	readonly captionKey: StringKey;
}

const STATUS_APPEARANCE: Readonly<Record<string, StatusAppearance>> = {
	Planned: { captionKey: 'zone.status.planned' },
	InProgress: { captionKey: 'zone.status.in-progress' },
	Complete: { captionKey: 'zone.status.complete' },
};

const UNKNOWN_STATUS: StatusAppearance = { captionKey: 'zone.status.unknown' };

export function statusAppearance(status: string): StatusAppearance {
	return STATUS_APPEARANCE[status] ?? UNKNOWN_STATUS;
}

/**
 * Captions sit inside the geometry in world millimetres. A concave polygon can have an
 * exterior centroid; in that case use its first boundary vertex rather than label another
 * room. Both calculations use Core's geometry authority and leave geometry untouched.
 *
 * An empty point list answers the origin rather than `NaN` from `Math.min()` of nothing —
 * a Polygon is unvalidated by design (slice 2), so a render model legitimately arrives
 * holding one.
 */
export function labelAnchor(points: readonly Point[], bulges?: readonly number[]): Point {
	if (points.length === 0) return { x: 0, y: 0 };
	const center = centroid({ points, bulges });
	if (!center.ok) return points[0];
	const inside = contains({ points, bulges }, center.value);
	return inside.ok && inside.value ? center.value : points[0];
}
