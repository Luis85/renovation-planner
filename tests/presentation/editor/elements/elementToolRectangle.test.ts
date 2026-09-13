import { describe, expect, it } from 'vitest';
import { ElementTool } from '../../../../src/presentation/editor/elements/ElementTool';
import { createElementDraft, type ElementToolId } from '../../../../src/presentation/editor/elements/elementDraft';
import type { ObjectShapeMode } from '../../../../src/presentation/editor/elements/objectShape';
import type { Point } from '../../../../src/core/geometry/Point';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

function armed(id: ElementToolId = 'place-object', shape: ObjectShapeMode = 'rectangle') {
	const draft = createElementDraft();
	draft.shape = shape;
	const tool = new ElementTool(id, {
		draft, start: () => undefined, stop: () => undefined, blocked: () => false, finish: () => undefined,
		addPoint: (point: Point) => { draft.points.push(point); return true; },
		setPoints: (points: readonly Point[]) => { draft.points = points.map(point => ({ ...point })); return true; },
	});
	tool.activate(toolContext().context);
	return { tool, draft };
}

const RECT = [{ x: 800, y: 200 }, { x: 5000, y: 200 }, { x: 5000, y: 4000 }, { x: 800, y: 4000 }];

describe('ElementTool, an item in rectangle mode', () => {
	it('follows the drag with one normalised rectangle and lets the release name it', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(5000, 4000));
		tool.pointerMove(pointerAt(3000, 4500));
		expect(draft.points).toEqual([{ x: 3000, y: 4000 }, { x: 5000, y: 4000 }, { x: 5000, y: 4500 }, { x: 3000, y: 4500 }]);
		tool.pointerUp(pointerAt(800, 200));
		expect(draft.points).toEqual(RECT);
		tool.pointerMove(pointerAt(0, 0));
		expect(draft.points).toEqual(RECT);
	});

	it('replaces the rectangle with the next drag, and a click keeps it', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(800, 200)); tool.pointerUp(pointerAt(5000, 4000));
		tool.pointerDown(pointerAt(2000, 2000)); tool.pointerUp(pointerAt(2000, 2000));
		expect(draft.points).toEqual(RECT);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerUp(pointerAt(100, 50));
		expect(draft.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
	});

	it('stops following once the gesture is abandoned, cancelled or the tool is left', () => {
		for (const end of ['abandonGesture', 'cancel', 'deactivate'] as const) {
			const { tool, draft } = armed();
			tool.pointerDown(pointerAt(800, 200)); tool.pointerMove(pointerAt(5000, 4000));
			tool[end]();
			const after = draft.points.map(point => ({ ...point }));
			tool.pointerMove(pointerAt(9000, 9000)); tool.pointerUp(pointerAt(9000, 9000));
			expect(draft.points).toEqual(after);
		}
	});

	it('clears the drag anchor on deactivate, so a later activation does not resume the old drag', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(800, 200)); tool.pointerMove(pointerAt(5000, 4000));
		const after = draft.points.map(point => ({ ...point }));
		tool.deactivate();
		tool.activate(toolContext().context);
		tool.pointerMove(pointerAt(9000, 9000));
		expect(draft.points).toEqual(after);
	});

	it('keeps the shape mode through cancel — Escape clears the outline, not the choice of how to draw it', () => {
		const { tool, draft } = armed('place-object', 'free');
		tool.pointerDown(pointerAt(0, 0)); tool.pointerUp(pointerAt(0, 0));
		tool.cancel();
		expect(draft.shape).toBe('free'); expect(draft.points).toEqual([]);
	});
});

describe('ElementTool, corner by corner', () => {
	it.each([['place-object', 'free'], ['draw-path', 'rectangle']] as const)('adds one point per click for %s in %s mode', (id, shape) => {
		const { tool, draft } = armed(id, shape);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerUp(pointerAt(0, 0));
		tool.pointerDown(pointerAt(2000, 0)); tool.pointerMove(pointerAt(2500, 900)); tool.pointerUp(pointerAt(2500, 900));
		expect(draft.points).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }]);
	});
});
