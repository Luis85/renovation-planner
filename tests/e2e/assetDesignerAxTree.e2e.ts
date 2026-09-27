import { describe, expect } from 'vitest';
import { test } from './fixture';
import { liveRegionTexts, readAx } from './axTree';
import { createDesignerPage, DESIGNER } from './designer';
import { mobileEmulation } from './session';

/**
 * Two screen-reader clauses read from Chromium's own accessibility tree over CDP (probe Q1,
 * AD18-R30), not from DOM attribute strings — so an implicit live region counts as an explicit one.
 */
const desktop = mobileEmulation ? test.skip : test;
const IN_DESIGNER = `.workspace-leaf-content[data-type="${DESIGNER}"]`;

describe('The asset designer in the real accessibility tree', () => {
	/**
	 * `Design an Asset.md` step 88b, **DISCHARGED** under AD18-R30: "the screen reader announces
	 * nothing at all, at either moment" is the claim that nothing from the save-state label's text up
	 * to the document is a live region, and that is what this reads — Chromium's computed `live` on
	 * every node of that chain, implicit roles included (an `<output>` wrapper reddens it where the
	 * parity case's attribute walk stays green, measured), after a commit ("Saved just now") and
	 * again after the minute tick advances the visible phrase ("Saved N min ago"), the step's two
	 * moments. Its AX text is the bare state word at both, since the relative phrase is `aria-hidden`
	 * (`SaveStateIndicator.vue`'s docblock).
	 *
	 * **"At all" reaches past the label's own ancestry**: at each moment, every live region in the
	 * document (the plugin's notice regions and Obsidian's included) holds nothing it did not hold
	 * before the commit, and none holds the save word. So a save announced through a notice fails
	 * this too (measured: a `notify` on every settled save reddens it). That read is a STATE, not the
	 * announcement event, so a region written and then cleared between two reads would pass.
	 *
	 * The renderer's clock is made movable before the save, as `assetDesignerParity.e2e.ts` does for
	 * step 88c: an offset on `Date.now` and the indicator's one-minute interval run every 200 ms.
	 */
	desktop('keeps the save-state label out of every live region, after a commit and after the minute tick', async ({
		native: { browser, page, ui },
	}) => {
		await browser.execute(() => {
			const clock = window as unknown as { rpAhead: number };
			clock.rpAhead = 0;
			const { now } = Date;
			const every = window.setInterval.bind(window);
			Date.now = () => now.call(Date) + clock.rpAhead;
			window.setInterval = ((run: TimerHandler, wait?: number) => every(run, wait === 60_000 ? 200 : wait)) as typeof window.setInterval;
		});
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Quiet toilet');
		const before = await liveRegionTexts(browser);
		await designer.nudgeTo(assetId, 2);
		const label = () => readAx(browser, `${IN_DESIGNER} .rp-save-state-label`);
		// Nor through any OTHER live region: nothing new in one since the commit, and none holds the save word.
		const heard = async () => (await liveRegionTexts(browser)).filter((text) => !before.includes(text) || /Sav(?:ed|ing)/u.test(text));

		await expect.poll(designer.header).toBe('Saved just now');
		await expect.poll(label).toMatchObject({ liveChain: [], text: 'Saved' });
		expect(await heard()).toEqual([]);

		await browser.execute(() => {
			(window as unknown as { rpAhead: number }).rpAhead = 5 * 60_000;
		});
		await expect.poll(designer.header).toBe('Saved 5 min ago');
		await expect.poll(label).toMatchObject({ liveChain: [], text: 'Saved' });
		expect(await heard()).toEqual([]);
	});

	/**
	 * `Calibrate a sheet and reserve space.md` step 32, a **GUARD** under AD18-R30, not a discharge.
	 * It measures what a screen reader is HANDED once a resize sets the review flag: the notice's AX
	 * node is a `status` with Chromium's computed `live: polite` and the review sentence as its text,
	 * and the button's computed name is "Mark clearance as reviewed". Whether the notice is SPOKEN
	 * stays a human judgement, and here with less confidence than step 88b's: `DesignerClearanceReview.vue`
	 * inserts the status element together with its text (`v-if` on the section), which is the
	 * live-region pattern screen readers announce least reliably. So step 32 keeps its `obsidian` tier.
	 */
	desktop('hands a screen reader a polite status and a named button once a resize flags the clearance', async ({
		native: { browser, page, ui },
	}) => {
		const { createAsset, applyPreset, editDimensions, readSidecar } = createDesignerPage(browser, page, ui);
		const assetId = await createAsset('Announced toilet');
		await applyPreset('toilet');
		await editDimensions(200, 350);
		await expect.poll(() => readSidecar(assetId).shape?.clearanceNeedsReview).toBe(true);

		const review = `${IN_DESIGNER} .rp-designer-clearance:has([data-rp-action="clearance-reviewed"])`;
		await expect.poll(() => readAx(browser, `${review} > p`)).toMatchObject({
			role: 'status',
			live: 'polite',
			text: 'This clearance was kept at the size you drew it when the object was resized. Check that it still describes the space you need.',
		});
		await expect.poll(() => readAx(browser, `${review} > button`)).toMatchObject({ role: 'button', name: 'Mark clearance as reviewed' });
	});
});
