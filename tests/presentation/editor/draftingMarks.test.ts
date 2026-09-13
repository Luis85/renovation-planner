// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DRAFTING_TEXT_PX, GRID_RADIUS_PX, draftingMarks } from '../../../src/presentation/editor/elements/draftingMarks';
import { createElementDraft, draftCursorPoints, draftPreviewFields } from '../../../src/presentation/editor/elements/elementDraft';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import { BOUNDARY_A, DIMENSION_A, GRID_A, HATCH_A, SECTION_A, TEXT_A, VIEW_A } from '../../helpers/drafting';

const apexY = (flipped: boolean) => draftingMarks({ ...SECTION_A, flipped }, 1).lines.filter(line => line.name === 'drafting-section-arrow').map(line => line.points[5]);

describe('drafting mark layout', () => {
	it('lays a dimension chain out as its line, one extension and tick per point, and one upright length per non-zero segment', () => {
		const marks = draftingMarks(DIMENSION_A, 1);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-line')).toEqual([expect.objectContaining({ points: [0, -600, 4560, -600] })]);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-extension')).toHaveLength(4);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-tick')).toHaveLength(4);
		expect(marks.texts.map(item => item.text)).toEqual([formatMetres(1190), formatMetres(750), formatMetres(2620)]);
		expect(marks.texts[0]).toMatchObject({ x: 595, y: -600, rotation: 0 });
		const zero = draftingMarks({ ...DIMENSION_A, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 3000, y: 0 }] }, 1);
		expect(zero.texts.map(item => item.text)).toEqual([formatMetres(1000), formatMetres(2000)]);
		expect(draftingMarks({ ...DIMENSION_A, points: [{ x: 0, y: 3000 }, { x: 0, y: 0 }] }, 1).texts[0].rotation).toBe(-90);
		expect(draftingMarks({ ...DIMENSION_A, points: [{ x: 0, y: 0 }, { x: 0, y: 3000 }] }, 1).texts[0].rotation).toBe(-90);
	});

	it('draws a section line\'s arrows on its look side, and on the other side once flipped', () => {
		expect(apexY(false)).toEqual([2010, 2010]);
		expect(apexY(true)).toEqual([1990, 1990]);
		const marks = draftingMarks(SECTION_A, 1);
		expect(marks.lines[0]).toMatchObject({ name: 'drafting-section-line', dash: [12, 3, 2, 3] });
		expect(marks.texts.map(item => item.text)).toEqual(['S-01', 'S-01']);
	});

	it('draws a view marker as a hollow triangle pointing where it looks, and every other mark by its kind', () => {
		const view = draftingMarks(VIEW_A, 1).lines[0];
		expect(view).toMatchObject({ name: 'drafting-view-arrow', closed: true });
		expect(view.fill).toBeUndefined();
		expect(view.points.slice(0, 2)).toEqual([-1490, 1000]);
		expect(draftingMarks(VIEW_A, 1).texts).toEqual([expect.objectContaining({ text: 'A-01' })]);
		expect(draftingMarks(HATCH_A, 1).lines[0]).toMatchObject({ name: 'drafting-hatch', closed: true, fill: 'pattern' });
		expect(draftingMarks(BOUNDARY_A, 2).lines[0]).toMatchObject({ name: 'drafting-boundary', dash: [8, 4] });
		expect(draftingMarks(GRID_A, 2).circles).toEqual([expect.objectContaining({ x: 7000, y: 0, radius: GRID_RADIUS_PX / 2 })]);
		expect(draftingMarks(GRID_A, 2).texts).toEqual([expect.objectContaining({ text: '1', x: 7000, y: 0 })]);
		expect(draftingMarks(TEXT_A, 1).texts).toEqual([expect.objectContaining({ text: 'Wintergarten', x: 1500, y: 1500, fontSize: DRAFTING_TEXT_PX, offsetY: DRAFTING_TEXT_PX / 2 })]);
		expect(draftingMarks({ id: 'element-path', kind: 'path', name: 'Path', points: BOUNDARY_A.points }, 1)).toEqual({ lines: [], texts: [], circles: [] });
	});

	it('previews a chain\'s line at the pointer while it is placed, and appends no cursor point then or once a kind is full', () => {
		const draft = createElementDraft();
		Object.assign(draft, { kind: 'dimension', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], cursor: { x: 2000, y: -800 }, offset: -100 });
		expect(draftCursorPoints(draft)).toEqual([{ x: 2000, y: -800 }]);
		expect(draftPreviewFields(draft)).toEqual({ offset: -100 });
		draft.dimensionPhase = 'offset';
		expect(draftCursorPoints(draft)).toEqual([]);
		expect(draftPreviewFields(draft)).toEqual({ offset: -800 });
		Object.assign(draft, { kind: 'section', dimensionPhase: 'points' });
		expect(draftCursorPoints(draft)).toEqual([]);
		expect(draftPreviewFields(draft)).toEqual({ flipped: false });
		Object.assign(draft, { kind: 'text', points: [{ x: 0, y: 0 }] });
		expect(draftCursorPoints(draft)).toEqual([]);
	});
});
