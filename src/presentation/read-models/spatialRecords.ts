import type { Point } from '../../core/geometry/Point';
import type { SpatialElementKind } from '../../domain/spatial/SpatialElement';
import { area } from '../../core/geometry/operations';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from './PlanDto';

/**
 * The homeowner-facing projection of a zone (ADR-0016): a `Zone` typed `Room` is a Room,
 * every other type is an Area, and the id is the `ZoneId` unchanged. Area is DERIVED here
 * from the geometry the DTO already carries; it is never stored and never copied from a note.
 */
export type SpatialKind = 'room' | 'area' | 'wall' | 'opening' | SpatialElementKind;

export interface SpatialRecordDto {
	readonly kind: SpatialKind;
	readonly id: string;
	readonly planId: string;
	readonly name: string;
	readonly zoneType: string;
	/** World millimetres, straight from the `ZoneDto`. */
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
	readonly hitPoints?: readonly Point[];
	readonly areaMm2: number;
}

export function toSpatialRecordDto(zone: ZoneDto): SpatialRecordDto {
	const measured = area(zone);
	return {
		kind: zone.zoneType === 'Room' ? 'room' : 'area',
		id: zone.id,
		planId: zone.planId,
		name: zone.name,
		zoneType: zone.zoneType,
		points: zone.points,
		bulges: zone.bulges,
		// A polygon Core refuses has no area; 0 is the honest figure and the canvas still draws
		// whatever points it has, which is `boundsOfZones`'s own rule for a degenerate zone.
		areaMm2: measured.ok ? measured.value : 0,
	};
}

/** The plan under its homeowner name (ADR-0017), beside the project that owns it. */
export interface FloorDto {
	readonly id: string;
	readonly name: string;
	readonly projectId: string;
	readonly projectName: string;
}

export function toFloorDto(plan: PlanDto, project: ProjectSummaryDto): FloorDto {
	return { id: plan.id, name: plan.name, projectId: project.id, projectName: project.name };
}

/**
 * A summary figure that says how much it knows. `partial` is a value over what was READ, with
 * the number of records that were not; `unavailable` is a capability this build does not have.
 * A component renders the three differently, and a `0` never stands in for either of the others.
 */
export type Aggregate<T> =
	| { readonly state: 'available'; readonly value: T }
	| { readonly state: 'partial'; readonly value: T; readonly unreadable: number }
	| { readonly state: 'unavailable' };

export interface FloorSummaryDto {
	readonly floor: FloorDto;
	readonly roomCount: Aggregate<number>;
	readonly areaCount: Aggregate<number>;
	readonly totalAreaMm2: Aggregate<number>;
	/** Changes are sourced from the owning Plan's accepted renovation register. */
	readonly plannedChanges: Aggregate<number>;
	/** Capability fallback; connected cost summaries use the planning reconciliation projection. */
	readonly estimatedCost: Aggregate<never>;
	readonly rooms: readonly SpatialRecordDto[];
	readonly areas: readonly SpatialRecordDto[];
}

function counted(value: number, unreadable: number): Aggregate<number> {
	return unreadable > 0 ? { state: 'partial', value, unreadable } : { state: 'available', value };
}

export function buildFloorSummary(input: {
	readonly plan: PlanDto;
	readonly project: ProjectSummaryDto;
	readonly zones: readonly ZoneDto[];
	readonly unreadable: number;
}): FloorSummaryDto {
	const records = input.zones.map(toSpatialRecordDto);
	const rooms = records.filter((record) => record.kind === 'room');
	const areas = records.filter((record) => record.kind === 'area');
	const total = records.reduce((sum, record) => sum + record.areaMm2, 0);
	return {
		floor: toFloorDto(input.plan, input.project),
		roomCount: counted(rooms.length, input.unreadable),
		areaCount: counted(areas.length, input.unreadable),
		totalAreaMm2: counted(total, input.unreadable),
		plannedChanges: counted(input.plan.renovation?.subjects.filter(item => item.planned && item.planned.change !== 'unchanged').length ?? 0, input.unreadable),
		estimatedCost: { state: 'unavailable' },
		rooms,
		areas,
	};
}
