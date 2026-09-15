import { expect, it } from 'vitest';
import { isHexColor, isItemColor, isItemColorPreset, ITEM_COLORS } from '../../../src/domain/spatial/ItemColor';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { WALL_LOOP } from '../../helpers/structure';

const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
const path: SpatialElement = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };

it('accepts the six presets and a lowercase #rrggbb, and nothing else', () => {
	expect(ITEM_COLORS.every(color => isItemColorPreset(color) && isItemColor(color))).toBe(true);
	expect(isHexColor('#3a7bd5')).toBe(true); expect(isItemColor('#3a7bd5')).toBe(true); expect(isItemColorPreset('#3a7bd5')).toBe(false);
	for (const invalid of ['#3A7BD5', '#fff', '3a7bd5', 'rgb(1, 2, 3)', 'red', 'default', '', null, undefined, 7]) expect(isItemColor(invalid)).toBe(false);
});

it('lets every element kind carry a valid colour and refuses an invalid one', () => {
	expect(validSpatialElement({ ...item, color: 'blue' })).toBe(true);
	expect(validSpatialElement({ ...path, color: '#3a7bd5' })).toBe(true);
	expect(validSpatialElement({ ...path, color: 'blue' })).toBe(true);
	expect(validSpatialElement({ ...item, color: '#3A7BD5' as never })).toBe(false);
	expect(validSpatialElement({ ...path, color: 'pink' as never })).toBe(false);
});

it('lets a wall and an opening carry a valid colour and refuses an invalid one', () => {
	const opening = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
	const colored = { ...WALL_LOOP, walls: WALL_LOOP.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall), openings: [{ ...opening, color: '#3a7bd5' as const }] };
	expect(validateStructure(colored, []).ok).toBe(true);
	const badWall = { ...colored, walls: colored.walls.map((wall, index) => index === 0 ? { ...wall, color: 'pink' as never } : wall) };
	expect(validateStructure(badWall, [])).toMatchObject({ ok: false, error: { code: 'spatial.color-invalid' } });
	const badOpening = { ...colored, openings: [{ ...opening, color: '#FFF' as never }] };
	expect(validateStructure(badOpening, [])).toMatchObject({ ok: false, error: { code: 'spatial.color-invalid' } });
});
