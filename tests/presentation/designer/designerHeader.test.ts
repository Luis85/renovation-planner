/**
 * @vitest-environment jsdom
 *
 * AD18 item 2's header — AD06 implementation item 1, re-opened because AD06 was marked integrated
 * without it. The four things it carries: which asset this leaf is editing, the way back to the
 * catalogue, whether the work is saved, and the way into a plan.
 *
 * **The cases about the NAME and the library door were moved here from
 * `designerInspector.test.ts`, not copied.** Ruling AD18-R1 moved both controls out of that panel,
 * and a case left behind asserting the Inspector still draws them would have been the second answer
 * to one question that the ruling exists to prevent.
 *
 * `designerUsePlan.test.ts` owns the Use-in-plan control's own predicate and its wiring through the
 * real root; nothing here re-states either. What this file adds about it is only that the header is
 * where it now lives.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerHeader from '../../../src/presentation/designer/DesignerHeader.vue';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

/** The root mounts a real Konva stage and an `EditorSurface`; jsdom supplies neither. */
installCanvas();
installResizeObserver();

/**
 * `SaveStateIndicator` reads the leaf's own Pinia store, so every mount needs one — which is also
 * what makes the save-state case below meaningful rather than a check on a stub.
 */
function mountHeader(props: Partial<InstanceType<typeof DesignerHeader>['$props']> = {}) {
	return mount(DesignerHeader, {
		props: { design: assetDesign(), ...props },
		global: { plugins: [createPinia()] },
	});
}

function mountRoot(overrides: Partial<AssetDesignerContext> = {}) {
	const context: AssetDesignerContext = {
		assetId: assetDesign().assetId,
		queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign())), listPlansUsingAsset: unwiredPlanUsage },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
		...overrides,
	};
	return mount(AssetDesignerRoot, {
		global: { plugins: [createPinia(), VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
	});
}

describe('the designer header', () => {
	it('names the asset it is designing', () => {
		expect(mountHeader().find('.rp-designer-asset-name').text()).toBe('Base cabinet 600');
	});

	/**
	 * A heading rather than the paragraph the Inspector's copy was, at `<h2>` — the level every
	 * other panel heading on this surface starts at, and the level `ProjectDetail.vue` names its own
	 * subject at (`.rp-project-detail__name` is an `h2`). No element anywhere in `src/` opens an
	 * `h1`; `DesignerHeader.vue`'s own comment carries what that grep prints and why.
	 *
	 * **This case checks the TAG and nothing else**, because it mounts the header alone: whether it
	 * is the FIRST heading is a fact about the whole leaf, and `is the first heading in the mounted
	 * designer` below is where that is asked.
	 */
	it('draws the name as an h2', () => {
		expect(mountHeader().find('.rp-designer-asset-name').element.tagName).toBe('H2');
	});

	it('offers the library door, and calls it', async () => {
		const openLibrary = vi.fn<() => void>();
		const wrapper = mountHeader({ openLibrary });

		await wrapper.find('.rp-designer-open-library').trigger('click');

		expect(openLibrary).toHaveBeenCalledTimes(1);
	});

	/** Slice 14's Amendment 1: no door bound, no control — never a live one that does nothing. */
	it('draws no library control where no door is bound', () => {
		expect(mountHeader().find('.rp-designer-open-library').exists()).toBe(false);
	});

	/**
	 * **TWO of the four are outside the design gate, not one**, which is the whole reason this
	 * component takes a nullable design rather than being drawn behind a `v-if` the way the Parts
	 * and Inspector regions are. A leaf whose read is in flight or refused has no name to state and
	 * no asset to take into a plan, so those two are inside it. The save state is outside because it
	 * is true of every state, and drew from the status region before AD18 moved it up here; the
	 * library door is outside because it is gated on the DOOR being bound instead, which is a fact
	 * about the composition rather than about the read — and a user whose read refused is exactly
	 * the user who wants the way back.
	 */
	it('states the save state and the library door for a leaf with no design', () => {
		const wrapper = mountHeader({ design: null, openLibrary: () => undefined });

		expect(wrapper.find('.rp-save-state-label').exists()).toBe(true);
		// The way BACK is gated on the door being bound, never on the read — a user whose read
		// refused is exactly the user who wants it.
		expect(wrapper.find('.rp-designer-open-library').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-asset-name').exists()).toBe(false);
		expect(wrapper.find('[data-rp-action="use-in-plan"]').exists()).toBe(false);
	});

	/**
	 * **A `<header>` is a `banner` landmark and HTML-AAM does not name one from a heading inside
	 * it** — and for a leaf whose read is in flight or refused there is no heading in it at all. So
	 * the label is explicit, as `EditorContextBar`'s is. No axe rule grades this, which is why the
	 * case exists.
	 */
	it('names its own landmark rather than leaning on the heading inside it', () => {
		expect(mountHeader().find('header').attributes('aria-label')).toBe(t('en', 'designer.header'));
	});

	it('labels the library door from the locale rather than from a literal', () => {
		expect(mountHeader({ openLibrary: () => undefined }).find('.rp-designer-open-library').text())
			.toBe(t('en', 'designer.header.back-to-library'));
	});

	/**
	 * AD18-R16 Task 2: board 02's `← Back to library`. `HostIcon` carries `aria-hidden` itself, so
	 * this only has to prove the glyph is the one the board draws.
	 */
	it('prefixes the library door with the back arrow', async () => {
		const wrapper = mountHeader({ openLibrary: () => undefined });
		await flushPromises();

		expect(wrapper.get('.rp-designer-open-library .rp-host-icon').attributes('data-icon')).toBe('arrow-left');
	});

	/**
	 * The label's own text is the accessible name — no `aria-label` doubling it — because the
	 * narrow-width state (`styles/designer-header.css`) clips that text rather than hiding it, and a
	 * clipped node only keeps naming the button if it is still what the button is named FROM.
	 */
	it('names the library door from its own label text, not a duplicate aria-label', () => {
		const button = mountHeader({ openLibrary: () => undefined }).get('.rp-designer-open-library');

		expect(button.attributes('aria-label')).toBeUndefined();
		expect(button.get('.rp-designer-open-library-label').text()).toBe(t('en', 'designer.header.back-to-library'));
	});
});

/**
 * **AD18-R1's actual guarantee, asked at the forbidden thing rather than of the two components in
 * turn.** The ruling is not "the header draws the name" — it is that ONE place does. A case that
 * only asserted the header drew one would stay green on the day somebody restores the Inspector's
 * copy, which is precisely the failure the ruling was taken to prevent.
 */
describe('one answer to “which asset is this”', () => {
	/**
	 * **Counted in rendered TEXT, not in elements carrying a class**, which is the difference
	 * between a category check and a check on the spelling this card happened to use: a restored
	 * copy under a different class, or a bare `{{ design.name }}` with no class at all, is caught
	 * here and would not have been by `querySelectorAll('.rp-designer-asset-name')`.
	 *
	 * Nothing else in this tree renders the asset's own name — the Parts panel draws part labels and
	 * the usage scope draws plan names, and this context's `unwiredPlanUsage` refuses anyway — so
	 * one occurrence is the whole of what should be there.
	 */
	it('renders the asset’s name exactly once in the whole mounted designer, in the header region', async () => {
		const wrapper = mountRoot();
		await flushPromises();
		const root: HTMLElement = wrapper.element;

		const occurrences = (root.textContent ?? '').split(assetDesign().name).length - 1;
		expect(occurrences).toBe(1);
		expect(root.querySelector('.rp-designer-header .rp-designer-asset-name')).not.toBeNull();
	});

	/**
	 * **The asset is the FIRST heading, and the outline starts at `<h2>`.** Asked of the whole
	 * mounted leaf rather than of the header alone, because "first" is not a property an isolated
	 * mount has. The `h1` absence is the half a reader would not predict and is the house
	 * convention rather than this surface's accident — a plugin leaf beside Obsidian's own markdown
	 * headings does not claim the document's top level. Note the scope this case actually has: it
	 * asserts no `h1` inside the MOUNTED DESIGNER, which is narrower than "anywhere in `src/`".
	 */
	it('is the first heading in the mounted designer, and the tree carries no h1', async () => {
		const wrapper = mountRoot();
		await flushPromises();
		const root: HTMLElement = wrapper.element;

		const headings = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
		expect(headings[0]?.classList.contains('rp-designer-asset-name')).toBe(true);
		expect(headings[0]?.tagName).toBe('H2');
		expect(root.querySelector('h1')).toBeNull();
	});

	/**
	 * And the same for the save state, which moved the same way and for the same reason: two
	 * indicators reading one store are two answers to "is my work safe".
	 */
	it('states the save state exactly once, in the header region', async () => {
		const wrapper = mountRoot();
		await flushPromises();

		expect(wrapper.element.querySelectorAll('.rp-save-state-label')).toHaveLength(1);
		expect(wrapper.element.querySelector('.rp-designer-header .rp-save-state-label')).not.toBeNull();
	});
});
