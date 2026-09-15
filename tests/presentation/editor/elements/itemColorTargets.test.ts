import { expect, it } from 'vitest';
import { colorTargets, itemColorLabel } from '../../../../src/presentation/editor/elements/itemColorTargets';
import { WALL_LOOP } from '../../../helpers/structure';

const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
const structure = { ...WALL_LOOP, openings: [door], elements: [{ id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: 'blue' as const }] };
const zones = new Map([['zone-a', { id: 'zone-a', color: '#3a7bd5' as const }]]);

it('finds one room, wall, opening or element of any kind, and nothing for an id it cannot colour', () => {
	for (const id of ['zone-a', 'wall-a', 'opening-door', 'element-path']) expect(colorTargets({ zones, structure }, [id]).map(target => target.id)).toEqual([id]);
	expect(colorTargets({ zones, structure }, ['reference-x'])).toEqual([]);
	expect(colorTargets({ zones, structure }, [])).toEqual([]);
});

it('labels a preset by name, a hex as saved and absence as Default', () => {
	expect(itemColorLabel('blue')).toBe('Blue'); expect(itemColorLabel('#3a7bd5')).toBe('#3a7bd5'); expect(itemColorLabel(undefined)).toBe('Default');
});
