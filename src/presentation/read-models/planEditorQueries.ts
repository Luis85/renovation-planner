import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Loaded } from '../../application/ports/versioning';
import type { Query } from '../../application/queries/Query';
import type { FindZonesByPlanInput } from '../../application/queries/FindZonesByPlan';
import type { GetPlanInput } from '../../application/queries/GetPlan';
import type { RequirementInspectorDTO } from '../../application/queries/GetRequirementsForZone';
import type {
	ReferencedTarget,
	ReferencingGroup,
} from '../../application/queries/ListRequirementsReferencing';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { Asset } from '../../domain/asset/Asset';
import type { Plan as PlanEntity } from '../../domain/plan/Plan';
import type { ZoneListing } from '../../application/ports/ZoneRepository';
import { toPlanDto, toZoneDto, type PlanDto, type ZoneDto } from './PlanDto';

/** One row of the assign-asset picker: what a `<select>` needs, nothing more. */
export interface AssetOptionDto {
	readonly id: string;
	readonly name: string;
}

/**
 * The ONLY application-layer surface the Plan Editor depends on. Concrete Obsidian
 * repositories are wired at the composition root; the view is handed this and never
 * learns that a vault exists.
 *
 * Both methods hand back slice 4's query `Result` **verbatim in shape**: a missing Plan
 * is `ok(null)` and a failed read is `isErr`. Flattening either into a bare
 * `PlanDto | null` would make "no such plan" and "the vault read failed" indistinguishable
 * — which is exactly the distinction slice 14's empty-state selectors and slice 17's
 * error routing both branch on, and neither could recover it afterwards.
 */
/**
 * The canvas's own shape of a zone listing: the zones it can draw, and how many it cannot.
 *
 * `unreadable` is the view-side name for the port's `refused` — the same number, and the
 * rename across this seam is the one `ListProjects` already makes: the port speaks of notes it
 * declined to load, and the view speaks of zones the user cannot see.
 */
export interface ZoneScene {
	readonly zones: readonly ZoneDto[];
	readonly unreadable: number;
}

export interface PlanEditorQueryServices {
	getPlan(planId: string): Promise<Result<PlanDto | null, RepositoryError>>;
	findZonesByPlan(planId: string): Promise<Result<ZoneScene, RepositoryError>>;
	/**
	 * Slice 10's Requirements panel rows for one zone. The query's own DTO is handed on
	 * verbatim — it IS the presentation contract (the stale flag, the missing-target
	 * marker and the override figures are all things only the UI renders).
	 */
	getRequirementsForZone(
		zoneId: string,
	): Promise<Result<readonly RequirementInspectorDTO[], RepositoryError>>;
	/**
	 * The assign-asset picker's options: the vault's whole catalogue, unfiltered (the
	 * command enforces the unit-kind rule). No project narrows it — since design slice 19
	 * an Asset belongs to none.
	 */
	listAssets(): Promise<Result<readonly AssetOptionDto[], RepositoryError>>;
	/**
	 * What the delete flow shows the user BEFORE the dialog, and owes back to the command
	 * as `resolvedReferents`. IDs rather than a count, because the command compares sets.
	 *
	 * GROUPED, exactly as the query answers: one entry per referencing project, carrying a
	 * `projectPath` only where that project's name is ambiguous among the groups returned.
	 * This member flattened them for a slice, which made slice 19's grouping unreachable —
	 * the ambiguity decision is the QUERY's and cannot be recovered downstream once the
	 * names are gone, and the delete dialog's row per project is what needs it. The flat
	 * set the command compares is derived from these by the flow, in one place.
	 */
	listRequirementsReferencing(
		zoneId: string,
	): Promise<Result<readonly ReferencingGroup[], RepositoryError>>;
	/** The Reassign picker's candidates, already narrowed to what the command would accept. */
	listReassignmentTargets(
		zoneId: string,
	): Promise<Result<readonly ReassignmentTargetDto[], RepositoryError>>;
}

/**
 * The read side for a session whose settings could not be recovered.
 *
 * With settings unrecovered there is no repository, no index and no query service, so the
 * Plan Editor is handed services that refuse and its store's `failed` status draws the same
 * message it would for any other unreadable plan.
 *
 * **That the root builds none is a conservative choice, not a necessity, and the reason
 * lives with the choice** — `CompositionRoot.persistence`. Since ADR-0013 the index's scan
 * is bounded by what a note DECLARES and an existing project's folder comes from where its
 * own note sits, so reads here would in fact work without the setting; what the root refuses
 * to do is compose a stack where one door (creating a new project's folder) has no answer
 * and every other one works.
 *
 * A refusal rather than `ok(null)`: "your settings are broken" is not "this plan does not
 * exist", and the whole reason these two methods keep those apart is that something
 * downstream branches on the difference.
 */
function refuseUnrecovered() {
	return Promise.resolve(
		err<RepositoryError>({
			category: 'Persistence',
			code: 'settings.unrecovered',
			message: 'Settings could not be read, so no plan can be loaded.',
		}),
	);
}

export function unavailablePlanEditorQueries(): PlanEditorQueryServices {
	return {
		getPlan: refuseUnrecovered,
		findZonesByPlan: refuseUnrecovered,
		getRequirementsForZone: refuseUnrecovered,
		listAssets: refuseUnrecovered,
		listRequirementsReferencing: refuseUnrecovered,
		listReassignmentTargets: refuseUnrecovered,
	};
}

/**
 * Slice 4's queries, mapped at the boundary into the read models above.
 *
 * The `as PlanId` is the same boundary assertion every other edge of the system makes
 * about an id it was handed as text (`ObsidianPlanRepository` does it for a frontmatter
 * value, this does it for a view state one): the brand has no runtime representation, so
 * there is nothing to validate — what makes the id real is that the query answers
 * `ok(null)` for one that names nothing.
 *
 * The `version` half of `Loaded` is deliberately dropped. It is the store's bookkeeping
 * for a conditional WRITE, and nothing in this slice's read pipeline writes; slice 6's
 * commands re-read through the repository and get their own. Carrying a stale version
 * into a Pinia store would be an invitation to present it to a `save` later, which is the
 * check-then-act the versioning design exists to refuse.
 */
export function createPlanEditorQueries(queries: {
	readonly getPlan: Query<GetPlanInput, Result<Loaded<PlanEntity> | null, RepositoryError>>;
	readonly findZonesByPlan: Query<FindZonesByPlanInput, Result<ZoneListing, RepositoryError>>;
	/** Production composition always passes both slice-10 members; omitted only by editor
	 * test rigs that mount no Requirements panel content, which then answer empty. */
	readonly getRequirementsForZone?: Query<ZoneId, Result<readonly RequirementInspectorDTO[], RepositoryError>>;
	readonly listAssets?: Query<void, Result<readonly Asset[], RepositoryError>>;
	readonly listRequirementsReferencing?: Query<ReferencedTarget, Result<readonly ReferencingGroup[], RepositoryError>>;
	readonly listReassignmentTargets?: Query<ReferencedTarget, Result<readonly ReassignmentTargetDto[], RepositoryError>>;
}): PlanEditorQueryServices {
	return {
		async getPlan(planId) {
			const found = await queries.getPlan.execute({ planId: planId as PlanId });
			if (isErr(found)) return found;
			return ok(found.value === null ? null : toPlanDto(found.value.entity));
		},
		async findZonesByPlan(planId) {
			const found = await queries.findZonesByPlan.execute({ planId: planId as PlanId });
			if (isErr(found)) return found;
			return ok({
				zones: found.value.loaded.map((loaded) => toZoneDto(loaded.entity)),
				unreadable: found.value.refused,
			});
		},
		async getRequirementsForZone(zoneId) {
			const found = queries.getRequirementsForZone;
			if (!found) return ok([]);
			return await found.execute(zoneId as ZoneId);
		},
		async listAssets() {
			const listed = queries.listAssets;
			if (!listed) return ok([]);
			const found = await listed.execute();
			if (isErr(found)) return found;
			return ok(found.value.map((asset) => ({ id: asset.id, name: asset.name })));
		},
		async listRequirementsReferencing(zoneId) {
			const listed = queries.listRequirementsReferencing;
			if (!listed) return ok([]);
			// Handed on verbatim, like `listReassignmentTargets` below: the grouping IS the
			// presentation contract since slice 19, because the delete dialog draws one row per
			// referencing project and only the query knows which of those names collide.
			return await listed.execute({ kind: 'zone', zoneId: zoneId as ZoneId });
		},
		async listReassignmentTargets(zoneId) {
			const listed = queries.listReassignmentTargets;
			if (!listed) return ok([]);
			return await listed.execute({ kind: 'zone', zoneId: zoneId as ZoneId });
		},
	};
}
