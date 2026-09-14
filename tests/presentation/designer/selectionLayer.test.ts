/**
 * @vitest-environment jsdom
 *
 * What the designer draws for a selection, and what `Shift+2` frames — as data (symbols spec,
 * Decision 10). jsdom only because the palette is resolved the way the canvas resolves it.
 * `layers.test.ts` holds that the mounted canvas renders these configs at all.
 */
import { describe, expect, it } from 'vitest';
import { resolveThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { facingTip } from '../../../src/presentation/designer/layers/anchorLayer';
import { selectionFrame, selectionMarks } from '../../../src/presentation/designer/layers/selectionLayer';
import { TOILET, detailOutline } from '../../helpers/designerSelection';

const TOKENS = resolveThemeTokens(document.documentElement);
const TANK = detailOutline('detail-1');
const TANK_SELECTED = { kind: 'detail', id: 'detail-1' } as const;
const NO_CLEARANCE = { ...TOILET, clearance: null };

describe('selectionMarks', () => {
	it('draws nothing without a shape or without a selection', () => {
		expect(selectionMarks(null, TANK_SELECTED, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
		expect(selectionMarks(TOILET, null, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
	});

	it('restrokes a selected outline in the accent and draws eight square box handles and a round rotate handle', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'transform', TOKENS, 1);

		expect(marks.outline?.points).toEqual(TANK.points.flatMap((point) => [point.x, point.y]));
		expect(marks.outline?.stroke).toBe(TOKENS.accent);
		expect(marks.outline?.strokeWidth).toBe(2);
		expect(marks.outline?.listening).toBe(false);
		expect(marks.handles.filter((handle) => handle.cornerRadius === 0)).toHaveLength(8);
		expect(marks.handles.filter((handle) => handle.cornerRadius === 4)).toHaveLength(1);
		const topLeft = marks.handles.find((handle) => handle.x === TANK.points[0].x && handle.y === TANK.points[0].y);
		expect(topLeft).toMatchObject({ width: 8, height: 8, offsetX: 4, offsetY: 4, cornerRadius: 0, fill: TOKENS.canvasBackground, stroke: TOKENS.accent, listening: false });
	});

	it('draws one round handle per vertex in Edit points', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'points', TOKENS, 1);

		expect(marks.handles.map((handle) => ({ x: handle.x, y: handle.y }))).toEqual(TANK.points);
		expect(marks.handles.every((handle) => handle.cornerRadius === 4)).toBe(true);
	});

	it('sizes the marks in screen pixels at any zoom', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'points', TOKENS, 10);

		expect(marks.handles[0]).toMatchObject({ width: 80, offsetX: 40, cornerRadius: 40 });
	});

	it('draws nothing for a selected part the shape does not have', () => {
		expect(selectionMarks(NO_CLEARANCE, { kind: 'clearance' }, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
	});

	it('rings the anchor, or the facing tip, at the grab radius and leaves it unfilled', () => {
		const anchor = selectionMarks(TOILET, { kind: 'anchor' }, 'transform', TOKENS, 1);
		const facing = selectionMarks(TOILET, { kind: 'facing' }, 'transform', TOKENS, 1);
		const tip = facingTip(TOILET, 1);

		expect(anchor.outline).toBeNull();
		expect(anchor.handles).toHaveLength(1);
		expect(anchor.handles[0]).toMatchObject({ x: TOILET.anchor.x, y: TOILET.anchor.y, width: 16, cornerRadius: 8, stroke: TOKENS.accent });
		expect(anchor.handles[0]).not.toHaveProperty('fill');
		expect(facing.handles[0]).toMatchObject({ x: tip.x, y: tip.y });
	});
});

describe('selectionFrame', () => {
	it('frames nothing with no selection, or for a part the shape does not have', () => {
		expect(selectionFrame(TOILET, null, 1)).toBeNull();
		expect(selectionFrame(NO_CLEARANCE, { kind: 'clearance' }, 1)).toBeNull();
	});

	it('frames a selected outline’s box', () => {
		expect(selectionFrame(TOILET, TANK_SELECTED, 1)).toEqual({ min: TANK.points[0], max: TANK.points[2] });
	});

	it('frames the anchor, or the facing tip, as a point', () => {
		const tip = facingTip(TOILET, 10);

		expect(selectionFrame(TOILET, { kind: 'anchor' }, 10)).toEqual({ min: TOILET.anchor, max: TOILET.anchor });
		expect(selectionFrame(TOILET, { kind: 'facing' }, 10)).toEqual({ min: tip, max: tip });
	});
});
