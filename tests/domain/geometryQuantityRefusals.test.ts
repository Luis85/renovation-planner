import { expect, it } from 'vitest';
import { sourceMeasurement, type RequirementSource } from '../../src/domain/requirement/RequirementSource';
import { restoreGroupMember } from '../../src/domain/spatial/groupMembership';
import { validateStructure, wallsConflict } from '../../src/domain/spatial/structureGeometry';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { expectErr } from '../helpers/domain';

it('refuses to report a Room perimeter quantity while its outline lacks enough corners', () => {
	const source: RequirementSource = { planId: 'plan-room', targetId: 'room-one', workId: '', outcomeId: '', state: 'current', rule: 'room-perimeter', manual: '0', coverage: '1', lot: '', minimum: '' };
	const geometry = { objects: [{ id: 'room-one', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] }] };
	expect(expectErr(sourceMeasurement(source, 'room-one', geometry, 'm'))).toMatchObject({ category: 'Calculation', code: 'requirement.source-invalid' });
	expect(geometry.objects[0].points).toHaveLength(2);
});

it('refuses to restore deleted membership over a Room already grouped elsewhere by a peer', () => {
	const original = [{ id: 'group-original', name: 'Original', memberIds: ['room-one', 'wall-one'] }];
	const current = [{ ...original[0], memberIds: ['wall-one'] }, { id: 'group-peer', name: 'Peer', memberIds: ['room-one'] }];
	const before = structuredClone(current);
	expect(expectErr(restoreGroupMember(original, current, 'room-one'))).toMatchObject({ code: 'spatial-group.restore-conflict' });
	expect(current).toEqual(before);
});

it('detects a straight-first wall crossing a curved wall while allowing their shared endpoint', () => {
	const arc = { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, bulge: 1 };
	const crossing = { start: { x: 2000, y: -3000 }, end: { x: 2000, y: 1000 } };
	expect(wallsConflict(crossing, arc)).toBe(true);
	expect(wallsConflict({ start: { x: -1000, y: 0 }, end: arc.start }, arc)).toBe(false);
});

it('refuses a wall bend beyond a semicircle before accepting its dimensions', () => {
	const wall = { id: 'wall-invalid-curve', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 100, height: 2400, bulge: 2 };
	const structure = { ...EMPTY_STRUCTURE, walls: [wall] }, before = structuredClone(structure);
	expect(expectErr(validateStructure(structure, []))).toMatchObject({ code: 'spatial.wall-dimensions' });
	expect(structure).toEqual(before);
});
