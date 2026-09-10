import { expect, it } from 'vitest';
import { sourceMeasurement, type RequirementSource } from '../../src/domain/requirement/RequirementSource';
import { rotate } from '../../src/core/geometry/operations';
import { expectOk } from '../helpers/domain';
import { WALL_LOOP } from '../helpers/structure';

const source: RequirementSource = { planId: 'plan-a', targetId: 'room-a', workId: '', outcomeId: '', state: 'current', rule: 'room-area', manual: '0', coverage: '1', lot: '', minimum: '' };
const room = { id: 'room-a', points: WALL_LOOP.walls.map(wall => wall.start), bulges: [0.5, 0, 0, 0] };
const angle = 4 * Math.atan(0.5), radius = 2500, curvedLength = radius * angle;

it('uses curved Room area and perimeter for material quantity sources through rigid transforms', () => {
	for (const shape of [room, rotate(room, Math.PI / 7, { x: 500, y: 800 })]) {
		const geometry = { objects: [shape] };
		expect(expectOk(sourceMeasurement(source, room.id, geometry, 'm2')).toNumber()).toBeCloseTo(12e6 + radius * radius * (angle - Math.sin(angle)) / 2);
		expect(expectOk(sourceMeasurement({ ...source, rule: 'room-perimeter' }, room.id, geometry, 'm')).toNumber()).toBeCloseTo(10000 + curvedLength);
	}
});

it('uses current and intended wall arc lengths for gross/net quantities and deducts hosted openings once', () => {
	const wall = { ...WALL_LOOP.walls[0], bulge: 0.5 }, opening = { id: 'opening-quantity', kind: 'door' as const, hostId: wall.id, offset: 500, width: 900, height: 2000, sill: 0 };
	const geometry = { objects: [room], structure: WALL_LOOP, intended: { ...WALL_LOOP, walls: [wall], openings: [opening] } };
	expect(expectOk(sourceMeasurement({ ...source, targetId: wall.id, rule: 'wall-length' }, room.id, geometry, 'm')).toNumber()).toBe(4000);
	expect(expectOk(sourceMeasurement({ ...source, state: 'intended', targetId: wall.id, rule: 'wall-length' }, room.id, geometry, 'm')).toNumber()).toBeCloseTo(curvedLength);
	expect(expectOk(sourceMeasurement({ ...source, state: 'intended', targetId: wall.id, rule: 'wall-net' }, room.id, geometry, 'm2')).toNumber()).toBeCloseTo(curvedLength * wall.height - 1800000);
});
