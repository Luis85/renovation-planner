import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Plan as PlanEntity } from '../../domain/plan/Plan';
import type { Zone as ZoneEntity } from '../../domain/zone/Zone';
import type { Loaded } from '../../application/ports/versioning';
import type { Query } from '../../application/queries/Query';
import type { GetPlanInput } from '../../application/queries/GetPlan';
import type { FindZonesByPlanInput } from '../../application/queries/FindZonesByPlan';
import { toPlanDto, toZoneDto, type PlanDto, type ZoneDto } from './PlanDto';

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
export interface PlanEditorQueryServices {
	getPlan(planId: string): Promise<Result<PlanDto | null, RepositoryError>>;
	findZonesByPlan(planId: string): Promise<Result<readonly ZoneDto[], RepositoryError>>;
}

/**
 * The read side for a session whose settings could not be recovered.
 *
 * With no `projectFolder` there is no repository, no index and no query service — the
 * composition root deliberately builds none, because a default folder is a different
 * LOCATION rather than a milder version of the user's. So the Plan Editor is handed
 * services that refuse, and its store's `failed` status draws the same message it would
 * for any other unreadable plan.
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
	return { getPlan: refuseUnrecovered, findZonesByPlan: refuseUnrecovered };
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
	readonly findZonesByPlan: Query<FindZonesByPlanInput, Result<Loaded<ZoneEntity>[], RepositoryError>>;
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
			return ok(found.value.map((loaded) => toZoneDto(loaded.entity)));
		},
	};
}
