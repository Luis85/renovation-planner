import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createClearancePage, square } from './clearance';
import { createDesignerPage } from './designer';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Calibrate a sheet and reserve space.md` steps 21a to 21l: the Clearance
 * section's `Show clearance` switch — one leaf-local ref that the canvas layer, hit-testing, the
 * context menu, the selection keys, the rulers, `Shift+2` and the legend all read, and that every
 * way a boundary comes into being turns back on.
 *
 * The object is a typed 800 × 400 rectangle with a generated boundary rather than the case's
 * Asset B: the toilet preset's outline is CURVED, so the four-sided helper is withheld on it
 * (step 23's own rule) and Generate is unreachable there. The toilet is used where no helper is.
 */
const desktop = mobileEmulation ? test.skip : test;

type Designer = ReturnType<typeof createDesignerPage>;

/** Generate a uniform boundary from the helper's All sides field. */
async function generate(designer: Designer, allSides: number): Promise<void> {
	await designer.designer().$('input[name="clearance-all-sides"]').setValue(String(allSides));
	await designer.designer().$('button[name="generate-clearance"]').click();
}

/** An asset, and either a typed rectangle with a generated 300 mm boundary or the toilet preset. */
async function boundedAsset(browser: NativeBrowser, designer: Designer, name: string, from: 'rectangle' | 'toilet') {
	const assetId = await designer.createAsset(name);
	const clearance = () => designer.readSidecar(assetId).shape?.clearance ?? null;
	if (from === 'toilet') await designer.applyPreset('toilet');
	else {
		await designer.editDimensions(800, 400);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);
		await generate(designer, 300);
		await expect.poll(clearance).not.toBeNull();
	}
	const reference = createClearancePage(browser, designer);
	await expect.poll(reference.switchOn).toBe(true);
	return { reference, clearance, revision: () => designer.readSidecar(assetId).revision };
}

describe('Show clearance, in the real Obsidian host', () => {
	// Steps 21a, 21b and 21c.
	desktop('hides the boundary from the canvas, the menu and the legend, and every new boundary shows it again', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const { reference, revision, clearance } = await boundedAsset(browser, designer, 'Hidden cabinet', 'rectangle');
		const legendRow = () => designer.designer().$('.rp-designer-legend__swatch--clearance');

		// Step 21a: the switch is there and on; the boundary, and its legend row, are drawn.
		const shown = await reference.probe();
		expect(shown.clearanceVisible).toBe(true);
		expect(await legendRow().isExisting()).toBe(true);
		const box = shown.clearanceBox;
		if (!box) throw new Error('No clearance drawn.');
		// Inside the boundary and outside the footprint: its bottom band. Right-clicked while shown first,
		// so the empty answer below is about the switch and not about a point that misses.
		const band = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height - 6) };
		await reference.clickAt(band, 2);
		await expect.poll(() => reference.menu().isExisting()).toBe(true);
		await browser.keys('Escape');
		await expect.poll(() => reference.menu().isExisting()).toBe(false);

		// Step 21b: off — gone from the canvas, the menu and the legend.
		await reference.setSwitch(false);
		expect((await reference.probe()).clearanceVisible).toBe(false);
		await expect.poll(() => legendRow().isExisting()).toBe(false);
		await reference.clickAt(band, 2);
		await browser.pause(500);
		expect(await reference.menu().isExisting()).toBe(false);

		// Step 21c: Generate, arming Trace clearance, and a preset each turn it back on.
		const generated = revision();
		await generate(designer, 150);
		await expect.poll(revision).toBe(generated + 1);
		await expect.poll(reference.switchOn).toBe(true);
		expect((await reference.probe()).clearanceVisible).toBe(true);

		await reference.setSwitch(false);
		await reference.tool('Trace clearance').click();
		await expect.poll(reference.switchOn).toBe(true);
		await reference.tool('Select').click();

		await reference.setSwitch(false);
		await designer.applyPreset('toilet');
		await expect.poll(reference.switchOn).toBe(true);
		expect(clearance()).not.toBeNull();
	});

	// Steps 21f, 21i, 21j and 21d.
	desktop('keeps a hidden selected boundary undrawn and out of reach of keys and menus, but not of the Inspector', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const { reference, revision, clearance } = await boundedAsset(browser, designer, 'Selected toilet', 'toilet');
		const row = () => designer.designer().$('.rp-designer-part-row[name="clearance"]');
		const menuDelete = () => reference.menu().$('[role="menuitem"]*=Delete');
		const marks = async () => (await reference.probe()).selectionShapes;
		const box = (await reference.probe()).clearanceBox;
		if (!box) throw new Error('No clearance drawn.');
		await designer.selectPart('clearance');
		await expect.poll(marks).toBeGreaterThan(0);

		// Step 21f: hidden — still selected, still in the Inspector, nothing of it drawn.
		await reference.setSwitch(false);
		expect(await row().getAttribute('aria-pressed')).toBe('true');
		expect(await reference.inspectorDelete().isExisting()).toBe(true);
		expect(await marks()).toBe(0);
		const before = revision();

		// Step 21i, hidden: an arrow, Delete, the row's menu and Shift+F10 on the canvas all do nothing.
		await designer.nudge();
		await designer.focusCanvas();
		await browser.keys('Delete');
		await row().click({ button: 'right' });
		await designer.focusCanvas();
		await browser.keys(['Shift', 'F10']);
		await browser.pause(800);
		expect(revision()).toBe(before);
		expect(await reference.menu().isExisting()).toBe(false);

		// Step 21f's other half, and 21i shown: the marks come back, and all three act.
		await reference.setSwitch(true);
		await expect.poll(marks).toBeGreaterThan(0);
		await designer.nudge();
		await expect.poll(revision).toBe(before + 1);
		await designer.focusCanvas();
		await browser.keys('Delete');
		await expect.poll(clearance).toBeNull();
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(clearance).not.toBeNull();
		await designer.selectPart('clearance');
		await row().click({ button: 'right' });
		await expect.poll(() => menuDelete().getAttribute('aria-disabled')).not.toBe('true');
		await browser.keys('Escape');
		await designer.focusCanvas();
		await browser.keys(['Shift', 'F10']);
		await expect.poll(() => reference.menu().isExisting()).toBe(true);
		await browser.keys('Escape');

		// Step 21j: the Inspector's own Delete still removes a hidden boundary; step 21d: its Undo re-shows it.
		await reference.setSwitch(false);
		await reference.inspectorDelete().click();
		await expect.poll(clearance).toBeNull();
		expect(await reference.showSwitch().isExisting()).toBe(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(clearance).not.toBeNull();
		await expect.poll(reference.switchOn).toBe(true);
		expect((await reference.probe()).clearanceVisible).toBe(true);

		// Step 21f's drag: at a hidden handle's place it grabs nothing and writes nothing.
		await designer.selectPart('clearance');
		await reference.setSwitch(false);
		const held = clearance();
		const dragged = revision();
		const corner = { x: Math.round(box.x + box.width), y: Math.round(box.y + box.height) };
		await browser.action('pointer').move({ ...corner, origin: 'viewport' }).down().move({ x: corner.x + 60, y: corner.y + 60, duration: 150, origin: 'viewport' }).up().perform();
		await browser.pause(800);
		expect(revision()).toBe(dragged);
		expect(clearance()).toEqual(held);
	});

	// Steps 21k, 21l, 21g and 21e.
	desktop('takes no ruler band and no frame while hidden, stays hidden over an unrelated write, and re-shows a swapped boundary', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const { reference, revision, clearance } = await boundedAsset(browser, designer, 'Framed cabinet', 'rectangle');
		const camera = async () => (await reference.probe()).camera;
		const frameSelection = async () => {
			await designer.focusCanvas();
			await browser.keys(['Shift', '2']);
			await browser.pause(600);
		};

		// Step 21k. Zoomed in first, so a frame on the boundary is a camera the view does not already have.
		await designer.designer().$('[data-rp-view="zoom-in"]').click();
		await designer.selectPart('clearance');
		await reference.setSwitch(false);
		expect(await reference.rulerBands()).toBe(0);
		const still = await camera();
		await frameSelection();
		expect(await camera()).toEqual(still);
		await reference.setSwitch(true);
		await expect.poll(reference.rulerBands).toBe(2);
		await frameSelection();
		expect(await camera()).not.toEqual(still);

		// Step 21l: an unrelated write — the footprint nudged — leaves the switch off.
		await reference.setSwitch(false);
		await designer.selectPart('footprint');
		const nudged = revision();
		await designer.nudge();
		await expect.poll(revision).toBe(nudged + 1);
		await browser.pause(500);
		expect(await reference.switchOn()).toBe(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(revision).toBe(nudged + 2);

		// Step 21g: an Undo or a Redo that swaps the boundary for a different one re-shows it.
		const earlier = clearance();
		await generate(designer, 150);
		await expect.poll(clearance).not.toEqual(earlier);
		const later = clearance();
		await reference.setSwitch(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(clearance).toEqual(earlier);
		await expect.poll(reference.switchOn).toBe(true);
		await reference.setSwitch(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'Shift', 'z']);
		await expect.poll(clearance).toEqual(later);
		await expect.poll(reference.switchOn).toBe(true);

		// Step 21e: switched off in the middle of a trace, the finished boundary still shows.
		// Every corner clear of the canvas's 40px edge-scroll band: at a 0.4 half, a 1024px window's
		// 340px canvas put two of them 34px in, and the pause between clicks panned the camera away.
		const corners = square(0.3, 0.5, 0.5);
		await reference.tool('Trace clearance').click();
		for (const [fx, fy] of corners.slice(0, 2)) await reference.clickAt(await reference.canvasPoint(fx, fy));
		await reference.setSwitch(false);
		for (const [fx, fy] of [...corners.slice(2), ...corners.slice(0, 1)]) {
			await browser.pause(300);
			await reference.clickAt(await reference.canvasPoint(fx, fy));
		}
		await expect.poll(clearance).not.toEqual(later);
		await expect.poll(reference.switchOn).toBe(true);
		expect((await reference.probe()).clearanceVisible).toBe(true);
	});
});
