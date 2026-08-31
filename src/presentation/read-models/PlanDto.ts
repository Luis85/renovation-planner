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
	/**
	 * PRD §83: this project's DERIVED folder is the library folder, contains it, or sits
	 * inside it.
	 *
	 * It is on the summary rather than looked up by the row, because a `ProjectSummaryDto`
	 * carries no path and the comparison needs one — the same reason `openProject` takes an
	 * id and the composition root resolves the note. Required rather than optional: an
	 * absent flag and a `false` one read identically at the `v-if` that renders the marker,
	 * so every producer of a summary states the answer instead of one of them silently
	 * meaning "not asked".
	 *
	 * A fact about the read that produced it and never a stored one: ADR-0013 derives the
	 * folder from where the project's own note sits, so a user who drags that folder back is
	 * simply absent from the next answer — which is what makes staleness and retraction
	 * unrepresentable rather than handled. **The next answer, not the next moment**: that
	 * read goes through the Project Index, which is not told about a folder moved in
	 * Obsidian's file explorer (the vault listeners filter to `TFile`, since slice 4), so the
	 * flag flips at the next index rebuild — at load, or after a settings save — rather than
	 * as the drag lands. `IndexLibraryOverlaps` carries the mechanism.
	 */
	readonly libraryOverlap: boolean;
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

/**
 * `libraryOverlap` is a PARAMETER rather than something read off the entity, because a
 * `Project` does not know it: §83's answer is derived per read from the project index and the
 * configured library folder (`LibraryOverlaps`), and an entity carrying it would be an entity
 * carrying a fact about a setting.
 */
export function toProjectSummaryDto(project: Project, libraryOverlap: boolean): ProjectSummaryDto {
	return { id: project.id, name: project.name, status: project.status, libraryOverlap };
}
