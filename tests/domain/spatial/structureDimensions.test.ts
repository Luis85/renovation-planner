import { describe, expect, it } from 'vitest';
import type { Opening, Structure, Wall } from '../../../src/domain/spatial/Structure';
import { dimensionTargets, editDimensions, hasDimensionTargets, sharedDimension } from '../../../src/domain/spatial/structureDimensions';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';

const wall = (id: string, y: number, thickness = 150): Wall => ({ id, start: { x: 0, y }, end: { x: 4000, y }, height: 2400, thickness });
const window = (id: string, hostId: string, width = 1000): Opening => ({ id, kind: 'window', hostId, offset: 500, width, height: 1200, sill: 900 });
const door: Opening = { id: 'opening-door', kind: 'door', hostId: 'wall-c', offset: 1000, width: 900, height: 2100, sill: 0 };
const passage: Opening = { id: 'opening-passage', kind: 'opening', hostId: 'wall-c', offset: 2500, width: 800, height: 2100, sill: 0 };
const structure: Structure = {
	walls: [wall('wall-a', 0), wall('wall-b', 2000, 200), wall('wall-c', 4000)],
	openings: [window('opening-a', 'wall-a'), window('opening-b', 'wall-b', 800), door, passage],
	boundaries: [],
};

describe('bulk dimension edits across walls, windows and doors', () => {
	it('picks the selected walls, windows and doors and ignores rooms, generic openings and unselected items', () => {
		const targets = dimensionTargets(structure, ['zone-room', 'wall-b', 'wall-c', 'opening-a', 'opening-door', 'opening-passage']);
		expect(targets.wall.map(item => item.id)).toEqual(['wall-b', 'wall-c']);
		expect(targets.window.map(item => item.id)).toEqual(['opening-a']);
		expect(targets.door.map(item => item.id)).toEqual(['opening-door']);
		expect(hasDimensionTargets(structure, ['zone-room', 'opening-passage'])).toBe(false);
		expect(hasDimensionTargets(structure, ['zone-room', 'opening-door'])).toBe(true);
	});

	it('answers the value every item shares, and null when they differ or there are none', () => {
		expect(sharedDimension(structure.walls, 'height')).toBe(2400);
		expect(sharedDimension(structure.walls, 'thickness')).toBeNull();
		expect(sharedDimension([], 'height')).toBeNull();
	});

	it('writes only the entered fields, to the selected items of each kind, keeping positions', () => {
		const ids = ['wall-a', 'wall-b', 'opening-a', 'opening-b', 'opening-door', 'opening-passage'];
		const edited = editDimensions(structure, ids, { wall: { height: 2600 }, window: { sill: 1000 }, door: { width: 1000 } });
		expect(edited.walls).toEqual([{ ...structure.walls[0], height: 2600 }, { ...structure.walls[1], height: 2600 }, structure.walls[2]]);
		expect(edited.openings).toEqual([{ ...structure.openings[0], sill: 1000 }, { ...structure.openings[1], sill: 1000 }, { ...door, width: 1000 }, passage]);
		expect(validateStructure(edited, []).ok).toBe(true);
	});

	it('ignores a field that does not belong to the kind and leaves the structure equal without changes', () => {
		expect(editDimensions(structure, ['wall-a'], { wall: { width: 5 } as never })).toEqual(structure);
		expect(editDimensions(structure, ['wall-a', 'opening-door'], {})).toEqual(structure);
	});

	it('leaves the refusal to validation when a lowered wall no longer contains its window', () => {
		const edited = editDimensions(structure, ['wall-a'], { wall: { height: 1500 } });
		expect(validateStructure(edited, [])).toMatchObject({ ok: false, error: { code: 'spatial.opening-containment' } });
	});
});
