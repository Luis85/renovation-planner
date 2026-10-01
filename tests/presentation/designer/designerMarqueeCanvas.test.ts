/**
 * @vitest-environment jsdom
 *
 * AD08's remainder on the REAL mounted designer: the real canvas, the real tool wiring, the real
 * `assetDesignStore`, the real Parts panel and the real geometry sidecar — so what the unit rig
 * asserts about `RenderState` is checked here against the rectangle Konva actually draws and the
 * set the store actually holds.
 *
 * Two subjects, because both are one question about WHICH parts the user meant: the marquee, and
 * ruling AD08-R1's claim that a part lying under another is reachable through the Parts panel.
 *
 * The pragma is load-bearing rather than conventional: `vitest.config.ts` defaults to `node`, and
 * this file mounts through `designerRig`.
 */
import { describe, expect, it } from 'vitest';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { editableShape } from '../../helpers/assetShapes';
import { band, click, drag, FROM, held, selecting, SHORT, TO, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

/** A Parts panel row by the key `partRows` gives it. Throws rather than answering an empty wrapper. */
function row(rig: DesignerRig, key: string): Element {
	const found = rig.wrapper.find(`[name="${key}"]`);
	expect(found.exists()).toBe(true);
	return found.element;
}

/** 127 mm from the anchor, which a press would otherwise take within its 80 mm grab radius. */
const OVER_BOTH = { x: 90, y: 90 };

describe('a marquee on the mounted designer', () => {
	it('selects every graphic it swept and writes nothing to the sidecar', async () => {
		const rig = await selecting();
		const before = await rig.document();

		drag(rig, FROM, TO);
		await settle();

		expect(useAssetDesignStore(rig.pinia).selected).toEqual([
			{ kind: 'detail', id: 'detail-1' },
			{ kind: 'detail', id: 'detail-2' },
		]);
		// A preview is not a vault write (C05): the document that comes back is the one that went in.
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	/**
	 * Drawn while the button is still held, so the assertion is made between the move and the
	 * release; the release still comes, because a press is never left without one.
	 *
	 * A SHORT sweep, entirely inside the pane, so the pixels can be pinned: a marquee answers
	 * `tracksPointer`, which is the plan editor's own convention and means a pointer resting past
	 * the pane's edge scrolls the camera under the gesture. That is correct and is exactly what
	 * makes the long sweep's rectangle unpinnable — its anchored corner moves with the camera while
	 * the pointer's stays put. Ten screen pixels of travel clears the four-pixel threshold and
	 * reaches no edge.
	 */
	it('draws the rubber band where the pointer put it', async () => {
		const rig = await selecting();
		// The same two world points the gesture below is made of, read through the camera once so the
		// rectangle can be pinned in pixels. Nothing moves the camera between here and the assertion:
		// `SHORT` is exactly the corner that reaches no edge, which is what it exists for.
		const from = rig.at(FROM);
		const to = rig.at(SHORT);

		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', SHORT, 1);
		await settle();

		const drawn = band(rig);
		expect(drawn).toBeDefined();
		expect(drawn?.getAttr('x')).toBeCloseTo(Math.min(from.x, to.x), 6);
		expect(drawn?.getAttr('y')).toBeCloseTo(Math.min(from.y, to.y), 6);
		expect(drawn?.getAttr('width')).toBeCloseTo(Math.abs(to.x - from.x), 6);
		expect(drawn?.getAttr('height')).toBeCloseTo(Math.abs(to.y - from.y), 6);

		held(rig, 'pointerup', SHORT, 0);
		await settle();
		expect(band(rig)).toBeUndefined();
		rig.unmount();
	});

	/**
	 * The gesture immediately after a sweep, and the one that used to undo it.
	 *
	 * **This case is about the RUNTIME's wiring as much as about the tool.** `DesignerSelectTool`
	 * asks `deps.selected` for the whole set and falls back to the primary alone where nothing
	 * wires it — a fallback that makes the preservation below unreachable rather than wrong, which
	 * is precisely the failure no gate can see: the tool's own unit cases pass against their rig
	 * either way. `runtime.ts`'s `selectToolDeps` is the only thing that wires it in the product,
	 * and this is the only case that fails when it does not. Watched red by deleting that one line.
	 *
	 * `detail-1` spans x -400..0 by y -100..100, so its centre is 200 mm from the anchor and 250 mm
	 * from the nearest handle drawn around `detail-2`, the primary — both clear of the 80 mm grab
	 * radius, so the press lands on the graphic rather than on something drawn over it.
	 */
	it('keeps the swept set when a plain press lands inside it', async () => {
		const rig = await selecting();
		drag(rig, FROM, TO);
		await settle();
		const store = useAssetDesignStore(rig.pinia);
		expect(store.selected).toHaveLength(2);

		click(rig, { x: -200, y: 0 });
		await settle();

		expect(store.selected).toEqual([
			{ kind: 'detail', id: 'detail-1' },
			{ kind: 'detail', id: 'detail-2' },
		]);
		rig.unmount();
	});

	it('says how many parts are selected', async () => {
		const rig = await selecting();

		drag(rig, FROM, TO);
		await settle();

		// The inspector's count line, which AD08's selection set already fed and the marquee now
		// reaches — drawn only for two or more.
		expect(rig.wrapper.find('.rp-designer-selection-count').text()).toContain('2');
		rig.unmount();
	});
});

/**
 * Ruling **AD08-R1**: the Parts panel IS C05's "Parts alternative", so no overlap chooser is built.
 * The ruling rests on a claim about behaviour, and this is the claim under it — driven rather than
 * argued, because the honest answer to "I cannot click the part I want" has to be a route that
 * actually exists.
 *
 * `BURIED` is the hard case rather than a merely overlapping one: `under` lies wholly inside `over`,
 * so there is no point on the canvas at all where `hitDesign`'s `findLast` answers `under`.
 */
const BURIED = editableShape({
	details: [
		{ id: 'under', name: 'under', outline: { points: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] }, line: 'solid', pending: false },
		{ id: 'over', name: 'over', outline: { points: [{ x: -250, y: -200 }, { x: 250, y: -200 }, { x: 250, y: 200 }, { x: -250, y: 200 }] }, line: 'solid', pending: false },
	],
});

describe('a part lying under another part', () => {
	it('cannot be had by pressing the canvas, which deterministically takes the topmost', async () => {
		const rig = await selecting(BURIED);

		click(rig, OVER_BOTH);
		await settle();

		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'over' }]);
		rig.unmount();
	});

	it('is listed in the Parts panel, and its row selects it through the same door', async () => {
		const rig = await selecting(BURIED);

		(row(rig, 'detail:under') as HTMLElement).click();
		await settle();

		// The same `select` the canvas press above called, so there is one selection model and not two.
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'under' }]);
		rig.unmount();
	});

	/**
	 * Reachable by KEYBOARD, with no modifier: the list is one tab stop and the arrows walk it. What
	 * jsdom cannot show is the activation itself — it synthesises no click from Enter or Space on a
	 * focused button — so what is asserted is that the row a keyboard reaches IS a `<button>`, which
	 * is what makes both keys activate it in a browser. The gap is named here rather than papered
	 * over with a `trigger('click')` that would prove nothing about the keyboard.
	 */
	it('is reached by the arrow keys, on a row a keyboard can activate', async () => {
		const rig = await selecting(BURIED);
		const list = rig.wrapper.find('.rp-designer-part-list');

		await list.trigger('keydown', { key: 'ArrowDown' });
		await settle();

		// Graphics are listed topmost first, so one press down from `over` is `under`.
		const target = row(rig, 'detail:under');
		expect(document.activeElement).toBe(target);
		expect(target.tagName).toBe('BUTTON');
		expect(target.getAttribute('tabindex')).toBe('0');
		rig.unmount();
	});
});

/**
 * The two REGIONS the additive cases sweep, and they are disjoint on purpose: `editableShape()`
 * puts `detail-1` at x -400..0 and `detail-2` at x 50..450, so a rectangle can meet one and not the
 * other. Each sweep starts outside the clearance (x ±700), which is what makes its press a marquee
 * rather than a press on the clearance band.
 */
const LEFT = { from: { x: -1000, y: -50 }, to: { x: -50, y: 50 } };
const RIGHT = { from: { x: 1000, y: -50 }, to: { x: 20, y: 50 } };
const TANK = { kind: 'detail', id: 'detail-1' } as const;
const BOWL = { kind: 'detail', id: 'detail-2' } as const;

const selectionOf = (rig: DesignerRig): readonly unknown[] => useAssetDesignStore(rig.pinia).selected;

/**
 * **The release clears before it composes** (review finding F2), against the REAL store, which is
 * the only place `extend`'s toggle can answer. With `detail-1` already selected, the release's own
 * `extend(detail-1)` is the call that would REMOVE it.
 *
 * The part is put back mid-sweep through the Parts panel, because that is a route a held pointer
 * does not block: a row is a `<button>` in a list that is one tab stop, so a keyboard activation
 * reaches it with the canvas pointer still down. jsdom synthesises no click from Enter — the gap
 * `designerMarqueeCanvas`'s own AD08-R1 cases already name — so the row is clicked here, which is
 * the same `select` call that keyboard activation would make.
 */
describe('a sweep with a part selected under it', () => {
	it('composes the whole set, not what the store’s toggle left of it', async () => {
		const rig = await selecting();

		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', TO, 1);
		await settle();
		(row(rig, 'detail:detail-1') as HTMLElement).click();
		await settle();
		expect(selectionOf(rig)).toEqual([TANK]);

		held(rig, 'pointerup', TO, 0);
		await settle();

		expect(selectionOf(rig)).toEqual([TANK, BOWL]);
		rig.unmount();
	});
});

/**
 * **The additive sweep** (review finding F3). Two routes, both C05's, both driven here rather than
 * at the unit rig because what they have to produce is a SET and the set is the store's.
 */
describe('a sweep made additive', () => {
	it('adds to the selection under a held Shift instead of replacing it', async () => {
		const rig = await selecting();

		drag(rig, LEFT.from, LEFT.to);
		await settle();
		expect(selectionOf(rig)).toEqual([TANK]);

		drag(rig, RIGHT.from, RIGHT.to, { shiftKey: true });
		await settle();

		// A set spanning two regions of the canvas, which no gesture on this surface could build
		// before: the second sweep used to clear the first.
		expect(selectionOf(rig)).toEqual([TANK, BOWL]);
		rig.unmount();
	});

	/**
	 * The sticky control is the point of the other route: C05 requires that no modifier is needed
	 * for the only available way to compose a set, so this is the keyboard and touch route and it is
	 * driven through the real checkbox the Parts panel draws (AD18-R16 Task 7 moved it there from
	 * the Inspector).
	 */
	it('adds under the sticky select-multiple control, with no modifier held', async () => {
		const rig = await selecting();
		await rig.wrapper.find('[data-rp-action="multiple-selection"]').setValue(true);

		drag(rig, LEFT.from, LEFT.to);
		await settle();
		drag(rig, RIGHT.from, RIGHT.to);
		await settle();

		expect(selectionOf(rig)).toEqual([TANK, BOWL]);
		rig.unmount();
	});

	/**
	 * **It UNIONS, it does not toggle.** `extend` is a toggle, and sweeping across a part the user
	 * already selected and having it silently vanish is the opposite of what the gesture looks like
	 * it does — so a member the toggle removed is put straight back (`DesignerSelectTool.include`).
	 * This is the case that needs the store's real toggle to exist at all.
	 */
	it('leaves a part it swept over a second time selected', async () => {
		const rig = await selecting();
		drag(rig, LEFT.from, LEFT.to);
		await settle();
		drag(rig, RIGHT.from, RIGHT.to, { shiftKey: true });
		await settle();
		expect(selectionOf(rig)).toEqual([TANK, BOWL]);

		drag(rig, LEFT.from, LEFT.to, { shiftKey: true });
		await settle();

		// The tank is still there — moved to the end, because selection order is what makes a member
		// the primary and the sweep just crossed it.
		expect(selectionOf(rig)).toEqual([BOWL, TANK]);
		rig.unmount();
	});
});
