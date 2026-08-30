import type { Point } from '../../core/geometry/Point';
import type { PlanBackgroundRef } from '../../domain/plan/PlanBackgroundRef';
import type { Calibration } from '../../domain/plan/Calibration';
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
	/**
	 * How the plan's world units are established (SDD §25), `null` while it is
	 * uncalibrated and drawing at the placeholder scale of 1.
	 *
	 * It is on the DTO because the query side is the only thing that can supply it, and a
	 * consumer that needs it had no way to ask: `EditorContext.activePlan.calibration`
	 * declares this exact value to every tool, and the runtime filled it with a hard-coded
	 * `null` because this field did not exist — so any tool reading it would have measured
	 * a calibrated plan at the uncalibrated scale, with the type satisfied and no gate able
	 * to see it. A plain value object (two points and two numbers), so it stays as flat and
	 * serializable as the rest of this file.
	 */
	readonly calibration: Calibration | null;
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

/**
 * A plan as a LIST ROW sees it (design slice 21) — deliberately not `PlanDto`.
 *
 * A row needs neither the background, the calibration nor the layers, and handing a component
 * the full DTO makes it a consumer of fields it does not read: the next change to any of those
 * three would then have to reason about a list that never wanted them. `ProjectSummaryDto` is
 * the same distinction one entity up.
 */
export interface PlanSummaryDto {
	readonly id: string;
	readonly name: string;
}

export function toPlanDto(plan: Plan): PlanDto {
	return {
		id: plan.id,
		projectId: plan.projectId,
		name: plan.name,
		background: plan.background,
		calibration: plan.calibration,
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

export function toPlanSummaryDto(plan: Plan): PlanSummaryDto {
	return { id: plan.id, name: plan.name };
}
