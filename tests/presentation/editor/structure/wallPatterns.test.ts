import { describe, expect, it } from 'vitest';
import { wallPatterns } from '../../../../src/presentation/editor/structure/wallPatterns';
import { wallBodyPolygon } from '../../../../src/presentation/editor/structure/wallBody';
import { EMPTY_RENOVATION, type RenovationSubject } from '../../../../src/domain/renovation/Renovation';

const catalogue = [{ asset: { id: 'brick', planPattern: 'brick' as const } }, { asset: { id: 'board', planPattern: 'drywall' as const } }, { asset: { id: 'plain', planPattern: null } }];
const subject = (patch: Partial<RenovationSubject>): RenovationSubject => ({ id: 'd', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'brick' }, planned: null, ...patch });
const on = (subjects: RenovationSubject[], planned: boolean) => Object.fromEntries(wallPatterns({ ...EMPTY_RENOVATION, subjects }, catalogue, planned));

describe('which pattern a wall shows (spec §6.7)', () => {
	it('shows the existing material everywhere but the Planned mode', () => {
		expect(on([subject({ planned: { change: 'modify', description: 'Board', assetId: 'board' } })], false)).toEqual({ 'wall-a': 'brick' });
		expect(on([subject({ planned: { change: 'modify', description: 'Board', assetId: 'board' } })], true)).toEqual({ 'wall-a': 'drywall' });
	});
	it('keeps the existing pattern when unchanged, and shows none when removed, patternless or not a wall', () => {
		expect(on([subject({ planned: { change: 'unchanged', description: 'Brick', assetId: 'brick' } })], true)).toEqual({ 'wall-a': 'brick' });
		expect(on([subject({ planned: { change: 'remove', description: '' } })], true)).toEqual({});
		expect(on([subject({ existing: { description: 'x', condition: 'good', assetId: 'plain' } })], false)).toEqual({});
		expect(on([subject({ kind: 'door', targetId: 'door' })], false)).toEqual({});
	});
});

describe('a wall body outline', () => {
	it('is the four corners of a straight wall, thickness wide', () => {
		expect(wallBodyPolygon({ id: 'w', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200, height: 2400 }, 1)).toEqual([{ x: 0, y: -100 }, { x: 4000, y: -100 }, { x: 4000, y: 100 }, { x: 0, y: 100 }]);
	});
	it('follows a curved wall on both faces', () => {
		const points = wallBodyPolygon({ id: 'w', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200, height: 2400, bulge: 0.5 }, 10);
		expect(points.length).toBeGreaterThan(8);
		expect(points.length % 2).toBe(0);
	});
});
