/**
 * `?rooms=N`: N synthetic 4000×3000 mm rooms on a grid to the right of the seeded flat, so the
 * harness can draw a plan of the size SDD §62 budgets for. Appended AFTER the seeded zones so
 * every other knob (`?select`, `?locked`, `?detailed`) still finds the ids it names.
 */
import { ok } from '../../src/core/result/Result';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import type { ZoneDto } from '../../src/presentation/read-models/PlanDto';

const WIDTH = 4000;
const DEPTH = 3000;
const GAP = 500;
const COLUMNS = 10;
const ORIGIN_X = 12_000;

function syntheticRooms(count: number, planId: string): ZoneDto[] {
	return Array.from({ length: count }, (_, index) => {
		const x = ORIGIN_X + (index % COLUMNS) * (WIDTH + GAP);
		const y = Math.floor(index / COLUMNS) * (DEPTH + GAP);
		return {
			id: `harness-room-${index + 1}`,
			planId,
			name: `Room ${index + 1}`,
			zoneType: 'Room',
			status: 'Planned',
			points: [{ x, y }, { x: x + WIDTH, y }, { x: x + WIDTH, y: y + DEPTH }, { x, y: y + DEPTH }],
		};
	});
}

export function roomsDeps(base: PlanEditorDeps, count: number): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: async (planId) => {
				const found = await base.queries.findZonesByPlan(planId);
				return found.ok ? ok({ ...found.value, zones: [...found.value.zones, ...syntheticRooms(count, planId)] }) : found;
			},
		},
	};
}
