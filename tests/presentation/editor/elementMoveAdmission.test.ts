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
	move.start(context, event, { id: 'object', kind: 'object', points: [...points, { x: 0, y: 1000 }] }, 0);
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
