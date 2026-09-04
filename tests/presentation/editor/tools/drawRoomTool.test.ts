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

	/**
	 * **The release decides the rectangle, and `pointerUp` used to settle whatever the last
	 * `pointermove` had left.** W3C Pointer Events guarantees no move between a `pointerdown`
	 * and a `pointerup`, so a fast flick is a legal stream with none — and this tool computed
	 * `moved` from `event.worldPoint` (so the gesture correctly read as a DRAG, 4200 units
	 * against an epsilon of 4) and then settled a rect nothing had ever written. With no
	 * earlier rectangle that is `settle()` over a null rect: a drag the user completed
	 * produced no Room and no error.
	 *
	 * It is the house rule stated for the sibling tool and not carried here — `SelectTool`
	 * "records where a drag started in WORLD coordinates and computes the commit from the
	 * release's world coordinate". Two cases, because the two ways it goes wrong are
	 * different: with no prior rectangle the drag vanishes, and with one it silently keeps
	 * the OLD one, which is worse — the user sees a rectangle and it is the wrong rectangle.
	 */
	it('a drag with no move event at all still commits the rectangle the release names', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(1000, 200));
		tool.pointerUp(pointerAt(5200, 4000));
		expect(draft.rect).toEqual({ x: 1000, y: 200, width: 4200, depth: 3800 });
		expect(draft.valid).toBe(true);
	});

	it('a release away from the last move commits the release, not the last move', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(1000, 200));
		tool.pointerMove(pointerAt(2000, 1000));
		tool.pointerUp(pointerAt(5200, 4000));
		expect(draft.rect).toEqual({ x: 1000, y: 200, width: 4200, depth: 3800 });
	});

	/**
	 * The drag route's own half of design spec §2.7's "a side must be positive", which the
	 * numeric route has always kept (`parseMetres('0')` is `not-positive`) and this one did
	 * not. A drag straight along one axis clears the click epsilon — `moved` is 4200 world
	 * units against an epsilon of 4 — so `pointerUp` settles it rather than taking it back,
	 * and the store used to answer a rectangle of depth 0: `createPolygon` validates count and
	 * finiteness only, `Zone.create` defers to the same validator, and Create wrote a Room of
	 * area zero. Asserted through the STORE rather than through the tool, because the tool is
	 * unchanged: the refusal belongs to the one place both routes read.
	 */
	it('a drag along one axis alone settles no rectangle at all', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(1000, 4000));
		tool.pointerMove(pointerAt(3000, 4000));
		tool.pointerMove(pointerAt(5200, 4000));
		tool.pointerUp(pointerAt(5200, 4000));
		expect(draft.rect).toBeNull();
		expect(draft.valid).toBe(false);
		expect(draft.settledSize).toBeNull();
		expect(tool.hasDraft()).toBe(false);
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
