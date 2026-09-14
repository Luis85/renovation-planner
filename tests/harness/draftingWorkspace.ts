import type { createRepositoryStack } from '../helpers/vault';
import { expectDefined, expectOk } from '../helpers/domain';
import { withPlanSpatialElements } from '../../src/domain/plan/Plan';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import type { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }) => ({ id, start, end, height: 2500, thickness: 240 });
const WALLS = [
	wall('wall-harness-north', { x: 0, y: 0 }, { x: 6270, y: 0 }), wall('wall-harness-east', { x: 6270, y: 0 }, { x: 6270, y: 9520 }),
	wall('wall-harness-south', { x: 6270, y: 9520 }, { x: 0, y: 9520 }), wall('wall-harness-west', { x: 0, y: 9520 }, { x: 0, y: 0 }),
];
const MARKS: readonly SpatialElement[] = [
	{ id: 'element-harness-dimension', kind: 'dimension', offset: -900, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 0 }, { x: 4560, y: 0 }, { x: 5310, y: 0 }, { x: 6270, y: 0 }] },
	{ id: 'element-harness-section', kind: 'section', flipped: false, points: [{ x: -1500, y: 4700 }, { x: 7800, y: 4700 }] },
	{ id: 'element-harness-view', kind: 'view', points: [{ x: 3135, y: -2600 }, { x: 3135, y: -1800 }] },
	{ id: 'element-harness-hatch', kind: 'hatch', points: [{ x: 0, y: 9760 }, { x: 6270, y: 9760 }, { x: 6270, y: 12000 }, { x: 0, y: 12000 }] },
	{ id: 'element-harness-text', kind: 'text', points: [{ x: 3135, y: 3000 }] },
	{ id: 'element-harness-boundary', kind: 'boundary', points: [{ x: -3000, y: -3500 }, { x: -2200, y: 13000 }] },
	{ id: 'element-harness-grid', kind: 'grid', points: [{ x: 8800, y: -1200 }] },
];
const NAMES: readonly string[] = ['North wall', 'S-01', 'A-01', 'Existing', 'Zwischenbau', 'Plot line', '1'];

/** The `?drafting` knob's plan: one drafting mark of each kind around a walled floor, written through the real sidecar and plan note. */
export async function seedDraftingPlan(stack: ReturnType<typeof createRepositoryStack>, geometry: ObsidianPlanGeometrySidecar, planId: PlanId): Promise<void> {
	const baseline = expectOk(await geometry.read(planId));
	expectOk(await geometry.write(planId, { ...baseline.document, structure: { walls: WALLS, openings: [], boundaries: [], elements: [...MARKS] } }, baseline.version));
	const loaded = expectDefined(expectOk(await stack.plans.getById(planId)), 'harness drafting plan');
	expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, MARKS.map((item, index) => ({ id: item.id, name: NAMES[index] })))), loaded.version));
}
