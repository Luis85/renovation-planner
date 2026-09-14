import { describe, expect, it } from 'vitest';
import { draftingKind, outlineKind, pointKind, validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { dimensionChain, dimensionOffsetAt } from '../../../src/domain/spatial/dimensionChain';
import { nextMarkName } from '../../../src/domain/spatial/markNames';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { EMPTY_RENOVATION, type RenovationSubject } from '../../../src/domain/renovation/Renovation';
import { validateRenovationTargets } from '../../../src/domain/renovation/renovationTargets';
import { sourceMeasurement, type RequirementSource } from '../../../src/domain/requirement/RequirementSource';

const dimension: SpatialElement = { id: 'element-dimension', kind: 'dimension', offset: -500, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 300 }, { x: 4560, y: 0 }] };
const section: SpatialElement = { id: 'element-section', kind: 'section', flipped: false, points: [{ x: -500, y: 2000 }, { x: 5000, y: 2000 }] };
const view: SpatialElement = { id: 'element-view', kind: 'view', points: [{ x: -800, y: 1000 }, { x: -300, y: 1000 }] };
const hatch: SpatialElement = { id: 'element-hatch', kind: 'hatch', points: [{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }] };
const text: SpatialElement = { id: 'element-text', kind: 'text', points: [{ x: 1500, y: 1500 }] };
const boundary: SpatialElement = { id: 'element-boundary', kind: 'boundary', points: [{ x: -2000, y: -1000 }, { x: 6000, y: -1500 }] };
const grid: SpatialElement = { id: 'element-grid', kind: 'grid', points: [{ x: 6500, y: 0 }] };
const path: SpatialElement = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };
const markSubject = (targetId: string): RenovationSubject => ({ id: 'detail-mark', targetId, kind: 'wall', existing: { description: 'Mark', condition: 'good' }, planned: null });

describe('drafting marks in the domain', () => {
	it('names the seven drafting kinds, the two one-point kinds, and a hatch as an outline', () => {
		expect([dimension, section, view, hatch, text, boundary, grid].every(item => draftingKind(item.kind))).toBe(true);
		expect(['object', 'path', 'measurement', 'post', 'beam', undefined].some(kind => draftingKind(kind))).toBe(false);
		expect(['text', 'grid'].every(kind => pointKind(kind))).toBe(true);
		expect(['dimension', 'view', undefined].some(kind => pointKind(kind))).toBe(false);
		expect(outlineKind('hatch')).toBe(true);
	});

	it('holds every drafting kind to its own points and fields, and every other kind to neither field', () => {
		for (const value of [dimension, section, view, hatch, text, boundary, grid]) expect(validSpatialElement(value)).toBe(true);
		const refused: SpatialElement[] = [
			{ ...dimension, offset: undefined }, { ...dimension, offset: Number.NaN }, { ...dimension, offset: 2e6 },
			{ ...dimension, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }] },
			{ ...section, flipped: undefined }, { ...section, points: [...section.points, { x: 6000, y: 2000 }] },
			{ ...view, points: [...view.points, { x: 0, y: 1000 }] },
			{ ...hatch, points: hatch.points.slice(0, 2) },
			{ ...text, points: [] }, { ...text, points: [...text.points, { x: 0, y: 0 }] }, { ...grid, points: [...grid.points, { x: 0, y: 0 }] },
			{ ...boundary, points: boundary.points.slice(0, 1) },
			{ ...path, offset: 100 }, { ...path, flipped: true }, { ...text, offset: 10 },
		];
		for (const value of refused) expect(validSpatialElement(value)).toBe(false);
	});

	it('projects a chain onto its first-to-last line and measures every segment there', () => {
		expect(dimensionChain(dimension.points, -500)).toMatchObject({
			feet: [{ x: 0, y: -500 }, { x: 1190, y: -500 }, { x: 1940, y: -500 }, { x: 4560, y: -500 }],
			lengths: [1190, 750, 2620],
		});
		expect(dimensionChain(dimension.points.toReversed(), 500)?.lengths).toEqual([2620, 750, 1190]);
		expect(dimensionChain([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 3000, y: 0 }], 0)?.lengths).toEqual([1000, 0, 2000]);
		expect(dimensionChain([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }], 0)).toBeNull();
		expect(dimensionChain([{ x: 0, y: 0 }], 0)).toBeNull();
	});

	it('reads a point\'s signed distance from the chain\'s line', () => {
		expect(dimensionOffsetAt(dimension.points, { x: 2000, y: -500 })).toBe(-500);
		expect(dimensionOffsetAt(dimension.points, { x: 2000, y: 800 })).toBe(800);
		expect(dimensionOffsetAt([{ x: 0, y: 0 }], { x: 2000, y: 800 })).toBe(0);
	});

	it('names the next free section, view and grid marker, and nothing for a kind named by its label', () => {
		expect(nextMarkName('section', [])).toBe('S-01');
		expect(nextMarkName('section', ['S-01', 'S-03'])).toBe('S-02');
		expect(nextMarkName('view', ['A-01'])).toBe('A-02');
		expect(nextMarkName('grid', ['1', ' 2 '])).toBe('3');
		expect(nextMarkName('dimension', [])).toBeNull();
	});

	it('scales a chain\'s offset with calibration and keeps a section\'s look side', () => {
		const scaled = scaleStructure({ ...EMPTY_STRUCTURE, elements: [dimension, section] }, 2);
		expect(scaled.elements?.[0]).toMatchObject({ offset: -1000, points: [{ x: 0, y: 0 }, { x: 2380, y: 0 }, { x: 3880, y: 600 }, { x: 9120, y: 0 }] });
		expect(scaled.elements?.[1]).toMatchObject({ flipped: false });
		expect(scaled.elements?.[1]).not.toHaveProperty('offset');
	});

	it('refuses a renovation record or a quantity on a drafting mark, and keeps both for a path', () => {
		const structure = { ...EMPTY_STRUCTURE, elements: [path, dimension] };
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [markSubject(path.id)] }, { roomIds: [], structure }).ok).toBe(true);
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [markSubject(dimension.id)] }, { roomIds: [], structure })).toMatchObject({ ok: false, error: { code: 'renovation.source-missing' } });
		const source: RequirementSource = { planId: 'plan', targetId: path.id, workId: '', outcomeId: '', state: 'current', rule: 'count', manual: '0', coverage: '1', lot: '', minimum: '' };
		const geometry = { objects: [], structure };
		expect(sourceMeasurement(source, 'room', geometry, 'piece').ok).toBe(true);
		expect(sourceMeasurement({ ...source, targetId: dimension.id }, 'room', geometry, 'piece').ok).toBe(false);
	});
});
