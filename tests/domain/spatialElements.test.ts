import { describe, expect, it } from 'vitest';
import { elementLength, validSpatialElement, validElementMetadataLinks, sameElementMetadata, type SpatialElement } from '../../src/domain/spatial/SpatialElement';
import { withPlanSpatialElements, withPlanRenovation } from '../../src/domain/plan/Plan';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { makePlan } from '../helpers/entities';
import { expectOk } from '../helpers/domain';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { scaleStructure, validateStructure } from '../../src/domain/spatial/structureGeometry';
import { sameGeometryDocument } from '../../src/application/commands/spatial/sameGeometryDocument';

const line: SpatialElement = { id: 'element-path', kind: 'path', points: [{ x: -1000, y: 0 }, { x: 2000, y: 4000 }, { x: 2000, y: 6000 }] };
describe('generic spatial elements share floor geometry contracts', () => {
	it('keeps canonical labels through all immutable Plan copies and distinguishes absent/empty metadata', () => {
		const original = makePlan({ projectId: createProjectId() }), labels = [{ id: line.id, name: ' Garden path ' }];
		const plan = expectOk(withPlanSpatialElements(original, labels));
		expect(plan.spatialElements).toEqual([{ id: line.id, name: 'Garden path' }]);
		for (const copy of [plan.withBackground({ kind: 'image', path: 'reference.png' }), plan.withCalibration(null), withPlanRenovation(plan, undefined)]) expect(expectOk(copy).spatialElements).toEqual(plan.spatialElements);
		expect(expectOk(withPlanSpatialElements(plan, undefined)).spatialElements).toBeUndefined();
		for (const metadata of [[{ id: '', name: 'A' }], [{ id: line.id, name: ' ' }], [labels[0], labels[0]]]) expect(withPlanSpatialElements(plan, metadata)).toMatchObject({ ok: false, error: { code: 'plan.invalid-spatial-elements' } });
		expect(sameElementMetadata()).toBe(true); expect(sameElementMetadata([{ id: line.id, name: 'A' }], [{ id: line.id, name: 'B' }])).toBe(false);
		expect(validElementMetadataLinks(undefined, [undefined])).toBe(true);
		expect(validElementMetadataLinks(plan.spatialElements, [[line], [line]])).toBe(true);
		expect(validElementMetadataLinks([], [[line]])).toBe(false); expect(validElementMetadataLinks(plan.spatialElements, [])).toBe(false);
	});
	it('derives open polyline length and scales every coordinate while preserving identity', () => {
		expect(validSpatialElement(line)).toBe(true); expect(elementLength(line)).toBe(7000);
		const structure = { ...EMPTY_STRUCTURE, elements: [line] }, scaled = scaleStructure(structure, 2);
		expect(scaled.elements?.[0]).toEqual({ ...line, points: [{ x: -2000, y: 0 }, { x: 4000, y: 8000 }, { x: 4000, y: 12000 }] });
		expect(structure.elements[0]).toEqual(line);
	});
	it.each(['object', 'path', 'fence', 'measurement'] as const)('accepts the explicit %s shape without wall constraints', kind => {
		const element = { ...line, kind, points: kind === 'measurement' ? line.points.slice(0, 2) : line.points };
		expect(validateStructure({ ...EMPTY_STRUCTURE, elements: [element] }, [])).toMatchObject({ ok: true });
	});
	it('rejects malformed identities, kinds, coordinates and linear shapes', () => {
		const invalid: SpatialElement[] = [
			{ ...line, id: 'wall-a' }, { ...line, kind: 'wall' as never },
			{ ...line, points: [{ x: Infinity, y: 0 }, line.points[1]] },
			{ ...line, points: [{ x: 1e9 + 1, y: 0 }, line.points[1]] },
			{ ...line, kind: 'object', points: line.points.slice(0, 2) },
			{ ...line, kind: 'measurement' }, { ...line, points: [] },
			{ ...line, points: [line.points[0], line.points[0]] },
		];
		for (const element of invalid) expect(validateStructure({ ...EMPTY_STRUCTURE, elements: [element] }, [])).toMatchObject({ ok: false, error: { code: 'spatial.element-invalid' } });
		expect(validateStructure({ ...EMPTY_STRUCTURE, elements: [line, line] }, [])).toMatchObject({ ok: false, error: { code: 'spatial.duplicate-id' } });
		expect(validateStructure({ ...EMPTY_STRUCTURE, elements: [line] }, [line.id])).toMatchObject({ ok: false, error: { code: 'spatial.duplicate-id' } });
	});
	it('compares every element fact while ignoring independent element insertion order', () => {
		const second = { ...line, id: 'element-other' };
		const document = { objects: [], calibration: null, structure: { ...EMPTY_STRUCTURE, elements: [line, second] } };
		expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, elements: [second, line] } })).toBe(true);
		for (const changed of [{ ...line, kind: 'fence' as const }, { ...line, points: line.points.toReversed() }]) {
			expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, elements: [changed, second] } })).toBe(false);
		}
		expect(sameGeometryDocument({ ...document, structure: EMPTY_STRUCTURE }, { ...document, structure: { ...EMPTY_STRUCTURE, elements: [] } })).toBe(true);
	});
	it('accepts an asset placement only as two distinct points carrying an asset id', () => {
		const asset: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
		expect(validSpatialElement(asset)).toBe(true);
		for (const invalid of [
			{ ...asset, points: [asset.points[0]] },
			{ ...asset, points: [...asset.points, { x: 0, y: 5 }] },
			{ ...asset, points: [asset.points[0], asset.points[0]] },
			{ ...asset, assetId: undefined },
			{ ...asset, assetId: '' },
			{ ...line, assetId: 'asset-radiator' },
			{ ...line, kind: 'object' as const, assetId: 'asset-radiator' },
		]) expect(validSpatialElement(invalid)).toBe(false);
	});
	it('treats a changed asset id as a changed geometry document', () => {
		const asset: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-a', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
		const document = { objects: [], calibration: null, structure: { ...EMPTY_STRUCTURE, elements: [asset] } };
		expect(sameGeometryDocument(document, { ...document, structure: { ...EMPTY_STRUCTURE, elements: [{ ...asset, assetId: 'asset-b' }] } })).toBe(false);
	});
});
