/**
 * @vitest-environment jsdom
 *
 * AD18 item 4's tab control, and ruling AD18-R2's three refusals.
 *
 * The measured problem: with one part selected the Inspector was 887 px of content in a 625 px
 * column — 42 % below the fold before any clearance or review block appeared, in a 224 px rail.
 * jsdom lays nothing out, so no case here can measure that; what these cases CAN hold is the split
 * itself, which is the part a later edit would undo by accident.
 *
 * **Three things the ruling says must not go wrong, and each has a case below rather than a
 * comment:**
 *
 * - the Clearance block and the clearance-review notice stay in the SAME panel (`keeps the
 *   clearance review in the same panel as the clearance block`);
 * - the tab control JOINS the Parts panel's roving-tabindex model rather than competing with it
 *   (the `roving tabindex` block), and does not disturb the `<aside>`'s own `tabindex="-1"`;
 * - `AssetDesignerRoot`'s `design !== null` gate is untouched, so `.rp-designer-inspector` is still
 *   an EMPTY region for a loading or failed leaf (`leaves the inspector region empty…`).
 *
 * `assetDesignerRoot.test.ts` owns the region list itself; this file owns what is inside the one
 * region when there IS a design.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { unavailableAssetDesignerQueries } from '../../../src/presentation/read-models/assetDesignerQueries';
import { ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';

installCanvas();
installResizeObserver();

/**
 * A design whose reference sheet AND whose clearance review both have something to say, so the two
 * panels are each non-empty and a case about WHICH panel a block landed in cannot pass vacuously.
 * `clearanceNeedsReview` is `DesignerClearanceReview`'s whole predicate; a `calibration` is one of
 * the three things that make `DesignerReferenceStatus` relevant.
 */
function design(): AssetDesignDto {
	const base = assetDesign({ calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 800, y: 0 }, knownDistance: 800, pixelsPerWorldUnit: 1 } });
	if (base.shape === null) throw new Error('the fixture carries a shape');
	return { ...base, shape: { ...base.shape, clearance: base.shape.footprint, clearanceNeedsReview: true } };
}

function mountInspector() {
	return mount(DesignerInspector, {
		props: {
			design: design(),
			setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
			editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
			startFromPreset: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
			removeBackground: async (): Promise<void> => {},
			logger: recorder,
			selection: null,
			selected: [],
			lockedGraphics: new Set<string>(),
			editShape: vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(ok('no-write')),
			select: vi.fn<(next: DesignerSelection | null) => void>(),
		},
	});
}

/**
 * The two tab buttons, in the order the strip draws them, and the panel a tab controls — found the
 * way a screen reader would, through `aria-controls` rather than through a selector this file
 * invents.
 *
 * Both take the mounted ROOT rather than the wrapper: `VueWrapper`'s `element` is a bare `Node`
 * once the generic is erased by a return annotation, and `Node` has no `querySelector`.
 */
const tabs = (root: HTMLElement): HTMLButtonElement[] =>
	Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

const panelOf = (root: HTMLElement, tab: HTMLButtonElement): HTMLElement => {
	const id = tab.getAttribute('aria-controls');
	const panel = id === null ? null : root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
	if (panel === null) throw new Error(`no panel for the ${tab.dataset.rpTab ?? '?'} tab`);
	return panel;
};

describe('the inspector’s tabs', () => {
	/**
	 * TWO, and the labels. Board 01 draws three (`Object | Style | Reference`) and board 02 draws a
	 * different two (`Object | Properties`); AD18-R2 took neither, and the absent `Style` is the
	 * half of that ruling a later author is most likely to "restore".
	 */
	it('draws exactly two tabs, Object and Reference', () => {
		const wrapper = mountInspector();

		expect(tabs(wrapper.element).map((tab) => tab.textContent?.trim())).toEqual([
			t('en', 'designer.inspector.tab.object'),
			t('en', 'designer.inspector.tab.reference'),
		]);
	});

	it('opens on Object, with the reference panel hidden', () => {
		const wrapper = mountInspector();
		const [object, reference] = tabs(wrapper.element);

		expect(object.getAttribute('aria-selected')).toBe('true');
		expect(panelOf(wrapper.element, object).style.display).not.toBe('none');
		expect(panelOf(wrapper.element, reference).style.display).toBe('none');
	});

	it('shows the reference panel and hides the object one when Reference is pressed', async () => {
		const wrapper = mountInspector();
		const [object, reference] = tabs(wrapper.element);

		reference.click();
		await flushPromises();

		expect(reference.getAttribute('aria-selected')).toBe('true');
		expect(object.getAttribute('aria-selected')).toBe('false');
		expect(panelOf(wrapper.element, reference).style.display).not.toBe('none');
		expect(panelOf(wrapper.element, object).style.display).toBe('none');
	});

	/** Each panel names its own tab back, so the association reads in both directions. */
	it('labels each panel by the tab that controls it', () => {
		const wrapper = mountInspector();

		for (const tab of tabs(wrapper.element)) expect(panelOf(wrapper.element, tab).getAttribute('aria-labelledby')).toBe(tab.id);
	});
});

/**
 * **Where each block landed.** The ruling's split is "the object, its placement and its clearance
 * are one subject; the reference sheet and its calibration are another" — so the cases below name
 * the blocks rather than the tab, which is what makes them fail if a later edit moves one.
 */
describe('the split between the two panels', () => {
	/**
	 * **The sharpest of AD18-R2's refusals.** The clearance-review notice is a `role="status"` live
	 * region, and step 29 of the manual case *Calibrate a sheet and reserve space* records a real
	 * user reading it as belonging to the Clearance block above it. A tab between the two would
	 * destroy the one judgement answer this package has.
	 *
	 * Both blocks carry `.rp-designer-clearance`, so this asserts that every element with that class
	 * shares one panel — a check at the category rather than at the two components somebody
	 * remembered.
	 */
	it('keeps the clearance review in the same panel as the clearance block', () => {
		// Annotated rather than read straight off the wrapper: `VueWrapper.element` widens to a type
		// whose `querySelectorAll` takes no type argument, which `vue-tsc` reports and `vitest` does
		// not — the compiler that matters runs in `npm run build`.
		const root: HTMLElement = mountInspector().element;
		const clearance = Array.from(root.querySelectorAll<HTMLElement>('.rp-designer-clearance'));
		const objectPanel = panelOf(root, tabs(root)[0]);

		expect(clearance.length).toBeGreaterThan(1);
		expect(clearance.every((block) => objectPanel.contains(block))).toBe(true);
	});

	it('puts the reference sheet in the Reference panel and the placement block in the Object one', () => {
		const wrapper = mountInspector();
		const [object, reference] = tabs(wrapper.element);

		expect(panelOf(wrapper.element, reference).querySelector('.rp-designer-reference')).not.toBeNull();
		expect(panelOf(wrapper.element, object).querySelector('.rp-designer-reference')).toBeNull();
		expect(panelOf(wrapper.element, object).querySelector('.rp-designer-placement')).not.toBeNull();
	});

	/**
	 * The asset's own block is the Object tab's. Named for the two controls it actually reaches —
	 * the usage scope is NOT one of them, because a bare mount leaves `DesignerUsageScope` with no
	 * context and it draws nothing; `designerUsageScope.test.ts` is where that block is asserted.
	 */
	it('puts the dimensions control and the height field in the Object panel', () => {
		const wrapper = mountInspector();
		const objectPanel = panelOf(wrapper.element, tabs(wrapper.element)[0]);

		expect(objectPanel.querySelector('.rp-designer-edit-dimensions')).not.toBeNull();
		expect(objectPanel.querySelector('[name="height"]')).not.toBeNull();
	});
});

/**
 * **The keyboard model this strip JOINS rather than competes with**, counted rather than
 * remembered. `grep -rln rovingIndex src/presentation/` prints the helper itself,
 * `DesignerPartsPanel`, `AssetPresetForm` and — since this card — `DesignerInspector`: the four
 * places that DECIDE where a tab stop lands. `grep -rln ':tabindex=' src/presentation/designer/`
 * prints `DesignerPartRow`, `DesignerPartGroupRow`, `AssetPresetGallery` and `DesignerInspector`:
 * the four that BIND one. The two lists differ because a panel usually owns the decision and a row
 * renders it; this strip is small enough to be both, and it is the same function either way.
 */
describe('roving tabindex', () => {
	it('gives the strip one tab stop, on the selected tab', async () => {
		const wrapper = mountInspector();
		const [object, reference] = tabs(wrapper.element);

		expect([object.tabIndex, reference.tabIndex]).toEqual([0, -1]);

		reference.click();
		await flushPromises();

		expect([object.tabIndex, reference.tabIndex]).toEqual([-1, 0]);
	});

	/**
	 * ArrowRight both moves the tab stop and ACTIVATES — the pattern's automatic activation, which
	 * is its own recommendation wherever revealing a panel is cheap, and both panels are already
	 * rendered here.
	 */
	it('moves selection and focus with the arrows, and clamps at the ends', async () => {
		const wrapper = mountInspector();
		document.body.appendChild(wrapper.element);
		const [object, reference] = tabs(wrapper.element);
		object.focus();

		await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(reference);
		expect(reference.getAttribute('aria-selected')).toBe('true');

		// The ends CLAMP rather than wrap, which is `rovingIndex`'s own rule — a second ArrowRight
		// from the last tab must not land back on the first.
		await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(reference);

		await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'Home' });
		expect(document.activeElement).toBe(object);
		expect(object.getAttribute('aria-selected')).toBe('true');
	});

	/** A key the strip does not take is left alone, so typing in the panel below still reaches it. */
	it('takes no key it does not own', async () => {
		const wrapper = mountInspector();
		const [object] = tabs(wrapper.element);

		await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'a' });

		expect(object.getAttribute('aria-selected')).toBe('true');
	});

	/**
	 * The `<aside>` keeps `tabindex="-1"` — a focus TARGET for `DesignerSelectionInspector`'s delete
	 * hand-off, never a Tab stop. The strip does not take that role away from it.
	 */
	it('leaves the inspector’s own focus target alone', () => {
		expect(mountInspector().find('aside').attributes('tabindex')).toBe('-1');
	});

	/**
	 * **Each PANEL is a Tab stop, which the APG asks for exactly when a panel may hold no focusable
	 * content — and the Reference one does not, for an asset typed from dimensions with no sheet.**
	 * Without it a keyboard user selects Reference and the next Tab leaves the Inspector entirely,
	 * with nothing focused and nothing announced in between. axe does not grade this rule, so this
	 * case is the only thing holding it.
	 */
	it('makes every panel focusable, because one of them can be empty', () => {
		const root: HTMLElement = mountInspector().element;

		const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
		expect(panels).toHaveLength(2);
		expect(panels.map((panel) => panel.tabIndex)).toEqual([0, 0]);
	});
});

/**
 * **The gate AD18-R2 says a tab control must not move.** `AssetDesignerRoot` draws the Inspector
 * only for `design !== null`, which is what keeps `.rp-designer-inspector` an empty REGION for a
 * loading leaf and for a refused read alike. A strip drawn outside that gate would put two tabs over
 * a panel with nothing in it.
 */
describe('a leaf with no design', () => {
	it('leaves the inspector region empty, with no tab strip in it', async () => {
		const context: AssetDesignerContext = {
			assetId: assetDesign().assetId,
			queries: unavailableAssetDesignerQueries(),
			commands: unavailableAssetDesignerCommands(),
			logger: recorder,
			picker: null,
			vault: emptyBackgroundVault(),
			onDesignChanged: () => () => undefined,
			onThemeChange: () => () => undefined,
			onVaultFileChanged: () => () => undefined,
			indexScanCompleted: () => true,
			closeLeaf: () => undefined,
		};
		const wrapper = mount(AssetDesignerRoot, {
			global: { plugins: [createPinia(), VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		expect(wrapper.element.querySelector('.rp-designer-inspector')).not.toBeNull();
		expect(wrapper.element.querySelector('.rp-designer-inspector [role="tab"]')).toBeNull();
	});
});
