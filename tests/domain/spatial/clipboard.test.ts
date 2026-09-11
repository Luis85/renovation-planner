import { describe, expect, it } from 'vitest';
import { captureClipboard, placedRooms, placedStructure, type ClipboardFloor, type SpatialClipboard } from '../../../src/domain/spatial/clipboard';
import type { Wall } from '../../../src/domain/spatial/Structure';

const wall = (id: string, start: readonly [number, number], end: readonly [number, number], bulge?: number): Wall =>
	({ id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, height: 2400, thickness: 150, ...(bulge === undefined ? {} : { bulge }) });

const FLOOR: ClipboardFloor = {
	rooms: [
		{ key: 'zone-kitchen', name: 'Kitchen', zoneType: 'Room', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] },
		{ key: 'zone-garden', name: 'Garden', zoneType: 'Garden', points: [{ x: 6000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 2000 }], bulges: [0.3, 0, 0] },
	],
	structure: {
		walls: [wall('wall-a', [0, 0], [4000, 0]), wall('wall-b', [4000, 0], [4000, 3000]), wall('wall-c', [4000, 3000], [0, 3000]), wall('wall-d', [0, 3000], [0, 0]), wall('wall-lone', [6000, 4000], [8000, 4000], 0.25)],
		openings: [
			{ id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 },
			{ id: 'opening-window', kind: 'window', hostId: 'wall-a', offset: 2000, width: 1000, height: 1200, sill: 900 },
		],
		boundaries: [{ roomId: 'zone-kitchen', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }],
		elements: [
			{ id: 'element-stair', kind: 'stair', points: [{ x: 1000, y: 1000 }, { x: 1000, y: 2000 }], stair: { width: 900, treads: 12, direction: 'up' } },
			{ id: 'element-path', kind: 'path', points: [{ x: 6000, y: 5000 }, { x: 7000, y: 5000 }] },
		],
	},
	names: [{ id: 'element-stair', name: 'Stair' }, { id: 'element-path', name: 'Path' }],
	groups: [{ id: 'group-kitchen', name: 'Kitchen set', memberIds: ['zone-kitchen', 'wall-a'] }, { id: 'group-yard', name: 'Yard', memberIds: ['zone-garden', 'element-path'] }],
};

describe('capture', () => {
	it('brings a Room\'s boundary walls and every opening they host, centred on the copy\'s middle', () => {
		const copied = captureClipboard(FLOOR, ['zone-kitchen']);
		expect(copied?.rooms).toEqual([{ key: 'zone-kitchen', name: 'Kitchen', zoneType: 'Room', points: [{ x: -2000, y: -1500 }, { x: 2000, y: -1500 }, { x: 2000, y: 1500 }, { x: -2000, y: 1500 }] }]);
		expect(copied?.structure.walls.map(item => item.id)).toEqual(['wall-a', 'wall-b', 'wall-c', 'wall-d']);
		expect(copied?.structure.walls[0]).toMatchObject({ start: { x: -2000, y: -1500 }, end: { x: 2000, y: -1500 } });
		expect(copied?.structure.openings.map(item => item.id)).toEqual(['opening-door', 'opening-window']);
		expect(copied?.structure.boundaries).toEqual(FLOOR.structure.boundaries);
		expect(copied?.structure.elements).toEqual([]);
		expect(copied?.groups.map(group => group.id)).toEqual(['group-kitchen']);
	});

	it('brings an opening\'s host wall and that wall\'s other openings', () => {
		const copied = captureClipboard(FLOOR, ['opening-window']);
		expect(copied?.rooms).toEqual([]);
		expect(copied?.structure.walls).toEqual([wall('wall-a', [-2000, 0], [2000, 0])]);
		expect(copied?.structure.openings.map(item => item.id)).toEqual(['opening-door', 'opening-window']);
		expect(copied?.structure.boundaries).toEqual([]);
		expect(copied?.groups).toEqual([]);
	});

	it('keeps element names and stair options, and a group only when every member is copied', () => {
		const copied = captureClipboard(FLOOR, ['element-stair', 'zone-garden', 'element-path', 'wall-lone']);
		expect(copied?.structure.elements.map(item => [item.id, item.stair])).toEqual([['element-stair', { width: 900, treads: 12, direction: 'up' }], ['element-path', undefined]]);
		expect(copied?.names).toEqual(FLOOR.names);
		expect(copied?.groups.map(group => group.id)).toEqual(['group-yard']);
		expect(captureClipboard(FLOOR, ['zone-garden'])?.groups).toEqual([]);
	});

	it('answers null for nothing copyable, and copies walls from a floor that has no elements', () => {
		expect(captureClipboard(FLOOR, [])).toBeNull();
		expect(captureClipboard(FLOOR, ['zone-gone', 'group-kitchen'])).toBeNull();
		const bare = captureClipboard({ ...FLOOR, structure: { ...FLOOR.structure, elements: undefined } }, ['wall-lone']);
		expect(bare?.structure.elements).toEqual([]);
	});
});

describe('placement', () => {
	const copied = captureClipboard(FLOOR, ['zone-kitchen', 'element-stair']) as SpatialClipboard;
	let minted = 0;
	const mint = (prefix: string): string => `${prefix}-new-${++minted}`;

	it('centres the Rooms on the target', () => {
		expect(placedRooms(copied, { x: 10000, y: 10000 }).map(room => room.points)).toEqual([[{ x: 8000, y: 8500 }, { x: 12000, y: 8500 }, { x: 12000, y: 11500 }, { x: 8000, y: 11500 }]]);
	});

	it('re-mints every id and rewires every reference to the new ones', () => {
		const placed = placedStructure(copied, { x: 10000, y: 10000 }, ['zone-new'], mint);
		const { walls, openings, boundaries, elements } = placed.structure;
		expect(walls.every(item => item.id.startsWith('wall-new-'))).toBe(true);
		expect(walls[0]).toMatchObject({ start: { x: 8000, y: 8500 }, end: { x: 12000, y: 8500 } });
		expect(openings.map(item => item.hostId)).toEqual([walls[0].id, walls[0].id]);
		expect(openings.every(item => item.id.startsWith('opening-new-'))).toBe(true);
		expect(boundaries).toEqual([{ roomId: 'zone-new', wallIds: walls.map(item => item.id) }]);
		expect(elements).toEqual([{ id: expect.stringMatching(/^element-new-/), kind: 'stair', points: [{ x: 9000, y: 9500 }, { x: 9000, y: 10500 }], stair: { width: 900, treads: 12, direction: 'up' } }]);
		expect(placed.names).toEqual([{ id: elements[0].id, name: 'Stair' }]);
		expect(placed.groups).toEqual([{ id: expect.stringMatching(/^group-new-/), name: 'Kitchen set', memberIds: ['zone-new', walls[0].id] }]);
		expect(JSON.stringify(placed)).not.toMatch(/"(zone-kitchen|wall-[a-d]|opening-(door|window)|element-stair|group-kitchen)"/);
	});

	it('moves curved rooms and bulged walls without reshaping them', () => {
		const curved = captureClipboard(FLOOR, ['zone-garden', 'wall-lone']) as SpatialClipboard;
		const [atOrigin] = placedRooms(curved, { x: 0, y: 0 }), [shifted] = placedRooms(curved, { x: 100, y: -50 });
		expect(shifted.points).toEqual(atOrigin.points.map(point => ({ x: point.x + 100, y: point.y - 50 })));
		expect(shifted.bulges).toEqual([0.3, 0, 0]);
		expect(placedStructure(curved, { x: 0, y: 0 }, ['zone-new'], mint).structure.walls[0].bulge).toBe(0.25);
	});
});
