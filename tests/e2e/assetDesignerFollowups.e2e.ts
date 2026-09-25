import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage } from './designer';
import { createFollowupsPage, normalised, outlineOn } from './designerFollowups';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the polish round (AD18-R20/R21): the canvas's focus ring
 * against the rulers, the Add rail's tile rows in two languages, a curved detail's handle drag
 * against its typed size, the resting labels of a small drawing, and the overall label against
 * the handles on a 280 px canvas. The designer draws nothing on mobile, so the file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The vanity preset's basin, the curved detail steps 108 and 109a select. */
const BASIN = 'detail:detail-2';

/** Every Add-rail tile's height, and whether the label of each wraps past one line. */
const tileHeights = (browser: NativeBrowser) =>
	browser.execute(() =>
		[...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .rp-designer-add-shapes > *')].map((tile) => ({
			top: Math.round(tile.getBoundingClientRect().top),
			height: Math.round(tile.getBoundingClientRect().height),
			text: tile.innerText.trim(),
		})),
	);

/** Obsidian's language, switched the way its own settings do: the stored choice, then a reload. */
async function switchLanguage(browser: NativeBrowser, language: string): Promise<void> {
	await browser.execute((lang) => {
		window.localStorage.setItem('language', lang);
		window.location.reload();
	}, language);
	await browser.pause(1500);
	await browser.waitUntil(() => browser.execute(() => Boolean((window as unknown as { wdioObsidianService?: unknown }).wdioObsidianService)), { timeout: 60_000 });
	await browser.executeObsidian(async ({ app }) => {
		await new Promise<void>((resolve) => {
			app.workspace.onLayoutReady(resolve);
		});
	});
}

describe('Design an Asset, the polish round, in the real Obsidian host', () => {
	// Step 105.
	desktop('draws the keyboard focus ring inside all four canvas edges, clear of both rulers', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createToilet('Ringed toilet');
		// Keyboard focus the way a user gives it: a Tab onto the canvas from the control before it.
		await designer.focusCanvas();
		await browser.keys(['Shift', 'Tab']);
		await browser.keys('Tab');
		const ring = await browser.execute(() => {
			const canvas = document.activeElement as HTMLElement;
			const style = getComputedStyle(canvas);
			const box = canvas.getBoundingClientRect();
			const ruler = (side: string) => canvas.querySelector(`.rp-designer-ruler--${side}`)?.getBoundingClientRect();
			const offset = Number.parseFloat(style.outlineOffset);
			const width = Number.parseFloat(style.outlineWidth);
			// An outline's outer edge sits `offset + width` outside the border box.
			const outer = -(offset + width);
			return {
				canvas: canvas.classList.contains('rp-plan-canvas'),
				visible: canvas.matches(':focus-visible'),
				style: style.outlineStyle,
				width,
				ring: { top: box.top + outer, left: box.left + outer, right: box.right - outer, bottom: box.bottom - outer },
				box: { top: box.top, left: box.left, right: box.right, bottom: box.bottom },
				topRuler: ruler('top')?.bottom ?? Number.NaN,
				leftRuler: ruler('left')?.right ?? Number.NaN,
			};
		});
		expect(ring).toMatchObject({ canvas: true, visible: true, style: 'solid', width: 2 });
		// Clear of the opaque strips on the top and left, and inside the box on the other two.
		expect(ring.ring.top).toBeGreaterThanOrEqual(ring.topRuler);
		expect(ring.ring.left).toBeGreaterThanOrEqual(ring.leftRuler);
		expect(ring.ring.right).toBeLessThanOrEqual(ring.box.right);
		expect(ring.ring.bottom).toBeLessThanOrEqual(ring.box.bottom);
		expect(ring.ring.right).toBeGreaterThan(ring.box.right - 30);
		expect(ring.ring.bottom).toBeGreaterThan(ring.box.bottom - 30);
	});

	// Step 105's other door, measured: a POINTER click on the canvas background.
	desktop('shows no focus ring after a pointer click on the canvas background', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createToilet('Clicked toilet');
		const f = createFollowupsPage(browser, designer);
		const box = await f.canvasBox();
		// The bottom-right corner, well inside the canvas and far from the drawing.
		await browser.action('pointer').move({ x: Math.round(box.right - 40), y: Math.round(box.bottom - 40), origin: 'viewport' }).down().up().perform();
		const state = await browser.execute(() => ({
			focused: document.activeElement?.classList.contains('rp-plan-canvas') ?? false,
			visible: document.activeElement?.matches(':focus-visible') ?? false,
		}));
		// A finding, pinned: Chromium's own heuristic gives a pointer focus no :focus-visible.
		expect(state).toEqual({ focused: true, visible: false });
	});

	// Step 106.
	desktop('keeps every Add tile the height of the tallest content, in both rows and in German', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		await designer.createAsset('Tiled asset');
		// A 1280 window: two tiles a row, and "Rounded rectangle" wraps onto a second line.
		await f.setWindowSize(1280, 800);
		const wrapped = await tileHeights(browser);
		expect(new Set(wrapped.map((tile) => tile.top)).size).toBe(2);
		expect(new Set(wrapped.map((tile) => tile.height)).size).toBe(1);
		// A 900 window: the same two rows, every label on one line, so every tile is SHORTER — the
		// height follows the content rather than a floor measured once.
		await f.setWindowSize(900, 700);
		const single = await tileHeights(browser);
		expect(new Set(single.map((tile) => tile.top)).size).toBe(2);
		expect(new Set(single.map((tile) => tile.height)).size).toBe(1);
		expect(single[0].height).toBeLessThan(wrapped[0].height);

		await switchLanguage(browser, 'de');
		await ui.activate('renovation-asset-designer');
		const german = async (width: number, height: number) => {
			await f.setWindowSize(width, height);
			const tiles = await tileHeights(browser);
			expect(tiles.map((tile) => tile.text)).toContain('Abgerundetes Rechteck');
			expect(new Set(tiles.map((tile) => tile.top)).size).toBe(2);
			expect(new Set(tiles.map((tile) => tile.height)).size).toBe(1);
			return tiles[0].height;
		};
		// "Abgerundetes Rechteck" wraps onto a THIRD line at 1280, so the German rows are taller
		// than the English ones there, and back to one line at 900 (measured 89, 73, 58 px).
		expect(await german(1280, 800)).toBeGreaterThan(wrapped[0].height);
		expect(await german(900, 700)).toBe(single[0].height);
	});

	// Step 107.
	desktop("lands a curved detail's handle drag where its typed Width and Depth would", async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		const assetId = await designer.createAsset('Dragged toilet');
		await designer.applyPreset('toilet');
		await f.tool('Select');
		await designer.selectPart(BOWL);
		await f.dragHandle(assetId, 4, 24, 18);
		const dragged = normalised(outlineOn(designer.readSidecar(assetId), BOWL));
		const width = Math.round(await f.fieldNumber('width'));
		const depth = Math.round(await f.fieldNumber('depth'));

		await designer.undoButton().click();
		await expect.poll(() => f.fieldNumber('width')).not.toBe(width);
		await f.typeField('width', width);
		await expect.poll(async () => Math.round(await f.fieldNumber('width'))).toBe(width);
		await f.typeField('depth', depth);
		await expect.poll(async () => Math.round(await f.fieldNumber('depth'))).toBe(depth);
		expect(Math.round(await f.fieldNumber('width'))).toBe(width);
		// The same OUTLINE, not only the same box: a plain stretch of the curve reaches the same box
		// with a different bowl.
		const typed = normalised(outlineOn(designer.readSidecar(assetId), BOWL));
		expect(typed.length).toBe(dragged.length);
		typed.forEach(([x, y], index) => {
			expect(Math.abs(x - dragged[index][0])).toBeLessThan(1);
			expect(Math.abs(y - dragged[index][1])).toBeLessThan(1);
		});
	});
	// Step 108.
	desktop('rests only the overall pair while the footprint draws under 240 px, and every label under All dimensions', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		await designer.createAsset('Small vanity');
		await designer.applyPreset('vanity');
		await f.setWindowSize(1280, 800);
		await f.tool('Select');
		await designer.selectPart(BASIN);
		const across = async (): Promise<number> => (await f.nodes('asset-footprint-outline'))[0].width;
		const zoomUntil = async (label: string, done: (width: number) => boolean): Promise<void> => {
			for (let step = 0; step < 20 && !done(await across()); step += 1) {
				await designer.designer().$(`[aria-label="${label}"]`).click();
				await browser.pause(150);
			}
			expect(done(await across())).toBe(true);
		};
		// A figure's name is its part's key with the colon dropped: `detail-detail-2-width`.
		const detailLabels = async () => (await f.dimensionNames()).filter((name) => name.startsWith('detail-detail-2-'));

		await zoomUntil('Zoom in', (width) => width > 260);
		expect(await detailLabels()).not.toEqual([]);
		await zoomUntil('Zoom out', (width) => width < 220);
		await expect.poll(f.dimensionNames).toEqual(['overall-width', 'overall-depth']);
		await zoomUntil('Zoom in', (width) => width > 260);
		await expect.poll(detailLabels).not.toEqual([]);
		await zoomUntil('Zoom out', (width) => width < 220);
		// A finding, pinned: at a 1280 window the open View menu reaches LEFT past the leaf, and the
		// file explorer is what a pointer reaching for "All dimensions" there lands on.
		await designer.designer().$('.rp-view-menu summary').click();
		const menu = await browser.execute(() => {
			const content = document.querySelector('.workspace-leaf.mod-active .rp-view-menu__content')?.getBoundingClientRect();
			const row = document.querySelector('.workspace-leaf.mod-active input[data-rp-view="all-dimensions"]')?.parentElement?.getBoundingClientRect();
			const leaf = document.querySelector('.workspace-leaf.mod-active')?.getBoundingClientRect();
			const hit = row ? document.elementFromPoint(row.left + 4, row.top + row.height / 2) : null;
			return { menuLeft: content?.left ?? 0, leafLeft: leaf?.left ?? 0, hitsMenu: hit?.closest('.rp-view-menu') !== null };
		});
		expect(menu.menuLeft).toBeLessThan(menu.leafLeft);
		expect(menu.hitsMenu).toBe(false);
		await browser.keys('Escape');
		await f.allDimensions(true);
		await expect.poll(detailLabels).toEqual(expect.arrayContaining(['detail-detail-2-width', 'detail-detail-2-depth', 'detail-detail-2-offset-left']));
	});

	// Step 109a.
	desktop('keeps the overall width label off the top-middle and rotate handles on a 280 px canvas', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		await designer.createAsset('Cramped vanity');
		await designer.applyPreset('vanity');
		// The window is walked until the canvas is about 280 x 300: the rails around it reflow, so no
		// one window size names a canvas size.
		let size = { width: 620, height: 900 };
		for (let step = 0; step < 8; step += 1) {
			await f.setWindowSize(size.width, size.height);
			const canvas = await f.canvasBox();
			if (Math.abs(canvas.width - 280) <= 12 && Math.abs(canvas.height - 300) <= 20) break;
			size = { width: Math.round(size.width + 280 - canvas.width), height: Math.round(size.height + 300 - canvas.height) };
		}
		const canvas = await f.canvasBox();
		expect(Math.abs(canvas.width - 280)).toBeLessThanOrEqual(12);
		expect(Math.abs(canvas.height - 300)).toBeLessThanOrEqual(20);
		// The camera the manual row asks about is the FIT one: Shift+1 frames the design again.
		await designer.focusCanvas();
		await browser.keys(['Shift', '1']);
		await f.tool('Select');
		await designer.selectPart('footprint');
		await browser.pause(300);

		const top = await f.handle(1);
		const rotate = (await f.nodes('rotation-handle-button'))[0];
		const [left, bottomRight] = [await f.handle(0), await f.handle(4)];
		const label = await browser.execute(() => {
			const box = document.querySelector('.workspace-leaf.mod-active [data-rp-dimension="overall-width"]')?.getBoundingClientRect();
			return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height } : null;
		});
		if (!label) throw new Error('No overall width label is drawn.');
		console.log(`step 109a canvas ${JSON.stringify(canvas)} label ${JSON.stringify(label)} top ${JSON.stringify(top)} rotate ${JSON.stringify(rotate)}`);
		const GRAB = 8;
		for (const mark of [top, rotate]) {
			const clear = Math.abs(label.x - mark.x) >= label.width / 2 + GRAB || Math.abs(label.y - mark.y) >= label.height / 2 + GRAB;
			expect(clear).toBe(true);
			expect(label.y).toBeGreaterThan(mark.y);
		}
		// On the drawing: inside the footprint's own box.
		expect(label.x).toBeGreaterThan(left.x);
		expect(label.x).toBeLessThan(bottomRight.x);
		expect(label.y).toBeLessThan(bottomRight.y);
		// Still grabbable: what a press at each handle's centre lands on is not a label.
		const hits = await browser.execute(
			(points) => points.map(({ x, y }) => document.elementFromPoint(x, y)?.closest('.rp-designer-dimension') !== null),
			[top, rotate].map(({ x, y }) => ({ x, y })),
		);
		expect(hits).toEqual([false, false]);
	});
});
