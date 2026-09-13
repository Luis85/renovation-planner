import type { Point } from '../../core/geometry/Point';
import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { ZoneListing } from '../../application/ports/ZoneRepository';
import type { Query } from '../../application/queries/Query';
import type { GetPlanInput } from '../../application/queries/GetPlan';
import type { FindZonesByPlanInput } from '../../application/queries/FindZonesByPlan';
import type { ListPlansByProjectInput, PlanListResult } from '../../application/queries/ListPlansByProject';
import type { Plan } from '../../domain/plan/Plan';
import type { PlanId } from '../../domain/plan/PlanId';
import type { PlanKind } from '../../domain/plan/PlanKind';
import type { PlanSummaryDto } from './PlanDto';

/** A plan that details one zone of the plan being shown (ADR-0028). */
export interface DetailPlanDto extends PlanSummaryDto {
	readonly parentZoneId: string;
}

/**
 * One plan in the project's Property tree; `children` sorted by `order`, then name. `order` is
 * the STORED value the reorder compares each sibling against — in every existing vault it is 0
 * on every plan, so a node's position among its siblings is not the stored value.
 */
export interface PropertyTreeNode {
	readonly id: string;
	readonly name: string;
	readonly kind: PlanKind;
	readonly order: number;
	readonly parentId: string | null;
	readonly children: readonly PropertyTreeNode[];
}

/** The parent zone, as the detail plan draws it for a guide. World millimetres of the PARENT plan. */
export interface ParentZoneOutlineDto {
	readonly name: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}

export interface PlanHierarchyDto {
	/** Root first, ending at this plan's parent; empty for a plan with no parent. */
	readonly ancestry: readonly PlanSummaryDto[];
	/** Plans detailing a zone of THIS plan, sorted by name. */
	readonly detailPlans: readonly DetailPlanDto[];
	/** Every plan of the project, nested by parent link, root first. */
	readonly tree: readonly PropertyTreeNode[];
	readonly parentZone: ParentZoneOutlineDto | null;
	/** This plan names a parent zone that no longer resolves. */
	readonly parentZoneMissing: boolean;
}

export const NO_HIERARCHY: PlanHierarchyDto = { ancestry: [], detailPlans: [], tree: [], parentZone: null, parentZoneMissing: false };

export interface HierarchyQueries {
	readonly getPlan: Query<GetPlanInput, Result<Loaded<Plan> | null, RepositoryError>>;
	readonly listPlans: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;
	readonly findZonesByPlan: Query<FindZonesByPlanInput, Result<ZoneListing, RepositoryError>>;
}

/**
 * Walks `parent` links through plans already listed, root first. A missing ancestor ends the
 * chain there, and a repeated id — only a hand-edited note can make one — stops it.
 */
export function ancestryOf(plan: Plan, plans: readonly Plan[]): PlanSummaryDto[] {
	const byId = new Map(plans.map((item) => [String(item.id), item]));
	const seen = new Set<string>([String(plan.id)]);
	const chain: PlanSummaryDto[] = [];
	let parentId = plan.parent === null ? undefined : String(plan.parent.planId);
	while (parentId !== undefined && !seen.has(parentId)) {
		const parent = byId.get(parentId);
		if (parent === undefined) break;
		seen.add(parentId);
		chain.unshift({ id: parent.id, name: parent.name, kind: parent.kind });
		parentId = parent.parent === null ? undefined : String(parent.parent.planId);
	}
	return chain;
}

const bySiblingOrder = (plans: readonly Plan[]): Plan[] =>
	plans.toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name));

const treeNode = (plan: Plan, parentId: string | null, children: PropertyTreeNode[]): PropertyTreeNode =>
	({ id: plan.id, name: plan.name, kind: plan.kind, order: plan.order, parentId, children });

/**
 * The whole project nested by parent link, root first. A plan whose parent is not listed
 * (deleted, unreadable) draws at the root rather than vanishing — the requirement's "the chain
 * simply stops one level early", applied to the tree. A cycle (hand-edited notes only) has no
 * member with a path to the root, so the walk from the root never reaches one; every plan it
 * did not reach is listed flat at the root afterwards, childless, so nothing disappears.
 */
export function propertyTreeOf(plans: readonly Plan[]): PropertyTreeNode[] {
	const ids = new Set(plans.map((plan) => String(plan.id)));
	const childrenOf = new Map<string | null, Plan[]>();
	for (const plan of plans) {
		const parentId = plan.parent !== null && ids.has(String(plan.parent.planId)) ? String(plan.parent.planId) : null;
		childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), plan]);
	}
	const placed = new Set<string>();
	function build(parentId: string | null): PropertyTreeNode[] {
		return bySiblingOrder(childrenOf.get(parentId) ?? []).map((plan) => {
			placed.add(String(plan.id));
			return treeNode(plan, parentId, build(String(plan.id)));
		});
	}
	const roots = build(null);
	const stranded = bySiblingOrder(plans.filter((plan) => !placed.has(String(plan.id))));
	return [...roots, ...stranded.map((plan) => treeNode(plan, null, []))];
}

function detailPlansOf(plan: Plan, plans: readonly Plan[]): DetailPlanDto[] {
	const detailPlans = plans.flatMap((item) =>
		item.parent !== null && item.parent.planId === plan.id
			? [{ id: item.id, name: item.name, kind: item.kind, parentZoneId: item.parent.zoneId }]
			: [],
	);
	detailPlans.sort((a, b) => a.name.localeCompare(b.name));
	return detailPlans;
}

/**
 * The parent-zone half of the hierarchy (ancestry, the outline to draw as a guide, and whether
 * that outline is missing). Split out of `readPlanHierarchy` to keep that function's branches
 * under the complexity budget — `plan.parent` is non-null in every caller.
 *
 * A parent plan not among `listedPlans` (deleted or unreadable) answers no guide at all
 * (spec §4.9: "Parent plan deleted or unreadable — Chain ends at the project; no guide"),
 * without asking `findZonesByPlan` — the zone note may still resolve on its own, independently
 * of its plan, and a guide drawn from it would contradict the ended ancestry. `parentZoneMissing`
 * stays reserved for a parent plan that IS loaded but whose named zone no longer resolves.
 */
async function parentHierarchyOf(
	queries: HierarchyQueries,
	parent: NonNullable<Plan['parent']>,
	plan: Plan,
	listedPlans: readonly Plan[],
): Promise<Result<Pick<PlanHierarchyDto, 'ancestry' | 'parentZone' | 'parentZoneMissing'>, RepositoryError>> {
	const ancestry = ancestryOf(plan, listedPlans);
	if (!listedPlans.some((item) => item.id === parent.planId)) {
		return ok({ ancestry, parentZone: null, parentZoneMissing: false });
	}
	const zones = await queries.findZonesByPlan.execute({ planId: parent.planId });
	if (isErr(zones)) return zones;
	const zone = zones.value.loaded.find((loaded) => loaded.entity.id === parent.zoneId)?.entity;
	return ok({
		ancestry,
		parentZone: zone === undefined ? null : { name: zone.name, points: [...zone.geometry.points], ...(zone.geometry.bulges ? { bulges: [...zone.geometry.bulges] } : {}) },
		parentZoneMissing: zone === undefined,
	});
}

/**
 * The editor's one hierarchy read (ADR-0028): two reads for any plan, three for a detail plan.
 * `ok(NO_HIERARCHY)` for a plan that no longer exists — `ProjectStore`'s own read already draws
 * that state, so a second answer here would only repeat it.
 */
export async function readPlanHierarchy(queries: HierarchyQueries, planId: string): Promise<Result<PlanHierarchyDto, RepositoryError>> {
	const found = await queries.getPlan.execute({ planId: planId as PlanId });
	if (isErr(found)) return found;
	if (found.value === null) return ok(NO_HIERARCHY);
	const plan = found.value.entity;
	const listed = await queries.listPlans.execute({ projectId: plan.projectId });
	if (isErr(listed)) return listed;
	const detailPlans = detailPlansOf(plan, listed.value.plans);
	const tree = propertyTreeOf(listed.value.plans);
	if (plan.parent === null) return ok({ ...NO_HIERARCHY, detailPlans, tree });
	const parentHierarchy = await parentHierarchyOf(queries, plan.parent, plan, listed.value.plans);
	if (isErr(parentHierarchy)) return parentHierarchy;
	return ok({ ...parentHierarchy.value, detailPlans, tree });
}
