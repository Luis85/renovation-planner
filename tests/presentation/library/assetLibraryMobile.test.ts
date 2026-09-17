/**
 * @vitest-environment jsdom
 *
 * AD13's criterion 6: the asset library follows the platform gate the designer already has,
 * instead of drawing a catalogue whose every action leads somewhere this device cannot go.
 *
 * Driven against the REAL view rather than a component: the gate is in `onOpen`, which is
 * Obsidian's own hook, and what has to be true is that no Vue app is mounted at all — not merely
 * that a refusal is on screen beside one. `mobileDesktopOnly.test.ts` holds the same pair for the
 * Plan Editor and the designer; this is the third surface, and the one that had none.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { makeAssetLibraryView } from '../../helpers/makeAssetLibraryView';

installObsidianDom();

/**
 * The refusal SENTENCE, matched by its text rather than by `.rp-view-message` alone — the library
 * draws its own loading line under that very class, so the selector answers for both and a case
 * asserting its absence failed against `Loading assets…`. Measured, not foreseen.
 */
const refusal = (contentEl: HTMLElement): string | undefined =>
	[...contentEl.querySelectorAll('.rp-view-message')]
		.map((element) => element.textContent)
		.find((text) => text === t('en', 'view.mobile.desktop-only')) ?? undefined;

// `Platform` is a plain mutable object in the mock, so a case that assigns `isMobile` owes the
// later cases IN THIS FILE the reset — the `suite` project takes no `isolate: false`, so the
// mutation stops at the file boundary (CLAUDE.md's Testing section).
afterEach(() => {
	Platform.isMobile = false;
});

describe('the asset library on mobile', () => {
	it('says desktop only, in the sentence every refusing surface shares', async () => {
		Platform.isMobile = true;
		const view = makeAssetLibraryView();

		await view.onOpen();

		expect(refusal(view.contentEl)).toBe(t('en', 'view.mobile.desktop-only'));
	});

	/**
	 * **Mounted nothing**, which is the half a refusal drawn beside a live app would pass —
	 * asserted on the rendered tree rather than on a private flag, since the flag is exactly what a
	 * broken gate could still set correctly.
	 *
	 * **The WHOLE subtree, not a missing shelf.** The first version of this case asked for
	 * `.rp-al-shelves` to be absent and for one child, and it stayed GREEN with the gate deleted:
	 * a mounted library that has not finished reading draws exactly one child and no shelves yet,
	 * so both assertions were true of the state they existed to refuse. Watched failing is the only
	 * reason that was found. Every element under `contentEl` and its class, compared as a list, can
	 * be true of nothing but the refusal on its own.
	 */
	it('mounts no catalogue behind the refusal', async () => {
		Platform.isMobile = true;
		const view = makeAssetLibraryView();

		await view.onOpen();

		expect([...view.contentEl.querySelectorAll('*')].map((element) => element.className)).toEqual([
			'rp-view-message',
		]);
	});

	/**
	 * The desktop arm, so the case above is a refusal of something rather than a description of a
	 * view that never draws. It also holds the gate's SHAPE: the refusal must not survive on a
	 * device that can use the surface.
	 */
	it('draws the catalogue as before on a desktop', async () => {
		const view = makeAssetLibraryView();

		await view.onOpen();

		expect(refusal(view.contentEl)).toBeUndefined();
		expect(view.contentEl.children.length).toBeGreaterThan(0);
	});

	/**
	 * Reopening after a refusal must draw the catalogue, not carry the sentence over. Obsidian
	 * keeps the leaf and reuses the view, so `contentEl` is the SAME element both times — and
	 * `mount` empties it, which is the whole of why this passes. Driven rather than reasoned,
	 * because "the next mount sweeps it away" is exactly the assumption `AssetDesignerView.unmount`
	 * already had to be corrected on once.
	 */
	it('draws the catalogue when the same view is reopened off mobile', async () => {
		Platform.isMobile = true;
		const view = makeAssetLibraryView();
		await view.onOpen();
		await view.onClose();

		Platform.isMobile = false;
		await view.onOpen();

		expect(refusal(view.contentEl)).toBeUndefined();
	});
});
