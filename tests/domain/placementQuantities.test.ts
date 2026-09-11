import { describe, expect, it } from 'vitest';
import { sourceMeasurement, type QuantityGeometry, type RequirementSource } from '../../src/domain/requirement/RequirementSource';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import { expectOk } from '../helpers/domain';

const source: RequirementSource = { planId: 'plan', targetId: 'room-west', workId: '', outcomeId: '', state: 'current', rule: 'placement-count', manual: '0', coverage: '1', lot: '', minimum: '' };
const west = { id: 'room-west', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] };
const east = { id: 'room-east', points: [{ x: 4000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 4000, y: 3000 }] };
const placed = (id: string, assetId: string, x: number, y: number, heading: number): SpatialElement => ({ id, kind: 'asset', assetId, points: placementPoints({ x, y }, heading) });
// Both anchors sit exactly on the shared wall face x = 4000; one faces west, one faces east.
const elements = [placed('element-a', 'asset-radiator', 1000, 1000, 0), placed('element-b', 'asset-radiator', 4000, 1500, Math.PI), placed('element-c', 'asset-radiator', 4000, 2000, 0), placed('element-d', 'asset-sink', 2000, 2000, 0)];
const geometry: QuantityGeometry = { objects: [west, east], structure: { ...EMPTY_STRUCTURE, elements } };

describe('placement-count', () => {
	it('counts this asset\'s placements whose probe lies in the room, a shared-wall anchor only in the room it faces', () => {
		expect(expectOk(sourceMeasurement(source, 'room-west', geometry, 'piece', 'asset-radiator')).toString()).toBe('2');
		expect(expectOk(sourceMeasurement({ ...source, targetId: 'room-east' }, 'room-east', geometry, 'piece', 'asset-radiator')).toString()).toBe('1');
		expect(expectOk(sourceMeasurement(source, 'room-west', geometry, 'piece', 'asset-sink')).toString()).toBe('1');
	});
	it('answers zero rather than refusing when nothing is placed', () => {
		expect(expectOk(sourceMeasurement(source, 'room-west', { ...geometry, structure: EMPTY_STRUCTURE }, 'piece', 'asset-radiator')).toString()).toBe('0');
	});
	it('reads the intended structure only for an intended source', () => {
		const intended = { ...EMPTY_STRUCTURE, elements: [elements[0]] };
		expect(expectOk(sourceMeasurement({ ...source, state: 'intended' }, 'room-west', { ...geometry, intended }, 'piece', 'asset-radiator')).toString()).toBe('1');
		expect(expectOk(sourceMeasurement(source, 'room-west', { ...geometry, intended }, 'piece', 'asset-radiator')).toString()).toBe('2');
	});
	it('refuses a missing asset id, a non-piece unit, a missing room and a target that is not the room', () => {
		expect(sourceMeasurement(source, 'room-west', geometry, 'piece').ok).toBe(false);
		expect(sourceMeasurement(source, 'room-west', geometry, 'm2', 'asset-radiator').ok).toBe(false);
		expect(sourceMeasurement(source, 'room-gone', geometry, 'piece', 'asset-radiator').ok).toBe(false);
		expect(sourceMeasurement({ ...source, targetId: 'room-east' }, 'room-west', geometry, 'piece', 'asset-radiator').ok).toBe(false);
	});
});
