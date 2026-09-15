import type { Plan } from '../../src/domain/plan/Plan';
import type { ItemColor } from '../../src/domain/spatial/ItemColor';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { expectOk } from '../helpers/domain';
import { makeZone } from '../helpers/entities';
import type { seedDraftingPlan } from './draftingWorkspace';

export type SeedStack = Parameters<typeof seedDraftingPlan>[0];
export type SeedGeometry = Parameters<typeof seedDraftingPlan>[1];

const PALETTE: readonly ItemColor[] = ['blue', 'rose', 'amber', 'green', 'violet', '#3a7bd5'];

/**
 * `?colors`: every family carrying a colour over whatever `?drafting` seeded — a room wash, each wall and
 * opening, and each element in turn through the presets and one custom hex — so one capture shows tint, ink
 * and wash together (plan colours design §2). Written through the real repositories, schema 15 included.
 */
export async function seedColors(stack: SeedStack, geometry: SeedGeometry, plan: Plan): Promise<void> {
	const room = makeZone({ projectId: plan.projectId, planId: plan.id, name: 'Studio', color: 'green',
		geometry: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }, { x: 0, y: 3000 }] } });
	expectOk(await stack.zones.save(room, 'absent'));
	const baseline = expectOk(await geometry.read(plan.id)), structure = baseline.document.structure ?? EMPTY_STRUCTURE;
	const paint = <T extends object>(items: readonly T[], offset: number) => items.map((item, index) => ({ ...item, color: PALETTE[(index + offset) % PALETTE.length] }));
	expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { ...structure, walls: paint(structure.walls, 1), openings: paint(structure.openings, 2),
		...(structure.elements ? { elements: paint(structure.elements, 0) } : {}) } }, baseline.version));
}
