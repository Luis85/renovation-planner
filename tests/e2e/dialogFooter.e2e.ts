import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { contrastOf } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, TEXT_CONTRAST } from './legibility';
import type { NativeBrowser } from './session';
import { mobileEmulation } from './session';

/**
 * AD18 UI critique, Task 4: a form dialog's ONE action row — Cancel, then the submit as Obsidian's
 * primary `mod-cta` — pinned at the foot of the dialog's scrolling body, measured in the real host.
 * Geometry by bounding rects, never a pixel from one platform: "one row" is two tops within a pixel.
 * The preset dialog is the designer's, so that case is desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

interface Box { top: number; bottom: number; left: number; right: number }

/** The first element each selector names, as its bounding rect, or `null` where it names none. */
const boxes = (browser: NativeBrowser, selectors: Record<string, string>) =>
	browser.execute(
		(named) =>
			Object.fromEntries(
				Object.entries(named).map(([key, selector]) => {
					const rect = document.querySelector(selector)?.getBoundingClientRect();
					return [key, rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null];
				}),
			),
		selectors,
	) as Promise<Record<string, Box | null | undefined>>;

/** The open dialog's panel, the two buttons in its action row, and how many rows it draws. */
const layout = async (browser: NativeBrowser) => {
	const { panel, cancel, submit } = await boxes(browser, { panel: '.rp-dialog', cancel: '.rp-dialog [data-rp-action="cancel"]', submit: '.rp-dialog button[type="submit"]' });
	const { rows, primary } = await browser.execute(() => ({
		rows: document.querySelectorAll('.rp-dialog .rp-dialog-actions').length,
		primary: document.querySelector('.rp-dialog button[type="submit"]')?.classList.contains('mod-cta') ?? false,
	}));
	return { panel, cancel, submit, rows, primary };
};

type Layout = Awaited<ReturnType<typeof layout>>;

/** One row, Cancel then the primary submit, both inside the panel. */
function expectOneRow(measured: Layout): void {
	const { panel, cancel, submit } = measured;
	if (!panel || !cancel || !submit) throw new Error(`Dialog parts missing: ${JSON.stringify(measured)}`);
	expect(measured.rows).toBe(1);
	expect(measured.primary).toBe(true);
	expect(Math.abs(submit.top - cancel.top)).toBeLessThanOrEqual(1);
	expect(submit.left).toBeGreaterThanOrEqual(cancel.right);
	for (const button of [cancel, submit]) {
		expect(button.left).toBeGreaterThanOrEqual(panel.left);
		expect(button.right).toBeLessThanOrEqual(panel.right);
		expect(button.bottom).toBeLessThanOrEqual(panel.bottom);
	}
}

/**
 * The submit's label colour and every background from it outwards, as `contrastOf` reads them. Not
 * `paints`: the submit's fill is a `color-mix`, which Chromium computes to `color(srgb …)` and
 * `contrastOf` reads `rgb()` alone — so each colour is put through a 1 px canvas, which answers it
 * as the sRGB bytes it paints.
 */
const submitPaint = (browser: NativeBrowser) =>
	browser.execute(() => {
		const element = document.querySelector('.rp-dialog button[type="submit"]');
		const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
		if (!element || !context) throw new Error('No submit to measure.');
		const rgb = (colour: string): string => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = colour;
			context.fillRect(0, 0, 1, 1);
			const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
			return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
		};
		const chain: Element[] = [];
		for (let el: Element | null = element; el; el = el.parentElement) chain.push(el);
		return {
			stroke: rgb(getComputedStyle(element).color),
			opacity: chain.reduce((product, el) => product * Number(getComputedStyle(el).opacity), 1),
			backgrounds: chain.map((el) => rgb(getComputedStyle(el).backgroundColor)),
		};
	});

/**
 * The window narrowed, both sidebars collapsed, so the leaf holding the dialog is about as wide as
 * an Obsidian sidebar. Obsidian's chromedriver refuses `setWindowSize`; Electron sizes it instead.
 */
const narrowTo = async (browser: NativeBrowser, width: number): Promise<void> => {
	await browser.executeObsidian(({ app }, px) => {
		for (const split of [app.workspace.leftSplit, app.workspace.rightSplit]) split.collapse();
		const electron = window as unknown as { require(id: string): { getCurrentWindow(): { setSize(w: number, h: number): void } } };
		electron.require('@electron/remote').getCurrentWindow().setSize(px, 900);
	}, width);
	await browser.pause(400);
};

describe('a form dialog’s one action row in the real Obsidian host', () => {
	test('New asset draws Cancel then a primary Save on one row, at the default window and a sidebar-width leaf, and Enter submits', async ({
		native: { browser, ui, directory },
	}) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-view-aside__create-asset').click();
		await expect.poll(() => ui.dialog().isDisplayed()).toBe(true);

		const wide = await layout(browser);
		expectOneRow(wide);

		const contrast = await inBothThemes(browser, async () => contrastOf(await submitPaint(browser)).ratio);

		await narrowTo(browser, 360);
		const narrow = await layout(browser);
		await writeEvidence(directory, 'dialog-footer', { wide, narrow, contrast });
		expectOneRow(narrow);
		expect(narrow.panel && narrow.panel.right - narrow.panel.left).toBeLessThan(wide.panel ? wide.panel.right - wide.panel.left : 0);
		expect(contrast.light).toBeGreaterThanOrEqual(TEXT_CONTRAST);
		expect(contrast.dark).toBeGreaterThanOrEqual(TEXT_CONTRAST);

		// The submit is still the FORM's: Enter in a field submits through it.
		const name = ui.dialog().$('[data-field="name"]');
		await name.setValue('Footer probe');
		await browser.pause(250);
		await browser.keys('Enter');
		await expect.poll(() => browser.$('.rp-dialog').isExisting()).toBe(false);
	});

	desktop('the preset dialog keeps Apply and the chosen preset’s width field in view after a card low in the gallery is chosen', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Preset probe');
		await designer.designer().$('.rp-designer-start-preset').click();
		await expect.poll(() => browser.$('.rp-dialog .rp-asset-preset-form').isDisplayed()).toBe(true);

		const viewport = await browser.execute(() => window.innerHeight);
		// Apply is in view BEFORE anything is chosen, with the gallery at its top: the row is pinned at
		// the body's foot rather than waiting below the whole gallery.
		const opened = await boxes(browser, { panel: '.rp-dialog', apply: '.rp-dialog button[type="submit"]' });
		await writeEvidence(directory, 'preset-opened', { ...opened, viewport });
		if (!opened.panel || !opened.apply) throw new Error(`Preset dialog parts missing: ${JSON.stringify(opened)}`);
		expect(opened.apply.bottom).toBeLessThanOrEqual(Math.min(opened.panel.bottom, viewport));

		// Scrolled as a user scrolls to find a card: just far enough that `bed` — the catalogue's LAST
		// preset, at the gallery's foot — shows fully above the pinned row. Then pressed.
		await browser.execute(() => {
			const body = document.querySelector('.rp-dialog-body');
			const card = document.querySelector('.rp-preset-choice[data-preset="bed"]');
			const row = document.querySelector('.rp-dialog .rp-dialog-actions');
			if (!body || !card || !row) throw new Error('No preset dialog to scroll.');
			body.scrollTop += card.getBoundingClientRect().bottom - row.getBoundingClientRect().top;
		});
		const bed = browser.$('.rp-preset-choice[data-preset="bed"]');
		await bed.click();
		await expect.poll(() => bed.getAttribute('aria-pressed')).toBe('true');
		await browser.pause(400);

		const measured = await boxes(browser, {
			panel: '.rp-dialog',
			body: '.rp-dialog-body',
			footer: '.rp-dialog .rp-dialog-actions',
			apply: '.rp-dialog button[type="submit"]',
			width: '.rp-dialog input[name="width"]',
			preview: '.rp-asset-preset-chosen > svg.rp-asset-preset-preview',
		});
		await writeEvidence(directory, 'preset-footer', measured);
		const { panel, body, footer, apply, width } = measured;
		if (!panel || !body || !footer || !apply || !width) throw new Error(`Preset dialog parts missing: ${JSON.stringify(measured)}`);

		// Apply sits inside the panel and inside the window.
		expect(apply.top).toBeGreaterThanOrEqual(panel.top);
		expect(apply.bottom).toBeLessThanOrEqual(Math.min(panel.bottom, viewport));
		// The width field is inside the scroller's visible area and not under the pinned row.
		expect(width.top).toBeGreaterThanOrEqual(body.top);
		expect(width.bottom).toBeLessThanOrEqual(footer.top);
	});
});
