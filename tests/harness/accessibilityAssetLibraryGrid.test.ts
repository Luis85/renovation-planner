/**
 * @vitest-environment jsdom
 *
 * AD18-R18's Grid view and its category sidebar (Task 10), scanned for the first time — a review
 * routed this to Task 11 because neither existed when `accessibilityAssetLibrary.test.ts` was
 * written: every case there mounts through the default List, where `.rp-al-categories` renders
 * `v-show="open"` with `open` false (List with no filter never wants the sidebar —
 * `useCategorySidebar.ts`'s `wanted`), so nothing in that file has ever put the sidebar's own
 * markup — the toggle buttons, the funnel's `aria-expanded`/`aria-controls` pair — in front of axe.
 *
 * Read that file's header first: its SCOPE paragraph is the contract this file runs under too,
 * restated here only where the Grid view differs. `runOptions` is shared through `./axeOptions`
 * for the same reason that file gives — two copies of the rule list is two lists that can
 * disagree about what this suite honestly grades.
 *
 * A SIBLING file rather than a fourth `describe` appended to `accessibilityAssetLibrary.test.ts`,
 * which CLAUDE.md's brief for this task names as already near its 450-line cap.
 *
 * Mounted through `mountAssetLibraryHarness`'s new `&layout=grid` knob (Task 11) — the same
 * function `npm run harness` and `scripts/harness-shot.mjs` both drive — rather than through
 * `AssetLibraryView.setState` directly, so a semantics scan and a screenshot agree on what
 * "the mounted Grid" means, exactly as `accessibilityAssetLibrary.test.ts`'s own inspector case
 * already argues for its mount.
 */
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountAssetLibraryHarness } from './assetLibrary';
import { runOptions } from './axeOptions';

describe('axe against the asset library’s Grid view', () => {
	/**
	 * The resting Grid, with its sidebar shown: the tiles (`AssetGrid.vue`'s `<li>`/`<button>`
	 * pairs, each an image-less tile named by its own text), the funnel
	 * (`aria-expanded`/`aria-controls`, AssetLibraryBrowseControls.vue's own header names why both
	 * matter) and the category nav's toggle buttons (`aria-pressed`, one at a time). Both
	 * load-bearing assertions below are what keep this scan from passing on an empty pane the way
	 * `accessibility.test.ts`'s own header warns against: a mount that regressed to List, or one
	 * whose sidebar stopped drawing, would still pass an `axe.run` finding nothing wrong with a
	 * smaller tree.
	 */
	it('reports no semantic violations on the Grid, with its category sidebar shown', async () => {
		const { view } = mountAssetLibraryHarness(document.body, null, false, 'grid');
		await flushPromises();

		expect(view.contentEl.querySelector('.rp-al-tile')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-al-categories')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);

		await view.onClose();
		view.containerEl.remove();
	});

	/**
	 * A tile SELECTED, so `AssetGrid.vue`'s `.rp-al-tile--on` state and the Inspector beside it —
	 * §3.5's four sections, the same panel `accessibility.test.ts`'s own inspector case scans over
	 * the List — are both in the tree axe grades at once. Nothing here needs its own inspector
	 * case: the panel's markup does not depend on which layout put the row on screen, only on
	 * `selectedId`, which that other file's case already exercises against the List.
	 */
	it('reports no semantic violations on the Grid with a tile selected', async () => {
		const { view } = mountAssetLibraryHarness(document.body, 'base-cabinet-600', false, 'grid');
		await flushPromises();

		expect(view.contentEl.querySelector('.rp-al-tile--on')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-al-inspector')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);

		expect(results.violations).toEqual([]);

		await view.onClose();
		view.containerEl.remove();
	});
});
