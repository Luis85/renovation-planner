import type { Point } from '../../core/geometry/Point';
import type { PlanBackgroundRef } from '../../domain/plan/PlanBackgroundRef';
import type { Plan } from '../../domain/plan/Plan';
import type { Project } from '../../domain/project/Project';
import type { Zone } from '../../domain/zone/Zone';

/**
 * The presentation-facing read models (SDD §35): flat, serializable, no domain methods,
 * nothing a Vue component or a Pinia store has to know an entity to read.
 *
 * **These are not slice 4's `*FrontmatterDTO` family**, and the naming is what keeps the
 * two apart: those are shape-of-STORAGE types that per §37 never leave an Obsidian
 * repository, and two different things called "the Plan DTO" in one codebase is a real
 * hazard. `*FrontmatterDTO` for storage, `*Dto` for presentation, and the mappers below
 * are the only bridge between an entity and either.
 *
 * A DTO is produced here rather than declared beside its consumer, per the rule that a
 * type belongs with the code that PRODUCES it: putting `ZoneDto` in the store that reads
 * it would make that store the owner of a shape the query boundary decides.
 */
export interface PlanDto {
	readonly id: string;
	readonly projectId: string;
	readonly name: string;
	readonly background: PlanBackgroundRef | null;
	readonly layers: readonly string[];
}

export interface ZoneDto {
	readonly id: string;
	readonly planId: string;
	readonly name: string;
	readonly zoneType: string;
	readonly status: string;
	/** World millimetres, straight from `Zone.geometry` — never screen coordinates. */
	readonly points: readonly Point[];
}

export interface ProjectSummaryDto {
	readonly id: string;
	readonly name: string;
	readonly status: string;
}

export function toPlanDto(plan: Plan): PlanDto {
	return {
		id: plan.id,
		projectId: plan.projectId,
		name: plan.name,
		background: plan.background,
		layers: plan.layers,
	};
}

export function toZoneDto(zone: Zone): ZoneDto {
	return {
		id: zone.id,
		planId: zone.planId,
		name: zone.name,
		zoneType: zone.zoneType,
		status: zone.status,
		// Copied, not aliased. The entity's own array is frozen only by convention, and a
		// render model handed the same reference would let a later slice's edit reach back
		// into a loaded entity — the one direction the read pipeline must not have.
		points: [...zone.geometry.points],
	};
}

export function toProjectSummaryDto(project: Project): ProjectSummaryDto {
	return { id: project.id, name: project.name, status: project.status };
}
