import { expect, it, vi } from 'vitest';
import { rotationHandleGeometry, rotationPivot } from '../../../src/presentation/editor/elements/objectRotation';
import { ElementMove, type ElementMoveDeps } from '../../../src/presentation/editor/elements/ElementMove';
import { DEFAULT_STAIR } from '../../../src/domain/spatial/stairGeometry';
import { pointerAt, toolContext } from '../../helpers/tool-context';
import type { SpatialObjectCandidate } from '../../../src/presentation/editor/tools/select-tool';

const CENTRELINE = [{ x: 0, y: 0 }, { x: 2000, y: 0 }];

it('answers no rotation pivot for a Stair that cannot be laid out, and no handle with it', () => {
	// A Stair rotates about its drawn footprint, so without one there is nothing to rotate about.
	const missing = { id: 'stair-1', kind: 'stair' as const, points: CENTRELINE };
	expect(rotationPivot(missing)).toBeNull();
	expect(rotationHandleGeometry(missing, 1)).toBeNull();
	// A profile that cannot be laid out on a collapsed centreline is refused the same way.
	expect(rotationPivot({ ...missing, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stair: DEFAULT_STAIR })).toBeNull();
	// The same centreline with a usable profile does have both.
	const usable = { ...missing, stair: DEFAULT_STAIR };
	expect(rotationPivot(usable)).not.toBeNull();
	expect(rotationHandleGeometry(usable, 1)).not.toBeNull();
});

it('carries a Stair profile into the move gesture rather than dropping it at the press', () => {
	const { context } = toolContext();
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>();
	const move = new ElementMove({ moveElement, previewElement: vi.fn<NonNullable<ElementMoveDeps['previewElement']>>() });
	const hit: SpatialObjectCandidate = { id: 'stair-1', kind: 'stair', points: CENTRELINE, stair: DEFAULT_STAIR };
	move.start(context, pointerAt(0, 0), hit);
	move.finish(context, pointerAt(500, 0));
	expect(moveElement).toHaveBeenCalledExactlyOnceWith('stair-1', [{ x: 500, y: 0 }, { x: 2500, y: 0 }],
		{ id: 'stair-1', kind: 'stair', points: CENTRELINE, stair: DEFAULT_STAIR });
	// An element with no profile carries no `stair` key at all, rather than an undefined one.
	moveElement.mockClear();
	const plain: SpatialObjectCandidate = { id: 'arrow-1', kind: 'arrow', points: CENTRELINE };
	move.start(context, pointerAt(0, 0), plain);
	move.finish(context, pointerAt(500, 0));
	expect(moveElement.mock.calls[0]?.[2]).toEqual({ id: 'arrow-1', kind: 'arrow', points: CENTRELINE });
});
