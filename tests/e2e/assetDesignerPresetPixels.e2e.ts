import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { writeEvidence } from './diagnostics';
import { atPixelRatio, capture, difference, DISTINCT, RATIOS } from './pixels';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Design an Asset.md` step 57's "recognisably not the Washbasin card", as the
 * host paints the two cards. Desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

const card = (preset: string): string => `.rp-preset-gallery .rp-preset-choice[data-preset="${preset}"] svg`;

describe('Design an Asset, the vanity\'s card as painted in the real Obsidian host', () => {
	/*
	 * Step 57, "recognisably not the Washbasin card". GUARD (AD18-R30). The vanity's and the
	 * washbasin's thumbnails captured from the same gallery in the same run, each STAGED at one
	 * whole-pixel spot (`capture` in `pixels.ts`), and compared as drawings (`difference`: each
	 * picture's ink against its own background, so a pressed card's colour is not a difference):
	 * more than `DISTINCT` of the pixels either inks differ, at a device pixel ratio of 1 and of 2
	 * whatever the machine's own. Staging is what makes the relation hold at 1: in their own cards
	 * the two sit at different x, and a sub-pixel phase difference alone reads as a different
	 * drawing. The existing *offers the vanity under Bathroom…* case asserts the two cards' path data
	 * differ, which two drawings rendering the same pixels also satisfy. WHAT STAYS HUMAN:
	 * "recognisably" — whether a person tells the vanity from the washbasin at 48 px at a glance,
	 * which is about what the difference IS (a wider cabinet, a dashed carcass), not how much of it
	 * there is; and how the card reads on its own background and sub-pixel position, which the stage
	 * replaces (`capture`'s docblock names what it drops). Both captures are in the case's evidence
	 * folder.
	 */
	desktop('paints the vanity\'s card differently from the washbasin\'s in more than a tenth of their ink', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Recognisable vanity');
		await designer.designer().$('.rp-designer-start-preset').click();
		await expect.poll(() => browser.$(`${card('vanity')} path`).isDisplayed()).toBe(true);
		await expect.poll(() => browser.$(`${card('washbasin')} path`).isDisplayed()).toBe(true);

		const native = await browser.execute(() => window.devicePixelRatio);
		const read = (ratio: number) =>
			atPixelRatio(browser, ratio, async () => {
				const vanity = await capture(browser, card('vanity'), directory, `vanity-card@${String(ratio)}x`);
				const washbasin = await capture(browser, card('washbasin'), directory, `washbasin-card@${String(ratio)}x`);
				const again = await capture(browser, card('vanity'), directory, `vanity-card-again@${String(ratio)}x`);
				return { devicePixelRatio: ratio, cards: await difference(browser, vanity, washbasin), again: await difference(browser, vanity, again) };
			});
		const byRatio = [];
		for (const ratio of RATIOS) byRatio.push(await read(ratio));
		await writeEvidence(directory, 'preset-card-pixels', { nativeDevicePixelRatio: native, byRatio });

		for (const { devicePixelRatio: ratio, cards, again } of byRatio) {
			const at = `at ${String(ratio)}x`;
			// The instrument reaches something, compares one grid, and answers "the same" for one card staged twice.
			expect(cards.sizes[0], `${at}: the two cards' sizes`).toEqual(cards.sizes[1]);
			expect(Math.min(...cards.inked), `${at}: ink on both cards`).toBeGreaterThan(0);
			expect(again.differing, `${at}: the vanity card against itself`).toBe(0);
			expect.soft(cards.fraction, `${at}: vanity against washbasin, ${String(cards.differing)} of their ink`).toBeGreaterThan(DISTINCT);
		}
	});
});
