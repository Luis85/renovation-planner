import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DrawRoomTool } from '../../../../src/presentation/editor/tools/draw-room-tool';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

function armed() {
	const draft = useRoomDraftStore();
	const tool = new DrawRoomTool({ draft, defaultName: () => 'Room 1' });
	const { context } = toolContext(); // worldPerScreenPixel 1 → epsilon is 4 world units
	tool.activate(context);
	return { tool, draft, context };
}

describe('DrawRoomTool', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('activation begins the task with the default name and no rectangle', () => {
		const { draft } = armed();
		expect(draft.name).toBe('Room 1');
		expect(draft.rect).toBeNull();
	});

	it('a drag in any direction yields one normalised rectangle, and settles once on release', () => {
		const { tool, draft } = armed();
		let settles = 0;
		const original = draft.settle;
		draft.settle = () => { settles += 1; original(); };
		tool.pointerDown(pointerAt(5000, 4000));
		tool.pointerMove(pointerAt(3000, 4500));
		tool.pointerMove(pointerAt(800, 200));
		expect(draft.rect).toEqual({ x: 800, y: 200, width: 4200, depth: 3800 });
		tool.pointerUp(pointerAt(800, 200));
		expect(draft.rect).toEqual({ x: 800, y: 200, width: 4200, depth: 3800 });
		expect(settles).toBe(1);
		expect(tool.hasDraft()).toBe(true);
	});

	it('a click under the epsilon leaves the previous rectangle alone', () => {
		const { tool, draft } = armed();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.pointerUp(pointerAt(102, 101));
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 4200, depth: 3800 });
	});

	it('ignores a secondary press', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(0, 0, 'secondary'));
		tool.pointerMove(pointerAt(500, 500, 'secondary'));
		tool.pointerUp(pointerAt(500, 500, 'secondary'));
		expect(draft.rect).toBeNull();
	});

	it('cancel clears the rectangle and keeps the name; abandonGesture restores the pre-press rectangle', () => {
		const { tool, draft } = armed();
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.pointerDown(pointerAt(5000, 5000));
		tool.pointerMove(pointerAt(6000, 6000));
		tool.abandonGesture();
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.cancel();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Kitchen');
		expect(tool.hasDraft()).toBe(false);
	});

	it('deactivate resets the whole draft', () => {
		const { tool, draft } = armed();
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.deactivate();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('');
	});

	// The five tests above never press-click with NO pre-existing rectangle, so they never
	// drive the `rectBefore === null` arm of either `pointerUp`'s or `abandonGesture`'s
	// restore — both would otherwise clear the tiny rect the move wrote, and neither branch
	// had a test at the coverage floor's current headroom. Added rather than assumed away.

	it('a click with no previous rectangle clears the tiny rect the press wrote', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.pointerUp(pointerAt(102, 101));
		expect(draft.rect).toBeNull();
	});

	it('abandonGesture between presses is a no-op', () => {
		const { tool, draft } = armed();
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.abandonGesture();
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 1000, depth: 1000 });
	});

	it('abandonGesture with no previous rectangle clears the tiny rect the press wrote', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(5000, 5000));
		tool.pointerMove(pointerAt(6000, 6000));
		tool.abandonGesture();
		expect(draft.rect).toBeNull();
	});
});
