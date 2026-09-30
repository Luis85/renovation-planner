import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { contrastOf } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, TEXT_CONTRAST } from './legibility';
import type { NativeBrowser } from './session';
import { mobileEmulation } from './session';

/**
 * AD18 UI critique, Task 4: a form dialog's ONE action row — Cancel, then the submit as Obsidian's
 * primary `mod-cta` — pinned at the foot of the dialog's scrolling body, measured in the real host.
 * Geometry by bounding rects, never a pixel from one platform: "one row" is two tops within a pixel.
 * Every case is desktop only. The preset dialog is the designer’s, as desktop only as the designer
 * is; and the project view is read-only under mobile emulation, so its New asset door is disabled
 * and opens no dialog there — as is New project, the other form dialog that view offers.
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

/** A new asset in the designer, and its preset dialog open. */
const openPresetDialog = async (browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string): Promise<void> => {
	const designer = createDesignerPage(browser, page, ui);
	await designer.createAsset(name);
	await designer.designer().$('.rp-designer-start-preset').click();
	await expect.poll(() => browser.$('.rp-dialog .rp-asset-preset-form').isDisplayed()).toBe(true);
};

/**
 * The window made SHORT (sidebars left alone), so even a few-field dialog overflows its panel and the
 * body scrolls. Electron sizes it; Obsidian's chromedriver refuses `setWindowSize`.
 */
const shortenTo = async (browser: NativeBrowser, height: number): Promise<void> => {
	await browser.executeObsidian((_obsidian, px) => {
		const electron = window as unknown as { require(id: string): { getCurrentWindow(): { getSize(): number[]; setSize(w: number, h: number): void } } };
		const current = electron.require('@electron/remote').getCurrentWindow();
		current.setSize(current.getSize()[0], px);
	}, height);
	await browser.pause(400);
};

/** A new project's schedule section, reached through the view state the pane itself keeps. */
const openSchedule = async (browser: NativeBrowser, ui: PlannerPage, name: string): Promise<void> => {
	await ui.openProjectView();
	await ui.projectView().$('.rp-empty-state__action').click();
	await ui.submitForm(name);
	await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe(name);
	await browser.executeObsidian(async ({ app }) => {
		const leaf = app.workspace.getLeavesOfType('renovation-project')[0];
		if (!leaf) throw new Error('No project view to route.');
		const { projectId } = leaf.view.getState() as { projectId?: string };
		await leaf.setViewState({ type: 'renovation-project', active: true, state: { projectId, section: 'schedule' } });
	});
	await expect.poll(() => ui.projectView().$('.rp-project-work').isDisplayed()).toBe(true);
};

describe('a form dialog’s one action row in the real Obsidian host', () => {
	desktop('New asset draws Cancel then a primary Save on one row, at the default window and a sidebar-width leaf, and Enter submits', async ({
		native: { browser, ui, directory },
	}) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-view-aside__create-asset').click();
		await expect.poll(() => ui.dialog().isDisplayed()).toBe(true);

		const wide = await layout(browser);
		expectOneRow(wide);

		const submit = browser.$('.rp-dialog button[type="submit"]');
		const read = async () => {
			const paint = await submitPaint(browser);
			return { ratio: contrastOf(paint).ratio, fill: paint.backgrounds[0] };
		};
		const contrast = await inBothThemes(browser, read);
		// Hovered, the fill darkens (light) or lightens (dark) further; the label must still clear 4.5:1.
		await submit.moveTo();
		const hovered = await inBothThemes(browser, read);
		await browser.$('.rp-dialog-title').moveTo();
		expect(hovered.light.fill).not.toBe(contrast.light.fill);
		expect(hovered.dark.fill).not.toBe(contrast.dark.fill);
		expect(hovered.light.ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
		expect(hovered.dark.ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);

		await narrowTo(browser, 360);
		const narrow = await layout(browser);
		await writeEvidence(directory, 'dialog-footer', { wide, narrow, contrast, hovered });
		expectOneRow(narrow);
		expect(narrow.panel && narrow.panel.right - narrow.panel.left).toBeLessThan(wide.panel ? wide.panel.right - wide.panel.left : 0);
		expect(contrast.light.ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
		expect(contrast.dark.ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);

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
		await openPresetDialog(browser, page, ui, 'Preset probe');

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
		const { panel, body, footer, apply, width, preview } = measured;
		if (!panel || !body || !footer || !apply || !width || !preview) throw new Error(`Preset dialog parts missing: ${JSON.stringify(measured)}`);

		// Apply sits inside the panel and inside the window.
		expect(apply.top).toBeGreaterThanOrEqual(panel.top);
		expect(apply.bottom).toBeLessThanOrEqual(Math.min(panel.bottom, viewport));
		// The width field is inside the scroller's visible area and not under the pinned row.
		expect(width.top).toBeGreaterThanOrEqual(body.top);
		expect(width.bottom).toBeLessThanOrEqual(footer.top);
		// And so is the chosen preset's preview, below the fields.
		expect(preview.top).toBeGreaterThanOrEqual(body.top);
		expect(preview.bottom).toBeLessThanOrEqual(footer.top);

		// A REFUSED Apply takes no hover fill: a width out of range makes it inoperative.
		await browser.$('.rp-dialog input[name="width"]').setValue('1');
		await expect.poll(() => browser.$('.rp-dialog button[type="submit"]').getAttribute('aria-disabled')).toBe('true');
		const refusedFill = async () => (await submitPaint(browser)).backgrounds[0];
		const resting = await refusedFill();
		await browser.$('.rp-dialog button[type="submit"]').moveTo();
		expect(await refusedFill()).toBe(resting);
	});

	desktop('Tab onto a field scrolled under the pinned row brings it out from under the row', async ({ native: { browser, page, ui, directory } }) => {
		await openPresetDialog(browser, page, ui, 'Focus probe');

		// The default preset's width field, scrolled so it sits wholly UNDER the row (which is taller
		// than the field), with focus on the control before it — the gallery's one tab stop — placed
		// without scrolling anything.
		const placed = await browser.execute(() => {
			const body = document.querySelector('.rp-dialog-body');
			const field = document.querySelector<HTMLElement>('.rp-dialog input[name="width"]');
			const row = document.querySelector('.rp-dialog .rp-dialog-actions');
			const stop = document.querySelector<HTMLElement>('.rp-preset-choice[tabindex="0"]');
			if (!body || !field || !row || !stop) throw new Error('No preset dialog to arrange.');
			body.scrollTop += field.getBoundingClientRect().top - row.getBoundingClientRect().top - 4;
			stop.focus({ preventScroll: true });
			const fieldBox = field.getBoundingClientRect();
			const rowBox = row.getBoundingClientRect();
			return { covered: fieldBox.top >= rowBox.top && fieldBox.bottom <= rowBox.bottom, focused: document.activeElement === stop };
		});
		expect(placed).toEqual({ covered: true, focused: true });

		await browser.keys('Tab');
		await expect.poll(() => browser.execute(() => document.activeElement?.getAttribute('name'))).toBe('width');
		await browser.pause(300);
		const after = await boxes(browser, { field: '.rp-dialog input[name="width"]', row: '.rp-dialog .rp-dialog-actions', body: '.rp-dialog-body' });
		await writeEvidence(directory, 'focus-not-obscured', after);
		const { field, row, body } = after;
		if (!field || !row || !body) throw new Error(`Preset dialog parts missing: ${JSON.stringify(after)}`);
		expect(field.top).toBeGreaterThanOrEqual(body.top);
		expect(field.bottom).toBeLessThanOrEqual(row.top + 1);
	});
	desktop('a form that used to draw its own submit keeps it in view, on the one row, while a short window scrolls its body', async ({
		native: { browser, ui, directory },
	}) => {
		// Add trade opens `NamedCatalogueForm`, one of the forms that drew its own bare submit inside the
		// scroller until the open-issues round's Task 3 gave every dialog form `FormSubmitRow`.
		await openSchedule(browser, ui, 'Scroll probe');
		await ui.projectView().$('button=Add trade').click();
		await expect.poll(() => browser.$('.rp-dialog .rp-dialog-form').isDisplayed()).toBe(true);
		await shortenTo(browser, 240);

		const at = async (where: 'top' | 'bottom') => {
			const scroll = await browser.execute((edge) => {
				const body = document.querySelector('.rp-dialog-body');
				if (!body) throw new Error('No dialog body to scroll.');
				body.scrollTop = edge === 'top' ? 0 : body.scrollHeight;
				return { overflow: body.scrollHeight - body.clientHeight, scrollTop: body.scrollTop, viewport: window.innerHeight };
			}, where);
			await browser.pause(150);
			return { ...scroll, ...(await layout(browser)) };
		};
		const top = await at('top');
		const bottom = await at('bottom');
		await writeEvidence(directory, 'dialog-footer-short', { top, bottom });

		// The precondition, or the case passes on a body that never scrolled.
		expect(top.overflow).toBeGreaterThan(20);
		expect(bottom.scrollTop).toBeGreaterThan(20);
		for (const measured of [top, bottom]) {
			const { panel, submit } = measured;
			if (!panel || !submit) throw new Error(`Dialog parts missing: ${JSON.stringify(measured)}`);
			// The submit is inside what the dialog SHOWS: its panel, clipped by the window.
			expect(submit.top).toBeGreaterThanOrEqual(panel.top);
			expect(submit.bottom).toBeLessThanOrEqual(Math.min(panel.bottom, measured.viewport));
			expectOneRow(measured);
		}
	});
});
