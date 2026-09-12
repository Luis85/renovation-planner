import { ok } from '../../src/core/result/Result';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { NO_HIERARCHY, type ParentZoneOutlineDto } from '../../src/presentation/read-models/planHierarchy';
import type { PlanId } from '../../src/domain/plan/PlanId';

/**
 * An L-shaped parent zone far from origin and larger than the default camera shows, so a
 * capture shows both halves of ADR-0028's placement: translated to world origin, and big
 * enough that only Fit brings all of it into view.
 */
const HARNESS_PARENT_ZONE: ParentZoneOutlineDto = {
	name: 'Workshop',
	points: [
		{ x: 30_000, y: 12_000 }, { x: 42_000, y: 12_000 }, { x: 42_000, y: 19_000 },
		{ x: 36_000, y: 19_000 }, { x: 36_000, y: 23_000 }, { x: 30_000, y: 23_000 },
	],
};

/** `?detail`: the harness plan as a fresh detail plan — no zones, no structure, a parent zone guide. */
export function detailPlanDeps(base: PlanEditorDeps): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0, structure: EMPTY_STRUCTURE })),
			// `tree` is what the Property tree draws since ADR-0029's `role="tree"`; a real read answers
			// the same two plans the ancestry names, so the harness answers them too.
			hierarchy: (planId) => Promise.resolve(ok({
				ancestry: [{ id: 'harness-site', name: 'Site plan', kind: 'floor' }],
				detailPlans: [],
				tree: [{ id: 'harness-site', name: 'Site plan', kind: 'floor', order: 0, parentId: null, children: [
					{ id: planId, name: 'Ground floor', kind: 'floor', order: 0, parentId: 'harness-site', children: [] },
				] }],
				parentZone: HARNESS_PARENT_ZONE,
				parentZoneMissing: false,
			})),
		},
	};
}

/**
 * `?detailed=<id,id>`: one detail plan per listed seeded zone id, so a zone's detail-plan caption
 * can be looked at; an id listed twice gets two. Like `?locked`, a mistyped id marks nothing.
 */
export function detailedZoneDeps(base: PlanEditorDeps, ids: readonly string[]): PlanEditorDeps {
	const detailPlans = ids.map((parentZoneId, index) => ({ id: `harness-detail-${index}` as PlanId, name: `Detail plan ${index + 1}`, parentZoneId }));
	return {
		...base,
		queries: {
			...base.queries,
			hierarchy: async (planId) => {
				const found = base.queries.hierarchy === undefined ? ok(NO_HIERARCHY) : await base.queries.hierarchy(planId);
				return found.ok ? ok({ ...found.value, detailPlans }) : found;
			},
		},
	};
}

/** `?locked=<id,id>`:the seeded zones answered as locked (ADR-0027), so their faded captions can be looked at. */
export function lockedZoneDeps(base: PlanEditorDeps, ids: readonly string[]): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: async (planId) => {
				const found = await base.queries.findZonesByPlan(planId);
				return found.ok ? ok({ ...found.value, zones: found.value.zones.map((zone) => (ids.includes(zone.id) ? { ...zone, locked: true as const } : zone)) }) : found;
			},
		},
	};
}
