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
		// There is no RECTANGLE, and there is still something on screen to take back: the drag
		// wrote both field texts (`4.2` and `0`), so Escape clears them and keeps the task
		// rather than throwing the renovator out of it. This assertion read `false` while
		// `hasDraft()` was `rect !== null`, which is the narrow predicate rather than the rule.
		expect(draft.depthText).toBe('0');
		expect(tool.hasDraft()).toBe(true);
	});

	/**
	 * **A click takes back the PRESS, and the press's one writer is `setRect`.** `pointerUp`'s
	 * click arm used to restore from `rectBefore` — a `RoomRect | null`, which cannot express
	 * the state a half-typed draft is in: width known, depth not, so `rect` is null. Restoring
	 * from it therefore ran `clearRect()`, which nulls both sides, both texts, both errors and
	 * the announced sentence. So: type `4.2` into Width, then press and release once on the
	 * plan — the mousedown's own default blurs the input and commits the width, the press
	 * writes a tiny rect, and the click that takes it back took the typed width with it, with
	 * no message anywhere.
	 *
	 * Asserted on the TEXT as well as the side: the text is what the user is looking at, and
	 * the two are written by the same call.
	 */
	it('a click takes back the tiny rect the press wrote and leaves a typed width alone', () => {
		const { tool, draft } = armed();
		draft.commitDimension('width', '4.2', () => ({ x: 0, y: 0 }));
		expect(draft.widthMm).toBe(4200);
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.pointerUp(pointerAt(102, 101));
		expect(draft.rect).toBeNull();
		expect(draft.widthMm).toBe(4200);
		expect(draft.widthText).toBe('4.2');
		expect(draft.depthMm).toBeNull();
	});

	it('abandonGesture takes back the tiny rect the press wrote and leaves a typed width alone', () => {
		const { tool, draft } = armed();
		draft.commitDimension('width', '4.2', () => ({ x: 0, y: 0 }));
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.abandonGesture();
		expect(draft.rect).toBeNull();
		expect(draft.widthMm).toBe(4200);
		expect(draft.widthText).toBe('4.2');
	});

	/**
	 * The other half of the same over-reach, through the arm that DID have a rectangle to
	 * restore: `setRect(rectBefore)` rewrites both texts from `formatMetres` and clears both
	 * errors, so a click anywhere on the plan silently replaced a value the user had typed and
	 * the store had refused — against `room-draft-store.ts`'s own stated rule that "a refused
	 * value stays on screen verbatim … the user's own typing is never silently replaced".
	 */
	it('a click restores the rectangle without replacing a refused value or its reason', () => {
		const { tool, draft } = armed();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		draft.commitDimension('width', 'abc', () => ({ x: 0, y: 0 }));
		expect(draft.widthError).toBe('not-a-number');
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.pointerUp(pointerAt(102, 101));
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 4200, depth: 3800 });
		expect(draft.widthText).toBe('abc');
		expect(draft.widthError).toBe('not-a-number');
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

	/**
	 * `cancel()` is the DELIBERATE half of the pair (Escape, a tool switch) and clears the
	 * rectangle and both dimension surfaces — exactly what `hasDraft()` counts, so a second
	 * Escape can still leave the task. It KEEPS the name, which is design spec §3's own list
	 * ("origin/width/depth/texts/errors cleared; name and keepAdding kept") and the reason
	 * `hasDraft()` must not count one: a predicate true of something `cancel()` clears more
	 * than would either make Escape inert or force it to take back a choice the renovator made
	 * for a gesture aimed at the rectangle.
	 *
	 * `abandonGesture()` is the INTERRUPTION half and takes back only the press. Asserted here
	 * against the same fixture so the two are visibly different amounts of undo rather than two
	 * cases nobody compares.
	 */
	it('cancel clears the rectangle and keeps the name; abandonGesture restores only the press', () => {
		const { tool, draft } = armed();
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.pointerDown(pointerAt(5000, 5000));
		tool.pointerMove(pointerAt(6000, 6000));
		tool.abandonGesture();
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(draft.name).toBe('Kitchen');
		tool.cancel();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Kitchen');
		expect(draft.keepAdding).toBe(false);
		expect(tool.hasDraft()).toBe(false);
	});

	/**
	 * **`hasDraft()` is what Escape asks (`routeEscape`), and it saw one of the six things a
	 * renovator can put into this task.** Reading `rect !== null` alone meant that pressing
	 * the `Kitchen` suggestion and typing `4.2` into Width left it FALSE — so Escape fell
	 * through to the return-to-Select arm, `setTool('select')` ran `deactivate()` → `reset()`,
	 * and the name, the typed width, both texts and `keepAdding` went with the task. The
	 * identical keypress with a DRAGGED rectangle present only cleared the rectangle and kept
	 * the user in the task: one gesture, two answers, decided by which surface the user had
	 * reached for.
	 *
	 * The two halves are asserted together on purpose — that the predicate now SEES the input,
	 * and that one `cancel()` clears what it saw, so the second Escape still leaves the task.
	 */
	it('a typed side with no rectangle is a draft, and one cancel clears it', () => {
		const { tool, draft } = armed();
		expect(tool.hasDraft()).toBe(false);
		draft.commitDimension('width', '4.2', () => ({ x: 0, y: 0 }));
		expect(tool.hasDraft()).toBe(true);
		tool.cancel();
		expect(draft.widthText).toBe('');
		expect(draft.widthMm).toBeNull();
		expect(tool.hasDraft()).toBe(false);
	});

	/**
	 * **A chosen name alone is NOT a draft, and it survives the Escape that clears one.** Both
	 * halves are the same decision seen from its two ends. There is nothing for Escape to
	 * cancel when only a name has been chosen, so it falls through to the return-to-Select arm
	 * — which is what `routeEscape` does for any creation tool with nothing drawn, and what
	 * stops the tool sitting in a task Escape can never leave. And because the name is not
	 * counted, `cancel()` never has to clear it: a renovator who chose `Kitchen` and then
	 * dragged a rectangle they did not like presses Escape once and keeps the name.
	 *
	 * `nameTouched` therefore has no `src/` reader again, and its own docblock records that it
	 * briefly had one and why it gave it back.
	 */
	it('a chosen name is not a draft on its own, and survives cancelling one', () => {
		const { tool, draft } = armed();
		expect(draft.name).toBe('Room 1');
		expect(tool.hasDraft()).toBe(false);
		draft.suggestName('Kitchen');
		expect(tool.hasDraft()).toBe(false);

		draft.commitDimension('width', '4.2', () => ({ x: 0, y: 0 }));
		expect(tool.hasDraft()).toBe(true);
		tool.cancel();
		expect(tool.hasDraft()).toBe(false);
		expect(draft.name).toBe('Kitchen');
	});

	/**
	 * A refusal with no text left behind is the one input shape the texts alone cannot see: a
	 * renovator who types `4.2`, deletes it and tabs away leaves an EMPTY field carrying
	 * `not-a-number`, which is a message on screen that Escape has to be able to clear.
	 */
	it('a refusal left on an emptied field is a draft too', () => {
		const { tool, draft } = armed();
		draft.commitDimension('depth', '', () => ({ x: 0, y: 0 }));
		expect(draft.depthText).toBe('');
		expect(draft.depthError).toBe('not-a-number');
		expect(tool.hasDraft()).toBe(true);
		tool.cancel();
		expect(draft.depthError).toBeNull();
		expect(tool.hasDraft()).toBe(false);
	});

	/**
	 * `keepAdding` is deliberately NOT input into the room being drawn: it is a mode for the
	 * TASK ("after this one, start another"), which `createRoomFromDraft` re-applies across a
	 * creation on purpose. Counting it would make Escape's first press unable to clear it and
	 * so unable to progress, for a checkbox no room carries.
	 */
	it('keepAdding is a mode for the task, not a draft to be cancelled', () => {
		const { tool, draft } = armed();
		draft.setKeepAdding(true);
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
