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
 * So every case here drives ACTIVATION through the MOUNTED designer. Asserting that five
 * buttons render is satisfied by five buttons wired to nothing, exactly as a passing
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

	/** ...and nothing else is. One active tool, one marked button. */
	it('marks exactly one mode at a time', async () => {
		const rig = await designerRig();

		await press(rig, 'designer.toolbar.set-anchor');
		const marked = rig.wrapper.findAll('.rp-designer-tool-active');

		expect(marked).toHaveLength(1);
		expect(marked[0]?.text()).toBe(t('en', 'designer.toolbar.set-anchor'));
		rig.unmount();
	});
});

describe('camera mode', () => {
	/**
	 * **"No active tool" and never a fifth `EditorTool`.** The camera is ephemeral UI (SDD §15)
	 * and is never a command, so the Pan button clears the manager rather than activating
	 * anything — and it is the state a freshly opened designer rests in, which is what the
	 * second assertion pins.
	 */
	it('is what the designer opens in, with no tool active', async () => {
		const rig = await designerRig();

		expect(rig.activeToolId()).toBeNull();
		expect(rig.toolbarButton(t('en', 'editor.toolbar.pan')).getAttribute('aria-pressed')).toBe('true');
		rig.unmount();
	});

	it('is what the pan button returns to from a tool', async () => {
		const rig = await designerRig();

		await press(rig, 'designer.toolbar.trace-footprint');
		expect(rig.activeToolId()).toBe('trace-footprint');

		await press(rig, 'editor.toolbar.pan');

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
		const undo = rig.toolbarButton(t('en', 'editor.toolbar.undo'));

		expect(undo.disabled).toBe(true);
		expect(rig.toolbarButton(t('en', 'editor.toolbar.redo')).disabled).toBe(true);

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

		expect(rig.toolbarButton(t('en', 'editor.toolbar.undo')).disabled).toBe(false);
		rig.unmount();
	});
});

/**
 * The Shift constraint is advertised in the STATUS region while a constraining tool is active,
 * and nowhere else. A modifier no control shows and no menu lists is one nobody finds; three of
 * this surface's five tools take it, so leaving it unmentioned would leave it unmentioned on
 * this surface entirely.
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

	it('is absent in camera mode, where no key would do anything', async () => {
		const rig = await designerRig();

		expect(rig.wrapper.find('.rp-designer-hint').exists()).toBe(false);
		rig.unmount();
	});
});
