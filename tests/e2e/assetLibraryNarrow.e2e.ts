import { describe, expect } from 'vitest';
import { test } from './fixture';
import { NARROW, openCatalogue } from './library';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md`'s rows below §7's 35rem rung, in a real
 * Obsidian whose window is narrowed until the library's own container measures under 560px —
 * the `@container rp-al` query evaluated against a real leaf, which jsdom never evaluates.
 */
const desktop = mobileEmulation ? test.skip : test;

describe('Browse the asset library at a sidebar\'s width, in the real Obsidian host', () => {
	// Step 24b.
	desktop('puts the caret on the search field when Show all categories is pressed with the sidebar closed', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: NARROW });
		await expect.poll(() => lib.funnel().isDisplayed()).toBe(true);
		expect(await lib.sidebar().isDisplayed()).toBe(false);
		await lib.pressFunnel(true);
		await lib.emptyIn('Furniture', 'plank');
		await lib.pressFunnel(false);

		await lib.showAllCategories();
		expect((await lib.focused()).className).toBe('rp-al-search__input');
		expect(await lib.library().$('.rp-al-search__input').getValue()).toBe('plank');
	});

	// Step 26.
	desktop('opens and closes the withdrawn sidebar from the funnel, aria-expanded following it', async ({ native: { browser, page, ui } }) => {
		const lib = await openCatalogue(browser, page, ui, { width: NARROW, layout: 'Grid' });
		await expect.poll(() => lib.sidebar().isDisplayed()).toBe(false);
		expect(await lib.funnel().getAttribute('aria-expanded')).toBe('false');

		await lib.pressFunnel(true);
		expect(await lib.funnel().getAttribute('aria-expanded')).toBe('true');
		expect(await lib.library().$('.rp-al-tiles').isDisplayed()).toBe(true);

		await lib.pressFunnel(false);
		expect(await lib.funnel().getAttribute('aria-expanded')).toBe('false');
	});

	// Step 27.
	desktop('withdraws the sidebar and the funnel together once a tile is selected, however the sidebar was showing', async ({
		native: { browser, page, ui },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { width: NARROW, layout: 'Grid' });
		const inspector = () => lib.library().$('.rp-al-inspector__name');
		const controls = async () => ({ sidebar: await lib.sidebar().isDisplayed(), funnel: await lib.funnel().isDisplayed() });

		// FINDING: the row says the funnel is "already hidden" before the selection. It is not —
		// it is the sidebar's replacement at this width (step 25) — and the selection HIDES it.
		await expect.poll(controls).toEqual({ sidebar: false, funnel: true });
		await lib.tile('Sofa').click();
		await expect.poll(() => inspector().getText()).toBe('Sofa');
		expect(await controls()).toEqual({ sidebar: false, funnel: false });

		// The same with the sidebar pressed OPEN before the selection.
		await lib.library().$('.rp-al-inspector__back').click();
		await expect.poll(controls).toEqual({ sidebar: false, funnel: true });
		await lib.funnel().click();
		await expect.poll(controls).toEqual({ sidebar: true, funnel: true });
		await lib.tile('Vanity').click();
		await expect.poll(() => inspector().getText()).toBe('Vanity');
		expect(await controls()).toEqual({ sidebar: false, funnel: false });
	});
});
