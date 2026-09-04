/**
 * @vitest-environment jsdom
 *
 * The ASSET LIBRARY half of the browser harness page — `npm run harness` with
 * `?view=asset-library` (Task 17), and the three `?view=` branches' fourth sibling.
 *
 * **In its own file because `harness.test.ts` is at its `max-lines` cap**, and CLAUDE.md's rule
 * for a budget already spent is an extraction rather than a second reformatting. Measured, not
 * predicted: with these two cases appended there, `npm run lint` reported *File has too many
 * lines (472). Maximum allowed is 450* — that cap counts neither blanks nor comments, so the
 * figure is not this file's `wc -l` and there is no arithmetic here to go stale. Moving the
 * block out is what clears it.
 *
 * The seam is a real one rather than a convenient one — the bulk of `harness.test.ts` is the
 * stylesheet-CLOSURE machinery (a source scan over three roots, glob-branch resolution, a
 * planted-probe tripwire), and *does this surface mount inside the leaf frame* is a different
 * question that happens to live beside it. `assetLibraryFocus.test.ts` already sits in this
 * directory under the same reasoning.
 *
 * Same job as `harness.test.ts`'s own three `the browser harness, <surface>` blocks and the same
 * limit: this asserts the FRAME and the plumbing, never appearance, because a browser is where
 * this surface is actually looked at — `scripts/harness-shot.mjs`'s seven library captures, which
 * are what the two cases below exist to keep pointed at something.
 *
 * No canvas and no resize observer: unlike the Plan Editor and the designer, nothing here
 * constructs a Konva stage.
 */
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountAssetLibraryHarness } from './assetLibrary';

describe('the browser harness, asset library', () => {
	it('mounts the real asset library inside the same leaf frame', async () => {
		const { leafEl, view } = mountAssetLibraryHarness(document.body, null);
		// The catalogue read settles a tick after the synchronous mount, same as every other view
		// this file and `accessibility.test.ts` mount.
		await flushPromises();

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran, and it drew the READY branch rather than the loading line or a
		// failure: the shelves are what every capture of this surface is of.
		expect(view.contentEl.querySelector('.renovation-asset-library')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-al-shelves')).not.toBeNull();
	});

	it('opens on a selected asset when the page names one, inspector and all', async () => {
		const { view } = mountAssetLibraryHarness(document.body, 'base-cabinet-600');
		await flushPromises();

		// The ATTRIBUTE §7's narrow rule keys on, and the panel that rule leaves in the pane.
		// Asserted together because either alone is true of a build where the other stopped:
		// the attribute is written by the view's own ref, and the panel is drawn from the root's.
		expect(
			view.contentEl
				.querySelector('.renovation-asset-library')
				?.getAttribute('data-selected-asset-id'),
		).toBe('base-cabinet-600');
		expect(view.contentEl.querySelector('.rp-al-inspector__name')?.textContent?.trim()).toBe(
			'Base cabinet, 600',
		);
	});
});
