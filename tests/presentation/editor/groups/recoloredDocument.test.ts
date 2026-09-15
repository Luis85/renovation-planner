import { expect, it } from 'vitest';
import { recoloredDocument } from '../../../../src/presentation/editor/groups/recoloredDocument';
import { WALL_LOOP } from '../../../helpers/structure';

it('sets and removes one colour on exactly the named rooms, walls, openings and elements', () => {
	const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
	const path = { id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: 'blue' as const };
	const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
	const document = { calibration: null, objects: [room], structure: { ...WALL_LOOP, openings: [door], elements: [path] }, intended: { ...WALL_LOOP } };
	const painted = recoloredDocument(document, ['zone-a', 'wall-a', 'element-path'], '#3a7bd5');
	expect(painted.objects[0].color).toBe('#3a7bd5');
	expect(painted.structure?.walls[0].color).toBe('#3a7bd5'); expect(painted.structure?.walls[1]).not.toHaveProperty('color');
	expect(painted.structure?.openings[0]).not.toHaveProperty('color');
	expect(painted.structure?.elements?.[0].color).toBe('#3a7bd5');
	expect(painted.intended).toBe(document.intended);
	const reset = recoloredDocument(painted, ['element-path', 'zone-a'], undefined);
	expect(reset.structure?.elements?.[0]).not.toHaveProperty('color'); expect(reset.objects[0]).not.toHaveProperty('color');
	expect(recoloredDocument(document, ['opening-door'], 'rose').structure?.openings[0].color).toBe('rose');
});
