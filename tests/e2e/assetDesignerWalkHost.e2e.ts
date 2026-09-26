import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { createCanvasPage } from './designerCanvas';
import { contrastOf, createParityPage } from './designerParity';
import { writeEvidence } from './diagnostics';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, three `obsidian` clauses the first passes left to a person
 * because each is a fact about what the host DRAWS rather than about what the plugin stores: the
 * reference sheet the right way up (step 7), the sidecar listed in Obsidian's own file explorer
 * (step 8), and the Inspector thumbnail's outline standing out from its background in both of
 * Obsidian's themes (step 87). Desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';

/**
 * Four points of `editor-background-png-test.png` as fractions of its 3000 × 2000 px, from
 * `scripts/background-fixture.mjs`: the centroid of the solid accent triangle near the top-left,
 * (150, 480), and where a horizontal flip, a vertical flip and a half turn would each put it —
 * all three on bare paper, clear of the grid lines, the room outline and the open circle.
 */
const TRIANGLE: [number, number] = [150 / 3000, 480 / 2000];
const MIRRORS: [number, number][] = [
	[2850 / 3000, 480 / 2000],
	[150 / 3000, 1520 / 2000],
	[2850 / 3000, 1520 / 2000],
];

/**
 * How far the accent's red-minus-blue must stand above paper's. The fixture's accent `#b4562a`
 * reads 138 and its paper `#f6f3ec` 10, so a sample that lands on either is far from this line;
 * a patch that straddles the triangle's edge could fall anywhere between, which is why the
 * sample is the centroid and not a corner.
 */
const ACCENT_MARGIN = 60;

/**
 * WCAG 2.x SC 1.4.11 (non-text contrast): 3:1 for a graphical object someone must see. The
 * thumbnail is `aria-hidden` and so outside what that criterion REQUIRES; the figure is borrowed
 * as the one published definition of "clearly visible" for a line against its surround.
 */
const NON_TEXT_CONTRAST = 3;

/** Open Obsidian's own file explorer down to `file`'s folder, as a person clicks it open. */
async function explorerRow(browser: NativeBrowser, file: string) {
	await browser.executeObsidianCommand('file-explorer:open');
	const parts = file.split('/').slice(0, -1);
	for (let depth = 1; depth <= parts.length; depth += 1) {
		const folder = parts.slice(0, depth).join('/');
		const title = browser.$(`.nav-folder-title[data-path="${folder}"]`);
		await title.waitForDisplayed();
		const collapsed = await title.parentElement().getAttribute('class');
		if ((collapsed ?? '').split(' ').includes('is-collapsed')) await title.click();
	}
	return browser.$(`.nav-file-title[data-path="${file}"]`);
}

describe('Design an Asset, what the host draws', () => {
	// Steps 7 and 8.
	desktop('draws the chosen sheet the right way up, and lists its sidecar in the file explorer', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		const assetId = await designer.createAsset('Upright hob');
		await designer.chooseBackground(FIXTURE_PNG);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);

		// Step 7: the accent triangle is drawn where the sheet's own top-left puts it, and none of
		// its three mirror images is — in the layer's pixels, and in the order the SCREEN shows them.
		const read = () => canvas.drawnSheet([TRIANGLE, ...MIRRORS]);
		await expect.poll(async () => (await read())?.samples.every((sample) => sample.inside && (sample.rgba[3] ?? 0) > 0) ?? false).toBe(true);
		const sheet = await read();
		if (!sheet) throw new Error('The sheet went away after it was drawn.');
		await writeEvidence(directory, 'sheet-samples', sheet);
		const [triangle, acrossX, acrossY] = sheet.samples;
		const redness = sheet.samples.map(({ rgba: [r = 0, , b = 0] }) => r - b);
		const [accent = 0, ...mirrors] = redness;
		expect(mirrors.map((mirror) => accent - mirror > ACCENT_MARGIN)).toEqual([true, true, true]);
		// The sheet's left edge is on the screen's left and its top on the screen's top: a camera or
		// stage flip moves the samples along with the pixels, and only this order sees it.
		expect({ left: (triangle?.screen.x ?? 0) < (acrossX?.screen.x ?? 0), above: (triangle?.screen.y ?? 0) < (acrossY?.screen.y ?? 0) }).toEqual({ left: true, above: true });
		// And nothing mirrors the canvas after it is drawn.
		expect(sheet.cssMirrors).toEqual([]);

		// Step 8: Obsidian's own explorer lists the sidecar in the library's Geometry folder.
		const row = await explorerRow(browser, `Renovation/Library/Geometry/${assetId}.rpgeo`);
		await expect.poll(() => row.isDisplayed()).toBe(true);
		// Read as text content: WebDriver's visible-text read answered '' for a displayed row here.
		expect(await row.$('.nav-file-title-content').getProperty('textContent')).toBe(assetId);
		expect(await row.$('.nav-file-tag').getProperty('textContent')).toBe('rpgeo');
	});

	// Step 87.
	desktop("draws the Inspector thumbnail's outline at 3:1 or more against its background, in both themes", async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createAsset('Contrasted toilet');
		await designer.applyPreset('toilet');
		await designer.designer().$('.rp-designer-asset-thumbnail').waitForDisplayed();

		const measured: Record<string, ReturnType<typeof contrastOf>> = {};
		for (const theme of ['moonstone', 'obsidian']) {
			await browser.executeObsidian(({ app }, name) => {
				(app as unknown as { changeTheme(theme: string): void }).changeTheme(name);
			}, theme);
			await expect.poll(() => browser.execute(() => document.body.classList.contains('theme-dark'))).toBe(theme === 'obsidian');
			measured[theme] = contrastOf(await parity.thumbnailColours());
		}
		await writeEvidence(directory, 'thumbnail-contrast', measured);
		// Both themes are measured before either is judged, so one failing never hides the other.
		expect.soft(measured.moonstone?.ratio, 'light theme').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
		expect.soft(measured.obsidian?.ratio, 'dark theme').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
	});
});
