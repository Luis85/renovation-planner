import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import { createCurvedPolygon, type CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { area as polygonArea, perimeter as polygonPerimeter } from '../../core/geometry/operations';
import { err, ok, type Result } from '../../core/result/Result';
import { isZoneStatus, type ZoneStatus } from './ZoneStatus';
import { isZoneType, type ZoneType } from './ZoneType';
import type { ProjectId } from '../project/ProjectId';
import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from './ZoneId';
import { zoneError } from './Zone.errors';
import { zoneName } from './ZoneName';

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
}

/**
 * A spatial object on a plan (PRD §8). Immutable. `Polygon` is an UNVALIDATED interface
 * by design — an editor legitimately holds garbage mid-gesture — so the entity
 * re-validates its vertex set through Slice 2's own validator rather than trusting the
 * type, and every path into a stored geometry gets the identical answer.
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
	}

	static create(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError> {
		const name = zoneName(props.name);
		if (!name.ok) return name;
		if (!isZoneType(props.zoneType)) {
			return err(zoneError('unknown-type', `"${String(props.zoneType)}" is not a zone type.`));
		}
		if (!isZoneStatus(props.status ?? 'Planned')) {
			return err(zoneError('unknown-status', `"${String(props.status)}" is not a zone status.`));
		}
		// Copy both points and curve parameters so a caller cannot mutate the validated boundary.
		const geometry = createCurvedPolygon(props.geometry);
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
		const checked = createCurvedPolygon(geometry);
		if (checked.ok) {
			return ok(new Zone({ ...this.fields(), geometry: checked.value }));
		}
		return checked;
	}

	/** Lock or unlock; nothing about a lock can be invalid, so this answers a Zone rather than a Result. */
	withLocked(locked: boolean): Zone {
		return new Zone({ ...this.fields(), locked });
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
