import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP_WITH_SIDES } from '../../../helpers/structure';
import { expectOk } from '../../../helpers/domain';
import type { Structure } from '../../../../src/domain/spatial/Structure';

const item = { id: 'element-item', kind: 'object' as const, points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }] };
const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
const sofa = { id: 'element-sofa', kind: 'asset' as const, assetId: 'asset-sofa', points: [{ x: 2000, y: 2000 }, { x: 3000, y: 2000 }], size: { width: 1800, depth: 900 } };
async function writtenVersion(structure: Structure) {
	const rig = await structureStack(), read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure }, read.version));
	return expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion;
}

it('keeps schema 14 for preset colours on items and writes 16 for a hex or a colour on any other family', async () => {
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ ...item, color: 'blue' }] })).toBe(14);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ ...item, color: '#3a7bd5' }] })).toBe(16);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ id: 'element-path', kind: 'path', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }], color: 'blue' }] })).toBe(16);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, walls: WALL_LOOP_WITH_SIDES.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall) })).toBe(16);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, openings: [{ ...door, color: 'green' }] })).toBe(16);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [item] })).toBeLessThan(14);
});

it('writes the highest requirement beside a placement’s own size: 15 alone or with a preset on an item, 16 with a hex', async () => {
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [sofa] })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [sofa, { ...item, color: 'blue' }] })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [sofa, { ...item, color: '#3a7bd5' }] })).toBe(16);
});
