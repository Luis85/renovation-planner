/**
 * @vitest-environment jsdom
 *
 * The designer's toolbar: the ONE control that makes design slice B5's tools reachable.
 *
 * **This file is this increment's guard against design slice 7 repeating itself.**
 * `CalibrateTool` was written, proven by its own tests, absent from the registration list, and
 * unreachable for two whole slices with all four gates green — because nothing was wrong with
 * the code, and it took a human opening the toolbar. The plan for this increment says the same
 * thing about this task in particular: it had no toolbar component in any Phase B file list
 * while its commit message promised "a toolbar that reaches all of them".
 *
 * So every case here drives ACTIVATION through the MOUNTED designer. Asserting that six
 * buttons render is satisfied by six buttons wired to nothing, exactly as a passing
 * `ToolManager` test is satisfied by a manager nobody drives: each case presses the control and
 * then asks that leaf's own manager what is active. `ToolManager.setActiveTool` throws for an
 * id nothing registered, so a button offering a tool the registration forgot cannot report it
 * active however the click is handled.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { DESIGNER_TOOL_LABELS } from '../../../src/presentation/designer/tools/registerDesignerTools';
import { settle } from '../../helpers/editor';
import { designerRig, tracePolygon, type DesignerRig } from '../../helpers/designerRig';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { shapeWithOpenGraphic, toiletShape } from '../../helpers/assetShapes';

/**
 * Every tool the toolbar offers, as `(id, label)` pairs read from the table the toolbar itself
 * builds its buttons from.
 *
 * READ from that table rather than copied into this file, and the difference is the whole
 * lesson: a copied list is exactly what let slice 7's tool go missing, and a case comparing two
 * hand-written lists proves only that somebody typed the same thing twice.
 */
const TOOLS = Object.entries(DESIGNER_TOOL_LABELS) as [string, StringKey][];

function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	return settle();
}

describe('every tool the toolbar offers', () => {
	/**
	 * The registration guard, as BEHAVIOUR. A tool named in the label table with nothing
	 * registered under its id makes `setActiveTool` throw, so `setTool` never reaches the
	 * reactive mirror and the leaf reports the tool it had before — which is what this asserts.
	 */
	it.each(TOOLS)('activates %s when its button is pressed', async (id, label) => {
		const rig = await designerRig();

		await press(rig, label);

		expect(rig.activeToolId()).toBe(id);
		rig.unmount();
	});

	/**
	 * And the ACTIVE one is visibly distinguished, on both channels — the class the stylesheet
	 * keys its accent outline off, and `aria-pressed` for a reader who sees none of it.
	 *
	 * Both, because they are two independent bindings of one fact: the plan editor's toolbar
	 * shipped a build where `aria-pressed` was correct and the class lost the cascade, so a
	 * screen reader was told what the screen would not say.
	 */
	it.each(TOOLS)('marks %s as the pressed one once it is active', async (_id, label) => {
		const rig = await designerRig();

		await press(rig, label);
		const button = rig.toolbarButton(t('en', label));

		expect(button.classList.contains('rp-designer-tool-active')).toBe(true);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		rig.unmount();
	});

	/**
	 * E5: `PRECISE_TOOLS` (`EditorSurface.vue`) named only the three Plan Editor ids, so this
	 * canvas — the SAME surface, mounted a second time by `DesignerCanvas.vue` — drew the
	 * ordinary arrow while a click-to-place tool was active here. `trace-footprint` anchors its
	 * first vertex at the exact point pressed, the same promise `draw-polygon` makes in the
	 * Plan Editor, so it wants the same crosshair.
	 */
	it('gives trace-footprint the precise cursor, the crosshair the Plan Editor gives its own drawing tools', async () => {
		const rig = await designerRig();

		await press(rig, 'designer.toolbar.trace-footprint');

		expect(rig.canvasEl.classList.contains('rp-plan-canvas-precise')).toBe(true);
		rig.unmount();
	});

	/**
	 * The detail tools make the same promise: a traced vertex, a box's corner, a circle's centre, a
	 * line's vertex and a rounded rectangle's corner all land where pressed.
	 *
	 * `draw-line` and `draw-rounded-rect` were added at AD11's review: the second IS `DrawDetailTool`,
	 * the same class `draw-rect` is, and the first places vertices by click exactly as `trace-detail`
	 * does — so a designer drawing tool without a crosshair was the one thing that separated them.
	 */
	it.each(['draw-rect', 'draw-circle', 'trace-detail', 'draw-line', 'draw-rounded-rect'] as const)('gives %s the precise cursor too', async (id) => {
		const rig = await designerRig();

		await press(rig, DESIGNER_TOOL_LABELS[id]);

		expect(rig.canvasEl.classList.contains('rp-plan-canvas-precise')).toBe(true);
		rig.unmount();
	});

	/** ...and nothing else is. One active tool, one marked button. */
	it('marks exactly one mode at a time', async () => {
		const rig = await designerRig();

		await press(rig, 'designer.toolbar.set-anchor');
		const marked = rig.wrapper.findAll('.rp-designer-tool-active');

		expect(marked).toHaveLength(1);
		expect(marked[0]?.text()).toBe(t('en', 'designer.toolbar.set-anchor'));
		rig.unmount();
	});

	/**
	 * Select is back (symbols spec, Decision 10) — with its candidates (`hitDesign`) and its gesture
	 * (`DesignerSelectTool`), the condition `registerDesignerTools.ts` set for returning it. This list
	 * is updated deliberately with that change and stays EXACT.
	 *
	 * **The four drawing tools are NOT in it since AD18-R3**, and their absence here is half a
	 * claim: this case says the toolbar does not draw them, and `designerAddRail.test.ts` says the
	 * `Add` rail does, exactly once each. Deleting four names from a list is the shape of change
	 * that can silently mean "these buttons are gone", which is why the other half is a case and
	 * not this sentence.
	 */
	it('offers Pan, Select, every non-drawing design tool, Undo and Redo, in that order', async () => {
		const rig = await designerRig();
		const labels = rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.text());
		expect(labels).toEqual([
			t('en', 'designer.toolbar.pan'),
			t('en', 'designer.toolbar.select'),
			t('en', 'designer.toolbar.trace-footprint'),
			t('en', 'designer.toolbar.trace-clearance'),
			t('en', 'designer.toolbar.trace-detail'),
			t('en', 'designer.toolbar.set-anchor'),
			t('en', 'designer.toolbar.set-facing'),
			t('en', 'designer.toolbar.calibrate'),
			t('en', 'designer.toolbar.undo'),
			t('en', 'designer.toolbar.redo'),
		]);
		rig.unmount();
	});
});

describe('camera mode', () => {
	/**
	 * **"No active tool" and never one more `EditorTool`.** The camera is ephemeral UI (SDD §15)
	 * and is never a command, so the Pan button clears the manager rather than activating
	 * anything — and it is the state a freshly opened designer rests in, which is what the
	 * second assertion pins.
	 */
	it('is what the designer opens in, with no tool active', async () => {
		const rig = await designerRig();

		expect(rig.activeToolId()).toBeNull();
		expect(rig.toolbarButton(t('en', 'designer.toolbar.pan')).getAttribute('aria-pressed')).toBe('true');
		rig.unmount();
	});

	it('is what the pan button returns to from a tool', async () => {
		const rig = await designerRig();

		await press(rig, 'designer.toolbar.trace-footprint');
		expect(rig.activeToolId()).toBe('trace-footprint');

		await press(rig, 'designer.toolbar.pan');

		expect(rig.activeToolId()).toBeNull();
		rig.unmount();
	});
});

describe('the toolbar itself', () => {
	/**
	 * A `role="toolbar"` with a name of its OWN — "Asset tools", not the Plan Editor's "Editor
	 * tools". Two surfaces whose toolbars announced themselves identically would be
	 * indistinguishable to a screen reader with both leaves open, which is a thing this plugin
	 * permits.
	 */
	it('is a named toolbar landmark of its own', async () => {
		const rig = await designerRig();
		const toolbar = rig.wrapper.find('.rp-designer-tools');

		expect(toolbar.attributes('role')).toBe('toolbar');
		expect(toolbar.attributes('aria-label')).toBe(t('en', 'designer.toolbar'));
		rig.unmount();
	});

	/**
	 * Undo and Redo are DISABLED until there is something to reverse, and the pair is asserted
	 * together: a build that never enabled either passes the first half, and one that enabled
	 * both from mount passes the second.
	 */
	it('offers undo and redo, disabled until a gesture has been made', async () => {
		const rig = await designerRig();
		const undo = rig.toolbarButton(t('en', 'designer.toolbar.undo'));

		expect(undo.disabled).toBe(true);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.redo')).disabled).toBe(true);

		// A traced FOOTPRINT rather than an anchor, because the rig's asset starts with no
		// shape at all and `SetAssetAnchorCommand` refuses an asset that has none — an anchor
		// on nothing is a point on nothing. The footprint is the gesture that gives a fresh
		// asset its first shape, which is what makes it the one a fresh leaf can undo.
		await press(rig, 'designer.toolbar.trace-footprint');
		tracePolygon(rig, [
			{ x: 0, y: 0 },
			{ x: 1000, y: 0 },
			{ x: 1000, y: 1000 },
		]);
		await settle();

		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(false);
		rig.unmount();
	});
});

/**
 * The Shift constraint is advertised in the STATUS region while a constraining tool is active,
 * and nowhere else. A modifier no control shows and no menu lists is one nobody finds; most of
 * this surface's tools take it, so leaving it unmentioned would leave it unmentioned on this
 * surface entirely.
 */
describe('the shift hint', () => {
	it('appears for a tool that constrains and not for one that does not', async () => {
		const rig = await designerRig();
		const hint = () => rig.wrapper.find('.rp-designer-hint');

		await press(rig, 'designer.toolbar.trace-footprint');
		expect(hint().exists()).toBe(true);
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		await press(rig, 'designer.toolbar.set-anchor');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});

	/**
	 * The two tools AD11 added answer this question DIFFERENTLY, which is why both are asserted here
	 * rather than only the one that was missing. `DrawLineTool.landingPoint` calls
	 * `constrainDrawingPoint` with `event.modifiers.shift`, so the line tool honours the constraint
	 * and owes the hint; `draw-rounded-rect` IS `DrawDetailTool`, which constrains nothing — the same
	 * answer `draw-rect` already gets, for the same reason `draw-room` is off that list.
	 */
	it('appears for the line tool, which honours Shift, and not for the rounded rectangle, which does not', async () => {
		const rig = await designerRig();
		const hint = () => rig.wrapper.find('.rp-designer-hint');

		await press(rig, 'designer.toolbar.draw-line');
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		await press(rig, 'designer.toolbar.draw-rounded-rect');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});

	it('is absent in camera mode, where no key would do anything', async () => {
		const rig = await designerRig();

		expect(rig.wrapper.find('.rp-designer-hint').exists()).toBe(false);
		rig.unmount();
	});

	/**
	 * Under Select the hint says what Shift does to the gesture the selection offers (spec Amendment 2),
	 * decided in `AssetDesignerRoot` and never by adding `select` to the shared constrain list — `select` is
	 * the plan editor's id too, and its status bar pins no constrain hint under Select. Transform on an
	 * outline: Shift keeps proportions and snaps the rotation. The facing: Shift constrains its angle.
	 * Edit points, Bend edges, the anchor and no selection: Shift does nothing, so nothing is said.
	 */
	it('says what Shift does under Select, for the part and the mode selected', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		const hint = () => rig.wrapper.find('.rp-designer-hint');
		const store = useAssetDesignStore(rig.pinia);

		await press(rig, 'designer.toolbar.select');
		expect(hint().exists()).toBe(false);

		store.select({ kind: 'detail', id: 'detail-2' });
		await settle();
		expect(hint().text()).toBe(t('en', 'designer.hint.shift-transform'));

		store.setMode('points');
		await settle();
		expect(hint().exists()).toBe(false);

		store.setMode('bend');
		await settle();
		expect(hint().exists()).toBe(false);

		store.select({ kind: 'facing' });
		await settle();
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		store.select({ kind: 'anchor' });
		await settle();
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});

	/**
	 * An OPEN graphic is an outline selection under Transform, so it took the Shift hint the moment
	 * the open-line tool made one selectable — and that sentence promises Shift keeps proportions and
	 * snaps the rotation. A path has neither handle to act on: `selectionHandles` answers `[]` for
	 * one, which is the same fact that keeps Edit points and Bend edges out of the mode group. One
	 * predicate answers both, so the two surfaces cannot come to disagree about it.
	 */
	it('says nothing about Shift for an open graphic, which has no handle for it to act on', async () => {
		const rig = await designerRig({ shape: shapeWithOpenGraphic() });
		const store = useAssetDesignStore(rig.pinia);

		await press(rig, 'designer.toolbar.select');
		store.select({ kind: 'detail', id: 'detail-1' });
		await settle();
		// The closed sibling on the same shape still gets it, so this is about the KIND rather than
		// about the shape or the tool.
		expect(rig.wrapper.find('.rp-designer-hint').text()).toBe(t('en', 'designer.hint.shift-transform'));

		store.select({ kind: 'detail', id: 'detail-3' });
		await settle();
		expect(rig.wrapper.find('.rp-designer-hint').exists()).toBe(false);
	});

	it('gives no Select hint under another tool, whatever is selected', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		const hint = () => rig.wrapper.find('.rp-designer-hint');
		useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-2' });

		await press(rig, 'designer.toolbar.set-anchor');
		expect(hint().exists()).toBe(false);
		await press(rig, 'designer.toolbar.trace-detail');
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));
		await press(rig, 'designer.toolbar.pan');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});
});

/**
 * A mode's gesture is invisible until tried: which handles a mode draws says nothing about what dragging
 * them does. Each mode button's tooltip names it — the `title` both designer toolbars already use — while
 * its text stays the accessible name the exact-list cases above read.
 */
describe('the selection mode buttons', () => {
	it('name the gesture each mode offers in a tooltip, and keep the mode as their accessible name', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		await press(rig, 'designer.toolbar.select');
		useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-2' });
		await settle();

		const modes = rig.wrapper.findAll('.rp-designer-selection-modes button').map((button) => [button.text(), button.attributes('title')]);
		expect(modes).toEqual([
			[t('en', 'designer.selection.mode.transform'), t('en', 'designer.selection.mode.transform.tip')],
			[t('en', 'designer.selection.mode.points'), t('en', 'designer.selection.mode.points.tip')],
			[t('en', 'designer.selection.mode.bend'), t('en', 'designer.selection.mode.bend.tip')],
		]);
		rig.unmount();
	});

	/**
	 * An OPEN graphic is offered only the mode it actually has (AD11 review, finding 1). `selectionHandles`
	 * opens with `outlineOf`, which answers `null` for a path, so Edit points drew no vertex handles and
	 * Bend edges drew no edge handles — two enabled buttons that produced nothing, on the card's very first
	 * gesture, since `completeDetail` returns to Select with the new line selected.
	 *
	 * **Dropped rather than disabled**, which is the shape AD10's review accepted for the Arrange panel and
	 * `DesignerArrangePanel`'s own docblock states: *"Which parts a control needs is what decides whether it
	 * is DRAWN, never a `:disabled`"*. Transform stays, because its gesture works — a body drag, and the
	 * inspector's centre, size and rotate fields — but it draws no box or rotate handle either, so its
	 * tooltip says the gesture it really offers instead of the one a closed part gets.
	 *
	 * **The closed assertion first is what makes this case able to fail.** A component rendering nothing at
	 * all satisfies the open half trivially; only the three-button expectation above it can tell "correctly
	 * narrowed" from "never drawn".
	 */
	it('offers an open graphic only Transform, and tells it what Transform can still do', async () => {
		const rig = await designerRig({ shape: shapeWithOpenGraphic() });
		const store = useAssetDesignStore(rig.pinia);
		const modes = () => rig.wrapper.findAll('.rp-designer-selection-modes button').map((button) => [button.text(), button.attributes('title')]);
		await press(rig, 'designer.toolbar.select');

		store.select({ kind: 'detail', id: 'detail-1' });
		await settle();
		expect(modes()).toEqual([
			[t('en', 'designer.selection.mode.transform'), t('en', 'designer.selection.mode.transform.tip')],
			[t('en', 'designer.selection.mode.points'), t('en', 'designer.selection.mode.points.tip')],
			[t('en', 'designer.selection.mode.bend'), t('en', 'designer.selection.mode.bend.tip')],
		]);

		store.select({ kind: 'detail', id: 'detail-3' });
		await settle();
		expect(modes()).toEqual([[t('en', 'designer.selection.mode.transform'), t('en', 'designer.selection.mode.transform.open')]]);
		rig.unmount();
	});

	/**
	 * The footprint and the clearance are `CurvedPolygon`s by TYPE, so neither can ever be the open case —
	 * asserted rather than reasoned, because the narrowing reads the selected part out of `shape.details`
	 * and a version of it that answered on "not found" would take these two with it.
	 */
	it('keeps all three for the footprint and the clearance, which cannot be open', async () => {
		const rig = await designerRig({ shape: shapeWithOpenGraphic() });
		const store = useAssetDesignStore(rig.pinia);
		const labels = () => rig.wrapper.findAll('.rp-designer-selection-modes button').map((button) => button.text());
		await press(rig, 'designer.toolbar.select');

		for (const part of [{ kind: 'footprint' }, { kind: 'clearance' }] as const) {
			store.select(part);
			await settle();
			expect(labels()).toEqual([t('en', 'designer.selection.mode.transform'), t('en', 'designer.selection.mode.points'), t('en', 'designer.selection.mode.bend')]);
		}
		rig.unmount();
	});
});

/**
 * Undo and Redo sit in ONE trailing group, which `designer.css` ends on whichever row it wraps to (critique
 * finding 5), and no toolbar button repeats its label as a tooltip (finding 24): a button's text is its
 * name. The mode buttons keep their describing tooltips, pinned in `the selection mode buttons` above.
 *
 * The View menu (snapping spec §5) mounts AFTER that group now, so it — not the history group — is the
 * toolbar's own last child; the history group's own position, right before it, is what is pinned here.
 */
describe('the toolbar’s own markup', () => {
	it('groups Undo and Redo last before the View menu, and gives no button a tooltip repeating its label', async () => {
		const rig = await designerRig();
		const history = rig.wrapper.find('.rp-designer-tools > .rp-designer-history');

		expect(history.findAll('button').map((button) => button.text())).toEqual([t('en', 'designer.toolbar.undo'), t('en', 'designer.toolbar.redo')]);
		expect(rig.wrapper.find('.rp-designer-tools').element.lastElementChild).toBe(rig.wrapper.find('.rp-designer-tools > .rp-view-menu').element);
		expect(history.element.nextElementSibling).toBe(rig.wrapper.find('.rp-designer-tools > .rp-view-menu').element);
		expect(rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.attributes('title')).filter((title) => title !== undefined)).toEqual([]);
		rig.unmount();
	});
});
