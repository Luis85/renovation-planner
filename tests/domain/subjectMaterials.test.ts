import { describe, expect, it } from 'vitest';
import { EMPTY_RENOVATION, validateRenovation, type RenovationSubject } from '../../src/domain/renovation/Renovation';
import { validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';
import { constructionRule } from '../../src/domain/requirement/constructionRule';
import { WALL_LOOP } from '../helpers/structure';

const wall: RenovationSubject = { id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'asset-brick' }, planned: { change: 'modify', description: 'Drywall', assetId: 'asset-drywall' } };
const wallExisting = wall.existing ?? (() => { throw new Error('test fixture missing existing facts'); })();
const valid = (subject: RenovationSubject) => validateRenovation({ ...EMPTY_RENOVATION, subjects: [subject] }).ok;
const structure = { ...WALL_LOOP, openings: [{ id: 'door', kind: 'door' as const, hostId: 'wall-a', offset: 100, width: 900, height: 2000, sill: 0 }] };

describe('a wall or opening material (ADR-0031)', () => {
	it('is allowed on wall, door and window subjects only, and never empty', () => {
		expect(valid(wall)).toBe(true);
		expect(valid({ ...wall, kind: 'floor' })).toBe(false);
		expect(valid({ ...wall, existing: { ...wallExisting, assetId: '' } })).toBe(false);
	});
	it('stays the same under an unchanged plan and is dropped by a removal', () => {
		expect(valid({ ...wall, planned: { change: 'unchanged', description: 'Brick', assetId: 'asset-brick' } })).toBe(true);
		expect(valid({ ...wall, planned: { change: 'unchanged', description: 'Brick', assetId: 'asset-drywall' } })).toBe(false);
		expect(valid({ ...wall, planned: { change: 'remove', description: '', assetId: 'asset-brick' } })).toBe(false);
	});
	it('needs a wall subject on a wall and a door or window subject on an opening', () => {
		const targets = (subject: RenovationSubject) => validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [subject] }, { roomIds: [], structure });
		expect(targets(wall).ok).toBe(true);
		expect(targets({ ...wall, targetId: 'door' })).toMatchObject({ ok: false, error: { code: 'renovation.material-target' } });
		expect(targets({ ...wall, id: 'detail-door', kind: 'door', targetId: 'door' }).ok).toBe(true);
	});
	it.each([['wall', 'm2', 'wall-net'], ['wall', 'm', 'wall-length'], ['wall', 'm3', 'wall-volume'], ['wall', 'piece', null], ['opening', 'piece', 'count'], ['opening', 'm2', 'opening-area'], ['opening', 'm', null]] as const)('measures a %s material priced per %s with %s', (target, unit, rule) => {
		expect(constructionRule(target, unit)).toBe(rule);
	});
});
