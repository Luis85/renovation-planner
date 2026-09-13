import { expect, it, vi } from 'vitest';
import { ElementMove } from '../../../src/presentation/editor/elements/ElementMove';
import type { ElementMoveDeps } from '../../../src/presentation/editor/elements/ElementMove';
import { pointerAt, shiftPointerAt, toolContext } from '../../helpers/tool-context';
import { expectDefined } from '../../helpers/domain';

it('declines unsupported move and vertex targets, then translates a Stair while retaining its geometry options', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>(), previewElement = vi.fn<NonNullable<ElementMoveDeps['previewElement']>>();
	const move = new ElementMove({ moveElement, previewElement }), { context } = toolContext();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }], event = pointerAt(0, 0);
	move.start(context, event, { id: 'room', points });
	move.start(context, event, { id: 'wall', kind: 'wall', points });
	move.start(context, event, { id: 'opening', kind: 'opening', points });
	move.start(context, event, { id: 'stair', kind: 'stair', points, stair: { width: 900, treads: 12, direction: 'up' } }, 0);
	move.start(context, event, { id: 'path', kind: 'path', points }, 2);
	move.start(context, event, { id: 'arrow', kind: 'arrow', points }, 2);
	expect(move.active).toBe(false); expect(moveElement).not.toHaveBeenCalled(); expect(previewElement).not.toHaveBeenCalled();
	const stair = { id: 'element-stair', kind: 'stair' as const, points, stair: { width: 950, treads: 9, direction: 'down' as const } };
	move.start(context, event, stair); move.move(pointerAt(100, 200)); move.finish(context, pointerAt(150, 250));
	expect(moveElement).toHaveBeenCalledWith(stair.id, [{ x: 150, y: 250 }, { x: 1150, y: 250 }], stair);
	expect(stair.points).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }]); expect(previewElement).toHaveBeenLastCalledWith(stair.id, [{ x: 150, y: 250 }, { x: 1150, y: 250 }]);
});

it('anchors an Arrow first-endpoint constraint at its next point and rejects collapsing that endpoint onto its neighbour', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>(), move = new ElementMove({ moveElement });
	const { context } = toolContext(), arrow = { id: 'element-arrow', kind: 'arrow' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
	move.start(context, pointerAt(0, 0), arrow, 0); move.move(shiftPointerAt(400, -600)); move.finish(context, shiftPointerAt(400, -600));
	expect(moveElement).toHaveBeenCalledTimes(1);
	const [id, points, original] = expectDefined(moveElement.mock.calls[0], 'accepted endpoint move');
	expect(id).toBe(arrow.id); expect(original).toEqual(arrow); expect(points).toHaveLength(2);
	expect(points[0].x).toBe(400); expect(points[0].y).toBeCloseTo(-600, 9); expect(points[1]).toBe(arrow.points[1]);
	moveElement.mockClear(); move.start(context, pointerAt(0, 0), arrow, 0); move.finish(context, pointerAt(1000, 0));
	expect(moveElement).not.toHaveBeenCalled(); expect(move.active).toBe(false); expect(arrow.points[0]).toEqual({ x: 0, y: 0 });
});

it('snaps a body move rigidly against the plan minus itself, draws guides, and clears them on finish and cancel', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>(), previewElement = vi.fn<NonNullable<ElementMoveDeps['previewElement']>>();
	const excluded: string[][] = [];
	const { context } = toolContext({ snapCandidates: (exclude) => { excluded.push([...(exclude ?? [])]); return { alignments: [{ x: 1003, y: 900 }] }; } });
	const move = new ElementMove({ moveElement, previewElement });
	const object = { id: 'element-object', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
	move.start(context, pointerAt(0, 0), object); move.move(pointerAt(900, 0));
	// Raw delta +900 puts the right edge at 1000, 3 from the alignment: corrected to 1003 for every point.
	expect(previewElement).toHaveBeenLastCalledWith(object.id, [{ x: 903, y: 0 }, { x: 1003, y: 0 }, { x: 1003, y: 100 }]);
	// (1000, 0) is the first feature 3 from the alignment; corrected, the guide starts there.
	expect(context.renderState.snapGuides).toEqual([{ start: { x: 1003, y: 0 }, end: { x: 1003, y: 900 } }]);
	expect(excluded.every((ids) => ids.includes(object.id))).toBe(true);
	move.finish(context, pointerAt(900, 0));
	expect(moveElement).toHaveBeenCalledWith(object.id, [{ x: 903, y: 0 }, { x: 1003, y: 0 }, { x: 1003, y: 100 }], object);
	expect(context.renderState.snapGuides).toEqual([]);
	move.start(context, pointerAt(0, 0), object); move.move(pointerAt(900, 0)); expect(context.renderState.snapGuides).toHaveLength(1);
	move.cancel(); expect(context.renderState.snapGuides).toEqual([]);
});

it('previews a move within the click epsilon raw and without guides, since finish discards it', () => {
	const previewElement = vi.fn<NonNullable<ElementMoveDeps['previewElement']>>();
	const { context } = toolContext({ snapCandidates: () => ({ alignments: [{ x: 103, y: 900 }] }) });
	const move = new ElementMove({ moveElement: () => undefined, previewElement });
	const object = { id: 'element-object', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
	move.start(context, pointerAt(0, 0), object); move.move(pointerAt(1, 0));
	// Right edge at 101, 2 from the alignment: within tolerance, but a 1 px jitter is a click.
	expect(previewElement).toHaveBeenLastCalledWith(object.id, [{ x: 1, y: 0 }, { x: 101, y: 0 }, { x: 101, y: 100 }]);
	expect(context.renderState.snapGuides).toEqual([]);
	move.move(pointerAt(5, 0));
	expect(previewElement).toHaveBeenLastCalledWith(object.id, [{ x: 3, y: 0 }, { x: 103, y: 0 }, { x: 103, y: 100 }]);
	expect(context.renderState.snapGuides).toHaveLength(1);
});

it('snaps a vertex drag through the guided point snap', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>();
	const { context } = toolContext({ snapCandidates: () => ({ vertices: [{ x: 504, y: 0 }] }) });
	const move = new ElementMove({ moveElement });
	const path = { id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
	move.start(context, pointerAt(0, 0), path, 0); move.move(pointerAt(500, 0));
	expect(context.renderState.snapGuides).toEqual([{ start: { x: 500, y: 0 }, end: { x: 504, y: 0 } }]);
	move.finish(context, pointerAt(500, 0));
	expect(moveElement.mock.calls[0]?.[1]).toEqual([{ x: 504, y: 0 }, { x: 1000, y: 0 }]);
});
