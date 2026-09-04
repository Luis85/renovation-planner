import type { PlanDto, ZoneDto } from './PlanDto';
import { toSpatialRecordDto, type SpatialRecordDto } from './spatialRecords';

/**
 * The Inspector sections the locked screens name and this build has no data for. A CLOSED
 * union rather than free text, so a section that gains a query is removed from
 * `buildRoomOverview`'s list in the same edit that builds it — and a typo is a compile error.
 * Requirements are not here: they have a query and a panel, so they are a supported section.
 */
export const INSPECTOR_SECTIONS = ['existing', 'planned', 'work', 'costs', 'documents', 'photos', 'notes'] as const;
export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];

export interface RoomOverviewDto {
	readonly record: SpatialRecordDto;
	readonly floorName: string;
	/** Which sections are UNAVAILABLE (no capability), as opposed to supported-and-empty. */
	readonly unavailableSections: readonly InspectorSection[];
}

export function buildRoomOverview(zone: ZoneDto, plan: PlanDto): RoomOverviewDto {
	return { record: toSpatialRecordDto(zone), floorName: plan.name, unavailableSections: INSPECTOR_SECTIONS };
}
