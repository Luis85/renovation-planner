import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import type { Polygon } from '../../core/geometry/Polygon';
import { validatePolygonPoints } from '../../core/geometry/Polygon';
import { area as polygonArea, perimeter as polygonPerimeter } from '../../core/geometry/operations';
import { err, ok, type Result } from '../../core/result/Result';
import { isZoneStatus, type ZoneStatus } from './ZoneStatus';
import { isZoneType, type ZoneType } from './ZoneType';
import type { ProjectId } from '../project/ProjectId';
import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from './ZoneId';
import { zoneError } from './Zone.errors';

export interface CreateZoneProps {
	readonly id: ZoneId;
	readonly planId: PlanId;
	/** Denormalized from `plan.projectId` at creation; `CreateZoneCommand` populates it. */
	readonly projectId: ProjectId;
	readonly name: string;
	readonly zoneType: ZoneType;
	readonly status?: ZoneStatus;
	readonly geometry: Polygon;
	readonly domainNoteLink?: string | null;
}

interface ZoneFields {
	readonly id: ZoneId;
	readonly planId: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly zoneType: ZoneType;
	readonly status: ZoneStatus;
	readonly geometry: Polygon;
	readonly domainNoteLink: string | null;
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
	readonly geometry: Polygon;
	readonly domainNoteLink: string | null;

	private constructor(fields: ZoneFields) {
		this.id = fields.id;
		this.planId = fields.planId;
		this.projectId = fields.projectId;
		this.name = fields.name;
		this.zoneType = fields.zoneType;
		this.status = fields.status;
		this.geometry = fields.geometry;
		this.domainNoteLink = fields.domainNoteLink;
	}

	static create(props: CreateZoneProps): Result<Zone, ValidationError | GeometryError> {
		const name = props.name.trim();
		if (!name) {
			return err(zoneError('empty-name', 'A zone needs a non-empty name.'));
		}
		if (!isZoneType(props.zoneType)) {
			return err(zoneError('unknown-type', `"${String(props.zoneType)}" is not a zone type.`));
		}
		if (!isZoneStatus(props.status ?? 'Planned')) {
			return err(zoneError('unknown-status', `"${String(props.status)}" is not a zone status.`));
		}
		const checked = validatePolygonPoints(props.geometry.points);
		if (checked.ok) {
			return ok(
				new Zone({
					id: props.id,
					planId: props.planId,
					projectId: props.projectId,
					name,
					zoneType: props.zoneType,
					status: props.status ?? 'Planned',
					geometry: props.geometry,
					domainNoteLink: props.domainNoteLink ?? null,
				}),
			);
		}
		return checked;
	}

	withGeometry(geometry: Polygon): Result<Zone, GeometryError> {
		const checked = validatePolygonPoints(geometry.points);
		if (checked.ok) {
			return ok(new Zone({ ...this.fields(), geometry }));
		}
		return checked;
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
		};
	}

	// PRD §8's "a Zone can expose derived length and area": public domain API whose first
	// consumer is slice 9's quantity engine / slice 8's inspector, so nothing in src/
	// calls either yet. Suppressed here rather than deleted — deleting them is how a
	// declared capability rots.
	/** mm², computed on demand from geometry — never a stored field to keep in sync. */
	// fallow-ignore-next-line unused-class-member
	area(): Result<number, GeometryError> {
		return polygonArea(this.geometry);
	}

	/** mm, computed on demand for the same reason. */
	// fallow-ignore-next-line unused-class-member
	perimeter(): Result<number, GeometryError> {
		return polygonPerimeter(this.geometry);
	}
}
