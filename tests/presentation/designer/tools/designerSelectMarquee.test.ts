/**
 * The marquee GESTURE (AD08's remainder, contract C05), driven through `DesignerSelectTool` at the
 * unit rig's one-world-millimetre-per-pixel camera. The inclusion rule itself is
 * `tests/presentation/designer/selection/marquee.test.ts`; what only this file can reach is the
 * pointer lifecycle around it — the threshold, the rubber band, each of C05's five interruptions,
 * and the fact that none of it writes anything.
 *
 * It also carries the two gestures the review round added around the sweep, because both are about
 * the SET a sweep leaves behind rather than about a rectangle: an ADDITIVE sweep, and the plain
 * press inside a set that must not collapse it (AD08's own acceptance criterion). Their describes
 * name the finding each answers.
 *
 * Every sweep starts at (1000, 1000) or another point outside the toilet's clearance, which reaches
 * x ±390 and y 950: that is what "empty canvas" means on this surface, since `hitDesign` answers the
 * footprint and the clearance band for everything inside them.
 */
import { describe, expect, it } from 'vitest';
import { flushGesture, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';
import { editableShape } from '../../../helpers/assetShapes';
import { TOILET, detailOutline, selectToolRig, type SelectToolRig, type SelectToolRigOptions } from '../../../helpers/designerSelection';

/**
 * `editableShape()` with ONE graphic reaching past its clearance (which stops at x = 700): the
 * rectangle x 600..800 by y -50..50. It exists so that a press on empty canvas can sit 1 mm from a
 * graphic, which the toilet's arrangement makes impossible — see the threshold cases below.
 */
const OUTLIER = editableShape({
	details: [{
		id: 'outlier',
		name: 'outlier',
		outline: { points: [{ x: 600, y: -50 }, { x: 800, y: -50 }, { x: 800, y: 50 }, { x: 600, y: 50 }] },
		line: 'solid',
		pending: false,
	}],
});

/** The middle of an outline's own bounding box — a point no handle and no anchor is near. */
function centreOf(outline: { readonly points: readonly { readonly x: number; readonly y: number }[] }): { x: number; y: number } {
	const xs = outline.points.map((point) => point.x), ys = outline.points.map((point) => point.y);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

const EMPTY = { x: 1000, y: 1000 };
const ACROSS_EVERYTHING = { x: -1000, y: -1000 };
const TANK = { kind: 'detail', id: 'detail-1' } as const;
const BOWL = { kind: 'detail', id: 'detail-2' } as const;

function armed(options: SelectToolRigOptions = {}): SelectToolRig {
	const rig = selectToolRig(options);
	rig.tool.activate(rig.harness.context);
	return rig;
}

/** A real sweep: down, a move, up — the stream a hand produces, never a down-then-up. */
function sweep(rig: SelectToolRig, from: { x: number; y: number }, to: { x: number; y: number }): void {
	rig.tool.pointerDown(pointerAt(from.x, from.y));
	rig.tool.pointerMove(pointerAt(to.x, to.y));
	rig.tool.pointerUp(pointerAt(to.x, to.y));
}

describe('a drag begun on empty canvas', () => {
	it('selects every graphic the rectangle met, and writes nothing at all', async () => {
		const rig = armed();

		sweep(rig, EMPTY, ACROSS_EVERYTHING);
		await flushGesture();

		expect(rig.extended).toEqual([TANK, BOWL]);
		// C05: a preview is not a vault write. No command was built, none was dispatched, and no
		// preview shape was ever drawn — a marquee has no shape to preview, only a rectangle.
		expect(rig.written).toEqual([]);
		expect(rig.harness.dispatched).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.rejected).toEqual([]);
		expect(rig.invalid).toEqual([]);
	});

	it('selects the same parts swept in either direction', () => {
		const forward = armed();
		const backward = armed();

		sweep(forward, { x: 1000, y: -260 }, { x: -1000, y: -240 });
		sweep(backward, { x: -1000, y: -240 }, { x: 1000, y: -260 });

		// Only the tank (y -350..-150) is under that band; the bowl starts at y -125.
		expect(forward.extended).toEqual([TANK]);
		expect(backward.extended).toEqual(forward.extended);
	});

	it('composes through the store\'s own extend rather than assigning a selection', () => {
		const rig = armed();

		sweep(rig, EMPTY, ACROSS_EVERYTHING);

		// `select` is called with NOTHING BUT null — twice, by the press and again by the release, which
		// is the review round's F2 fix — and every member arrives through `extend`, which is where
		// C05's rule about what may be composed lives. That the clear happens twice is the subject of
		// `the release of a non-additive sweep` below; what this case is about is that no selection is
		// ever ASSIGNED here.
		expect(rig.selected).toEqual([null, null]);
		expect(rig.extended).toHaveLength(2);
	});

	it('draws the rubber band while the button is held and takes it away at the release', () => {
		const rig = armed();
		const state = rig.harness.context.renderState;

		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		expect(state.marquee).toBeNull();

		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		expect(state.marquee).toEqual({ min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } });

		rig.tool.pointerUp(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		expect(state.marquee).toBeNull();
	});
});

describe('a press on empty canvas that never travels', () => {
	/**
	 * The fixture has to be built rather than borrowed: on the toilet every graphic is inside the
	 * clearance, so a press on empty canvas is nowhere near one and a jiggle that DID compose a set
	 * would still answer nothing. `OUTLIER` puts a graphic past the clearance's edge, which is the
	 * only arrangement where the threshold is the thing deciding the outcome.
	 */
	it('is a click: it clears the selection, draws no band and selects nothing', () => {
		const rig = armed({ shape: OUTLIER, selection: TANK });
		const state = rig.harness.context.renderState;

		// 1.5 mm at one millimetre per pixel — inside `CLICK_EPSILON_PX`, which is four — and the box
		// it would describe crosses the outlying graphic's top edge at y = 50.
		sweep(rig, { x: 750, y: 51 }, { x: 750, y: 49.5 });

		expect(rig.selected).toEqual([null]);
		expect(rig.extended).toEqual([]);
		expect(state.marquee).toBeNull();
	});

	it('becomes a sweep, and composes that same graphic, once it passes the threshold', () => {
		const rig = armed({ shape: OUTLIER });

		sweep(rig, { x: 750, y: 51 }, { x: 750, y: 45 });

		expect(rig.extended).toEqual([{ kind: 'detail', id: 'outlier' }]);
	});

	/**
	 * The threshold is SCREEN pixels through the camera as it stands, so the same world distance is a
	 * click at one zoom and a sweep at another. Both extremes, because a fixed world epsilon would
	 * pass one of them and fail the other.
	 */
	it('is judged in screen pixels at both zoom extremes', () => {
		const zoomedOut = armed({ context: { worldPerScreenPixel: 1000 } });
		const zoomedIn = armed({ context: { worldPerScreenPixel: 0.01 } });

		// 2828 mm of travel is under three screen pixels at 1000 mm per pixel: a click, no band.
		zoomedOut.tool.pointerDown(pointerAt(100000, 100000));
		zoomedOut.tool.pointerMove(pointerAt(98000, 98000));
		expect(zoomedOut.harness.context.renderState.marquee).toBeNull();

		// The same travel in world terms is 1.4 mm here, and that is 141 screen pixels: a sweep.
		zoomedIn.tool.pointerDown(pointerAt(1000, 1000));
		zoomedIn.tool.pointerMove(pointerAt(999, 999));
		expect(zoomedIn.harness.context.renderState.marquee).toEqual({ min: { x: 999, y: 999 }, max: { x: 1000, y: 1000 } });

		zoomedOut.tool.pointerUp(pointerAt(98000, 98000));
		zoomedIn.tool.pointerUp(pointerAt(999, 999));

		// Both released over empty canvas, so neither composes a set; what differed is the gesture.
		expect(zoomedOut.extended).toEqual([]);
		expect(zoomedIn.extended).toEqual([]);
	});
});

describe('the interruptions C05 names', () => {
	const interrupted = (interrupt: (rig: SelectToolRig) => void): SelectToolRig => {
		const rig = armed({ selection: TANK });
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		expect(rig.tool.hasDraft()).toBe(true);
		expect(rig.harness.context.renderState.marquee).not.toBeNull();
		interrupt(rig);
		return rig;
	};

	/**
	 * Escape and a tool switch (`cancel`), and `pointercancel` / focus loss / a release outside the
	 * leaf, which `EditorSurface` all route to `abandonGesture`. Every one leaves the same three
	 * facts: no band, no set composed, and no write.
	 *
	 * The selection they leave is the one the press cleared, PUT BACK — the review round's F4 fix, and
	 * what `MarqueeSelection.cancel` does on the other surface. This case asserted no restore until
	 * that finding; `a cancelled sweep` below is where the restore itself is the subject.
	 */
	it.each([
		['Escape or a tool switch', (rig: SelectToolRig): void => rig.tool.cancel()],
		['pointercancel, blur or a release outside the leaf', (rig: SelectToolRig): void => rig.tool.abandonGesture()],
		['view teardown', (rig: SelectToolRig): void => rig.tool.deactivate()],
	])('takes the band away and composes nothing: %s', (_name, interrupt) => {
		const rig = interrupted(interrupt);

		expect(rig.harness.context.renderState.marquee).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.extended).toEqual([]);
		expect(rig.selected).toEqual([null, TANK]);
		expect(rig.written).toEqual([]);
	});

	it('is over: a release after the interruption composes nothing', () => {
		const rig = interrupted((cancelled) => cancelled.tool.cancel());

		rig.tool.pointerUp(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		expect(rig.extended).toEqual([]);
	});

	it('is a DRAFT while it is running, so Escape reaches it before the selection', () => {
		const rig = armed({ selection: TANK });

		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));

		// `routeEscape` asks `hasDraft` first: a sweep with no move yet is still a gesture in flight.
		expect(rig.tool.hasDraft()).toBe(true);
	});

	it('carries the camera only once it is really a sweep', () => {
		const rig = armed();

		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		expect(rig.tool.tracksPointer()).toBe(false);

		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		expect(rig.tool.tracksPointer()).toBe(true);
	});

	it('leaves nothing drawn over the press that follows it', () => {
		const rig = armed();
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		// A release that never came — a secondary button's, say — then a fresh press elsewhere.
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));

		expect(rig.harness.context.renderState.marquee).toBeNull();
	});
});

describe('what the Parts panel has done to a graphic', () => {
	it('leaves a hidden one out, because a sweep cannot reach what is not drawn', () => {
		const rig = armed({ hidden: () => new Set(['detail-1']) });

		sweep(rig, EMPTY, ACROSS_EVERYTHING);

		expect(rig.extended).toEqual([BOWL]);
	});

	/**
	 * A LOCKED graphic is swept in. AD09's lock refuses a DRAG, and a marquee starts none — so the
	 * set a sweep builds is the same set shift-pressing each part builds, which is the property that
	 * would break if a lock were read here as well.
	 */
	it('keeps a locked one, which a marquee could not have moved anyway', async () => {
		const rig = armed({ locked: () => new Set(['detail-1', 'detail-2']) });

		sweep(rig, EMPTY, ACROSS_EVERYTHING);
		await flushGesture();

		expect(rig.extended).toEqual([TANK, BOWL]);
		expect(rig.written).toEqual([]);
	});
});

describe('a sweep begun while a write is still queued', () => {
	/**
	 * It is HELD and replayed once the chain drains (`hold` / `replayWhenSettled`), like every other
	 * press here — so the rectangle is composed against the design that write left rather than
	 * against the one the press saw. C05's "stale queued data" for this gesture; the mechanism
	 * itself is `designerSelectHold.test.ts`'s subject.
	 */
	it('composes nothing until the chain drains, and the full set afterwards', async () => {
		let queued = true;
		const rig = armed({ writing: () => queued, settled: () => Promise.resolve() });

		sweep(rig, EMPTY, ACROSS_EVERYTHING);
		await flushGesture();
		expect(rig.extended).toEqual([]);

		queued = false;
		await flushGesture();

		expect(rig.extended).toEqual([TANK, BOWL]);
		expect(rig.written).toEqual([]);
	});
});

/**
 * **The ADDITIVE sweep** (review finding F3). A marquee reads the same two additive routes a press
 * on a part reads — a held Shift and the sticky "select multiple" control — because C05 requires a
 * keyboard- and touch-reachable route to composing a set, and the plan editor's own
 * `MarqueeSelection.start` skips its clear on Shift for the same reason.
 *
 * What an additive sweep does is UNION, never toggle: sweeping across a part the user already
 * selected and having it silently vanish is the opposite of what the gesture looks like it does.
 * The mechanism is `DesignerSelectTool.include`, and its repair arm — a member `extend` toggled OFF
 * being put straight back — needs the store's REAL toggle to be reached at all, so it is
 * `designerMarqueeCanvas.test.ts` that drives it. What this file can see is which doors are called.
 */
describe('a sweep made additive', () => {
	it('clears nothing, under a held Shift, and composes every part it met', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK] });

		rig.tool.pointerDown(shiftPointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(shiftPointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		rig.tool.pointerUp(shiftPointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		// Neither the press nor the release calls `select`: an additive sweep adds to what is there.
		expect(rig.selected).toEqual([]);
		expect(rig.extended).toEqual([TANK, BOWL]);
	});

	it('clears nothing under the sticky control either, with no modifier held', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK], multiSelectionMode: () => true });

		sweep(rig, EMPTY, ACROSS_EVERYTHING);

		expect(rig.selected).toEqual([]);
		expect(rig.extended).toEqual([TANK, BOWL]);
	});

	/**
	 * The mode is read at the PRESS and latched on the draft, exactly as the plan editor's
	 * `MarqueeSelection` latches `additive` — so a control toggled off mid-sweep cannot turn the
	 * gesture the user began into a different one at the release.
	 */
	it('is decided at the press, not at the release', () => {
		let sticky = true;
		const rig = armed({ selection: TANK, selected: () => [TANK], multiSelectionMode: () => sticky });

		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		sticky = false;
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));
		rig.tool.pointerUp(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		expect(rig.selected).toEqual([]);
	});
});

/**
 * **The release CLEARS before it adds** (review finding F2). `extend` is the store's composition
 * door and it is correct only against an empty selection: with a SPECIAL part selected every call
 * degrades to `select`, and with a graphic already selected the matching call REMOVES it. The
 * non-additive release therefore clears first rather than resting on the press having done it — a
 * second pointer, or a Parts panel row activated while the sweep is open, is enough to put a part
 * back in between. What that composition actually produces is `designerMarqueeCanvas.test.ts`'s
 * subject, against the real store; what this file pins is that the door is called.
 */
describe('the release of a non-additive sweep', () => {
	it('clears the selection again before it composes one', () => {
		const rig = armed();

		sweep(rig, EMPTY, ACROSS_EVERYTHING);

		expect(rig.selected).toEqual([null, null]);
		expect(rig.extended).toEqual([TANK, BOWL]);
	});

	/** A sweep that met nothing still clears — the same answer a click on empty canvas gives. */
	it('clears even when the rectangle met nothing', () => {
		const rig = armed({ selection: TANK });

		sweep(rig, EMPTY, { x: 2000, y: 2000 });

		expect(rig.selected).toEqual([null, null]);
		expect(rig.extended).toEqual([]);
	});
});

/**
 * **Cancellation puts back what the press cleared** (review finding F4, and AD08's
 * *"Escape/pointercancel is none"*). `MarqueeSelection.cancel` restores its opening snapshot in
 * this same repository, and C12 asks this surface to match the Plan Editor's conventions — so the
 * snapshot is taken at the press and put back through the same two doors a user's own presses
 * compose a selection with.
 *
 * The MODE is not restored with it, and cannot be: the press's own `select(null)` reset it to
 * Transform before this gesture had anything to undo, and the store has no door that sets one.
 */
describe('a cancelled sweep', () => {
	it('puts back the selection the press cleared', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK] });
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		rig.tool.cancel();

		expect(rig.selected).toEqual([null, TANK]);
		expect(rig.extended).toEqual([]);
	});

	it('puts back every member of a set, not only its primary', () => {
		const rig = armed({ selection: BOWL, selected: () => [TANK, BOWL] });
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));

		rig.tool.abandonGesture();

		// `select` the first, `extend` the rest: selection order is what makes the last one primary.
		expect(rig.selected).toEqual([null, TANK]);
		expect(rig.extended).toEqual([BOWL]);
	});

	it('restores nothing for a sweep that cleared nothing, because it was additive', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK] });
		rig.tool.pointerDown(shiftPointerAt(EMPTY.x, EMPTY.y));

		rig.tool.cancel();

		expect(rig.selected).toEqual([]);
		expect(rig.extended).toEqual([]);
	});

	/**
	 * The NEXT PRESS is the one path through `dropMarquee` that must not restore: that press has
	 * just cleared the selection itself, and putting the old one back would undo its own gesture.
	 */
	it('is not restored by the press that follows an abandoned sweep', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK] });
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));

		expect(rig.selected).toEqual([null, null]);
	});
});

/**
 * **A plain press INSIDE the set** (review finding F5, and AD08's acceptance criterion *"Clicking
 * inside the current multi-selection preserves it until the user intentionally changes it"*). It is
 * the gesture that follows a sweep — three parts selected, now click one to look at it — and it
 * used to collapse the set to that one part.
 *
 * **What the press keeps and what it drags are two different things, deliberately.** The set and
 * its PRIMARY are both left exactly as they were, so the inspector goes on showing the part it was
 * showing; the drag that begins moves the part PRESSED, which is what a press has always dragged
 * here. Moving the whole set is AD08's own remainder and is not built here — `assetDesignStore` has
 * neither a door that re-focuses a member nor one that transforms several, and inventing either
 * would be a second answer to what a selection is.
 */
describe('a plain press on a member of a multi-part selection', () => {
	/**
	 * The tank's CENTRE, derived from its own outline rather than typed: a hundred millimetres from
	 * every handle the tank or the bowl could draw and 250 from the anchor, so what these cases
	 * measure is the selection rule and never a grab radius. `justInsideBottom` sits ten millimetres
	 * from an edge handle, which is inside the bowl's grab radius at this camera and made an earlier
	 * draft of these cases pass by hitting a HANDLE instead of the part.
	 */
	const inTank = centreOf(detailOutline('detail-1'));

	it('keeps the whole set rather than collapsing it to the part pressed', () => {
		const rig = armed({ selection: BOWL, selected: () => [BOWL, TANK] });

		rig.tool.pointerDown(pointerAt(inTank.x, inTank.y));

		expect(rig.selected).toEqual([]);
		expect(rig.extended).toEqual([]);
	});

	it('still begins the body drag, and it moves the part pressed', async () => {
		const rig = armed({ selection: BOWL, selected: () => [BOWL, TANK] });

		rig.tool.pointerDown(pointerAt(inTank.x, inTank.y));
		rig.tool.pointerMove(pointerAt(inTank.x, inTank.y + 200));
		rig.tool.pointerUp(pointerAt(inTank.x, inTank.y + 200));
		await flushGesture();

		const written = rig.written.at(0);
		expect(rig.written).toHaveLength(1);
		// The tank moved and the bowl did not: one part, chosen by the press rather than by the set.
		expect(written?.shape.details.at(1)).toEqual(TOILET.details.at(1));
		expect(written?.shape.details.at(0)).not.toEqual(TOILET.details.at(0));
	});

	it('replaces the selection for a part that is NOT a member of it', () => {
		const rig = armed({ selection: BOWL, selected: () => [BOWL] });

		rig.tool.pointerDown(pointerAt(inTank.x, inTank.y));

		expect(rig.selected).toEqual([TANK]);
	});

	/**
	 * Re-choosing the SINGLE selected part still goes through `select`, which is what keeps its
	 * point or bend mode (spec Amendment 1, through `sameSelection`). A one-member selection is not
	 * a set, and this rule must not quietly swallow that case.
	 */
	it('still re-chooses a part that is the whole selection, so its mode survives', () => {
		const rig = armed({ selection: TANK, selected: () => [TANK] });

		rig.tool.pointerDown(pointerAt(inTank.x, inTank.y));

		expect(rig.selected).toEqual([TANK]);
	});
});

/**
 * The two arms the cases above short-circuit past, each written because an untested arm in a slack
 * coverage metric hides completely: a sweep begun with NOTHING selected, whose snapshot is empty,
 * and a press on a part a set of two does NOT hold.
 */
describe('the empty edges of the two selection rules', () => {
	it('restores an empty selection as an empty one, rather than as a member of nothing', () => {
		const rig = armed({ selected: () => [] });
		rig.tool.pointerDown(pointerAt(EMPTY.x, EMPTY.y));
		rig.tool.pointerMove(pointerAt(ACROSS_EVERYTHING.x, ACROSS_EVERYTHING.y));

		rig.tool.cancel();

		expect(rig.selected).toEqual([null, null]);
		expect(rig.extended).toEqual([]);
	});

	/** The anchor is a special selection, so a set of graphics never holds it: pressing it replaces. */
	it('replaces a set of two with a part the set does not hold', () => {
		const rig = armed({ selection: BOWL, selected: () => [TANK, BOWL] });

		rig.tool.pointerDown(pointerAt(0, 0));

		expect(rig.selected).toEqual([{ kind: 'anchor' }]);
	});
});
