import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { writeEvidence } from './diagnostics';
import { capture, difference, DISTINCT } from './pixels';
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
	 * washbasin's thumbnails captured from the same gallery in the same run and compared as
	 * drawings (`difference` in `pixels.ts`: each picture's ink against its own background, so a
	 * pressed card's colour is not a difference): more than `DISTINCT` of the pixels either inks
	 * differ. The existing *offers the vanity under Bathroom…* case asserts the two cards' path data
	 * differ, which two drawings rendering the same pixels also satisfy. WHAT STAYS HUMAN:
	 * "recognisably" — whether a person tells the vanity from the washbasin at 48 px at a glance,
	 * which is about what the difference IS (a wider cabinet, a dashed carcass), not how much of it
	 * there is. Both captures are in the case's evidence folder.
	 */
	desktop('paints the vanity\'s card differently from the washbasin\'s in more than a tenth of their ink', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Recognisable vanity');
		await designer.designer().$('.rp-designer-start-preset').click();
		await expect.poll(() => browser.$(`${card('vanity')} path`).isDisplayed()).toBe(true);
		await expect.poll(() => browser.$(`${card('washbasin')} path`).isDisplayed()).toBe(true);

		const vanity = await capture(browser, card('vanity'), directory, 'vanity-card');
		const washbasin = await capture(browser, card('washbasin'), directory, 'washbasin-card');
		const cards = await difference(browser, vanity, washbasin);
		const again = await difference(browser, vanity, await capture(browser, card('vanity'), directory, 'vanity-card-again'));
		await writeEvidence(directory, 'preset-card-pixels', { cards, again });

		// The instrument reaches something, and answers "the same" for one card captured twice.
		expect(Math.min(...cards.inked), 'ink on both cards').toBeGreaterThan(0);
		expect(again.differing, 'the vanity card against itself').toBe(0);
		expect(cards.fraction, `vanity against washbasin: ${String(cards.differing)} of their ink`).toBeGreaterThan(DISTINCT);
	});
});
