import { ok } from '../../src/core/result/Result';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import type { ParentZoneOutlineDto } from '../../src/presentation/read-models/planHierarchy';

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
			hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'harness-site', name: 'Site plan' }], detailPlans: [], parentZone: HARNESS_PARENT_ZONE, parentZoneMissing: false })),
		},
	};
}

/** `?locked=<id,id>`: the seeded zones answered as locked (ADR-0027), so their faded captions can be looked at. */
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
