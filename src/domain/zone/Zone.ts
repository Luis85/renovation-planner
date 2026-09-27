import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import { createCurvedPolygon, type CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { area as polygonArea, isNegligibleArea, perimeter as polygonPerimeter } from '../../core/geometry/operations';
import type { Vector } from '../../core/geometry/Vector';
import { err, ok, type Result } from '../../core/result/Result';
import { isZoneStatus, type ZoneStatus } from './ZoneStatus';
import { isZoneType, type ZoneType } from './ZoneType';
import type { ProjectId } from '../project/ProjectId';
import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from './ZoneId';
import { zoneError } from './Zone.errors';
import { zoneName } from './ZoneName';
import { isItemColor, type ItemColor } from '../spatial/ItemColor';

export interface CreateZoneProps {
	readonly id: ZoneId;
	readonly planId: PlanId;
	/** Denormalized from `plan.projectId` at creation; `CreateZoneCommand` populates it. */
	readonly projectId: ProjectId;
	readonly name: string;
	readonly zoneType: ZoneType;
	readonly status?: ZoneStatus;
	readonly geometry: CurvedPolygon;
	readonly domainNoteLink?: string | null;
	/** Canvas click-through (ADR-0027). Absent means unlocked. */
	readonly locked?: boolean;
	/** Where its canvas caption was dragged, from the automatic anchor, world mm (ADR-0029). Absent or null is automatic. */
	readonly labelOffset?: Vector | null;
	/** User appearance on the canvas (plan colours design §1). Absent or null is the host's default. */
	readonly color?: ItemColor | null;
}

interface ZoneFields {
	readonly id: ZoneId;
	readonly planId: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly zoneType: ZoneType;
	readonly status: ZoneStatus;
	readonly geometry: CurvedPolygon;
	readonly domainNoteLink: string | null;
	readonly locked: boolean;
	readonly labelOffset: Vector | null;
	readonly color: ItemColor | null;
}

/**
 * The one rule a WRITTEN outline is held to beyond what `createCurvedPolygon` checks: it encloses
 * an area (L-23, owner ruling 34), and "an area" means one that is not negligible beside the
 * outline's own bounding box (ruling 36, `isNegligibleArea` — below a millionth of it is zero).
 *
 * **What the tolerance refuses**: an exact zero — a collinear outline, an even bowtie — and the
 * residue a corner snapped onto a SLANTED edge leaves, where the projection lands on a float and
 * the "collinear" triangle keeps about 1e-10 mm². **What it does not**: a thin but real room (1 mm
 * by 10 m turned 45° is about 2e-4 of its box), a small room of ordinary proportions, a repeated
 * corner around a real surface, and any curved outline the arcs' own box would pass — the box is
 * the corners', the permissive reading (see `isNegligibleArea`). A crossing outline is L-29's,
 * refused at the tool by `outlineCrosses`.
 *
 * An area `area` cannot represent is refused under its own `polygon-area-overflow` rather than
 * read as zero. `polygon-zero-area` is the code `areaOutline` raises for the same shape by the
 * same predicate, so the typed dialog and the write agree about which outlines exist. Neither code
 * has copy of its own; both read the Geometry category's sentence.
 *
 * Exported for ONE caller beyond this class: `PasteCommand` asks it of every Room a paste places
 * before the paste's first write (owner ruling 39), so a paste holding a room of no area is refused
 * whole rather than written and rolled back. `create` still asks it too, as the backstop.
 */
export function enclosingOutline(geometry: CurvedPolygon): Result<CurvedPolygon, GeometryError> {
	const checked = createCurvedPolygon(geometry);
	if (!checked.ok) return checked;
	const measured = polygonArea(checked.value);
	if (!measured.ok) return measured;
	if (!isNegligibleArea(checked.value, measured.value)) return checked;
	return err({ category: 'Geometry', code: 'polygon-zero-area', message: 'A zone outline must enclose an area.' });
}

/**
 * A spatial object on a plan (PRD §8). Immutable. `Polygon` is an UNVALIDATED interface
 * by design — an editor legitimately holds garbage mid-gesture — so the entity
 * re-validates its vertex set through Slice 2's own validator rather than trusting the
 * type: every path in — created, changed or loaded — is held to that validator's answer, and a
 * write is held to one rule more, below.
 *
 * **Creating and changing an outline are held to one rule more than loading one** (owner rulings
 * 34 and 35): `create` and `withGeometry` both go through `enclosingOutline`, while `fromStored`
 * — the zone mapper's read, and nothing else in `src/` (`tests/gates/zone-load-entry.test.ts`) —
 * does not, so a vault written before the rule still loads. Such a zone refuses every outline
 * change that leaves it without an area, which is what reaches it through `withGeometry`: a
 * drag, a form, a caption drag and a recolour (both restate the outline). A rename, a details
 * change, a lock and a delete never touch the outline and still pass, so it can be found and
 * removed.
 */
export class Zone {
	readonly id: ZoneId;
	readonly planId: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly zoneType: ZoneType;
	readonly status: ZoneStatus;
	readonly geometry: CurvedPolygon;
	readonly domainNoteLink: string | null;
	readonly locked: boolean;
	readonly labelOffset: Vector | null;
	readonly color: ItemColor | null;

	private constructor(fields: ZoneFields) {
		this.id = fields.id;
		this.planId = fields.planId;
		this.projectId = fields.projectId;
		this.name = fields.name;
		this.zoneType = fields.zoneType;
		this.status = fields.status;
		this.geometry = fields.geometry;
		this.domainNoteLink = fields.domainNoteLink;
		this.locked = fields.locked;
		this.labelOffset = fields.labelOffset;
		this.color = fields.color;
	}

	static create(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError> {
		return Zone.build(props, enclosingOutline);
	}

	/** The LOAD entry: a stored outline is not asked to enclose an area. See the class docblock. */
	static fromStored(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError> {
		return Zone.build(props, createCurvedPolygon);
	}

	private static build(
		props: CreateZoneProps,
		outline: (geometry: CurvedPolygon) => Result<CurvedPolygon, GeometryError>,
	): Result<Zone, ValidationError | GeometryError> {
		const name = zoneName(props.name);
		if (!name.ok) return name;
		if (!isZoneType(props.zoneType)) {
			return err(zoneError('unknown-type', `"${String(props.zoneType)}" is not a zone type.`));
		}
		if (!isZoneStatus(props.status ?? 'Planned')) {
			return err(zoneError('unknown-status', `"${String(props.status)}" is not a zone status.`));
		}
		if (props.color !== undefined && props.color !== null && !isItemColor(props.color)) {
			return err(zoneError('unknown-color', `"${String(props.color)}" is not a color.`));
		}
		// Copy both points and curve parameters so a caller cannot mutate the validated boundary.
		const geometry = outline(props.geometry);
		if (geometry.ok) {
			return ok(
				new Zone({
					id: props.id,
					planId: props.planId,
					projectId: props.projectId,
					name: name.value,
					zoneType: props.zoneType,
					status: props.status ?? 'Planned',
					geometry: geometry.value,
					domainNoteLink: props.domainNoteLink ?? null,
					locked: props.locked ?? false,
					labelOffset: props.labelOffset ?? null,
					color: props.color ?? null,
				}),
			);
		}
		return geometry;
	}

	withName(text: string): Result<Zone, ValidationError> {
		const name = zoneName(text);
		return name.ok ? ok(new Zone({ ...this.fields(), name: name.value })) : name;
	}

	withDetails(text: string, zoneType: ZoneType): Result<Zone, ValidationError> {
		const name = zoneName(text);
		if (!name.ok) return name;
		if (!isZoneType(zoneType)) return err(zoneError('unknown-type', 'Choose a supported area type.'));
		// Room identity owns renovation records and boundaries; metadata editing cannot reclassify it.
		if ((this.zoneType === 'Room') !== (zoneType === 'Room')) return err(zoneError('category-change', 'Room and Area identity cannot be exchanged by a metadata edit.'));
		return ok(new Zone({ ...this.fields(), name: name.value, zoneType }));
	}

	withGeometry(geometry: CurvedPolygon): Result<Zone, GeometryError> {
		const checked = enclosingOutline(geometry);
		if (checked.ok) {
			return ok(new Zone({ ...this.fields(), geometry: checked.value }));
		}
		return checked;
	}

	/** Lock or unlock; nothing about a lock can be invalid, so this answers a Zone rather than a Result. */
	withLocked(locked: boolean): Zone {
		return new Zone({ ...this.fields(), locked });
	}

	/** Move the canvas caption, or `null` to put it back at its automatic anchor; nothing about an offset can be invalid. */
	withLabelOffset(offset: Vector | null): Zone {
		return new Zone({ ...this.fields(), labelOffset: offset });
	}

	/** Recolour, or `null` for the host's default drawing; the type admits only a valid colour. */
	withColor(color: ItemColor | null): Zone {
		return new Zone({ ...this.fields(), color });
	}

	private fields(): ZoneFields {
		return {
			id: this.id,
			planId: this.planId,
			projectId: this.projectId,
			name: this.name,
			zoneType: this.zoneType,
			status: this.status,
			geometry: this.geometry,
			domainNoteLink: this.domainNoteLink,
			locked: this.locked,
			labelOffset: this.labelOffset,
			color: this.color,
		};
	}

	// PRD §8's "a Zone can expose derived length and area": public domain API. `area()`'s
	// first consumer is design slice 6's Inspector query (`GetZoneInspector`), so its
	// suppression is removed — the condition its own comment named. `perimeter()` still
	// has no consumer, so its suppression stays; see that method's own comment.
	/** mm², computed on demand from geometry — never a stored field to keep in sync. */
	area(): Result<number, GeometryError> {
		return polygonArea(this.geometry);
	}

	// Still unconsumed — nothing in src/ calls perimeter() yet. Suppressed here rather
	// than deleted: deleting it is how a declared capability rots.
	/** mm, computed on demand for the same reason. */
	// fallow-ignore-next-line unused-class-member
	perimeter(): Result<number, GeometryError> {
		return polygonPerimeter(this.geometry);
	}
}
