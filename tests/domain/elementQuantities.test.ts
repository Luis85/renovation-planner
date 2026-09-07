import { describe, expect, it } from 'vitest';
import { sourceMeasurement, type RequirementSource } from '../../src/domain/requirement/RequirementSource';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import { expectOk } from '../helpers/domain';

const source: RequirementSource = { planId: 'plan', targetId: 'element-path', workId: '', outcomeId: '', state: 'current', rule: 'element-length', manual: '2.5', coverage: '1', lot: '', minimum: '' };
const path: SpatialElement = { id: source.targetId, kind: 'path', points: [{ x: 0, y: 0 }, { x: 3000, y: 4000 }, { x: 3000, y: 6000 }] };
const object: SpatialElement = { id: 'element-object', kind: 'object', points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }] };
const geometry = { objects: [], structure: { ...EMPTY_STRUCTURE, elements: [path, object] } };
describe('element material quantities use independent floor facts', () => {
	it('derives every open segment and object area, with count and manual overrides', () => {
		expect(expectOk(sourceMeasurement(source, 'room', geometry, 'm')).toString()).toBe('7000');
		expect(expectOk(sourceMeasurement({ ...source, targetId: object.id, rule: 'object-area' }, 'room', geometry, 'm2')).toString()).toBe('6000000');
		for (const targetId of [path.id, object.id]) {
			expect(expectOk(sourceMeasurement({ ...source, targetId, rule: 'count' }, 'room', geometry, 'piece')).toString()).toBe('1');
			expect(expectOk(sourceMeasurement({ ...source, targetId, rule: 'manual' }, 'room', geometry, 'm')).toString()).toBe('2500');
		}
	});
	it('uses intended geometry without overwriting current quantities and refuses a removed target', () => {
		const intended = { ...EMPTY_STRUCTURE, elements: [{ ...path, points: path.points.slice(0, 2) }] };
		expect(expectOk(sourceMeasurement({ ...source, state: 'intended' }, 'room', { ...geometry, intended }, 'm')).toString()).toBe('5000');
		expect(expectOk(sourceMeasurement(source, 'room', { ...geometry, intended }, 'm')).toString()).toBe('7000');
		expect(sourceMeasurement({ ...source, state: 'intended', targetId: object.id, rule: 'count' }, 'room', { ...geometry, intended }, 'piece').ok).toBe(false);
	});
	it('refuses mismatched shapes, units, absent and invalid polygon measurements', () => {
		for (const patch of [{ targetId: object.id }, { rule: 'object-area' as const }, { targetId: 'missing' }]) expect(sourceMeasurement({ ...source, ...patch }, 'room', geometry, 'm').ok).toBe(false);
		expect(sourceMeasurement(source, 'room', geometry, 'm2').ok).toBe(false);
		expect(sourceMeasurement({ ...source, targetId: object.id, rule: 'object-area' }, 'room', { ...geometry, structure: { ...EMPTY_STRUCTURE, elements: [{ ...object, points: [] }] } }, 'm2').ok).toBe(false);
	});
});
