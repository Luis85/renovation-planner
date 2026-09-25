import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { createCanvasPage, newDesign } from './designerCanvas';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md` steps 1 to 52 that `assetDesigner.e2e.ts` leaves: the
 * notice's word and lifetime, the calibration's warning dialog, a typed rectangle, a
 * sidebar-width toolbar, the opening camera, a themed select, gestures chained behind a slow
 * write, a duplicate's offset on disk, the grid over a spec sheet, and an L-shaped footprint
 * resized. The steps that need a Plan Editor are `assetDesignerBasicsPlan.e2e.ts`. Each case
 * names the step it discharges. The designer draws nothing on mobile, so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';
const SQUARE = [[0.35, 0.35], [0.65, 0.35], [0.65, 0.65], [0.35, 0.65]] as const;
const TANK = 'detail:detail-1';

/** A footprint's bounding box, from the sidecar's points. */
const box = (points: number[][]) => {
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
};
/** Every corner as a fraction of that box: the outline's shape with its size taken out. */
const normalised = (points: number[][]) => {
	const b = box(points);
	return points.map(([x, y]) => [Number(((x - b.x) / b.width).toFixed(2)), Number(((y - b.y) / b.depth).toFixed(2))]);
};

/**
 * A slow vault, as a synced one is: every `.rpgeo` write waits `ms` before it reaches the disk.
 * `AssetGeometryStore` writes through `app.vault.modify`, so the delay sits on the host's own door.
 */
const slowSidecarWrites = (browser: NativeBrowser, ms: number) =>
	browser.executeObsidian(({ app }, delay) => {
		const vault = app.vault as unknown as { modify(file: { path: string }, data: string, options?: unknown): Promise<void> };
		const original = vault.modify.bind(vault);
		vault.modify = async (file, data, options) => {
			if (file.path.endsWith('.rpgeo')) await new Promise((resolve) => { setTimeout(resolve, delay); });
			return original(file, data, options);
		};
	}, ms);

/** The selected bowl's bottom-right resize handle, as a viewport point. */
async function bowlCorner(canvas: ReturnType<typeof createCanvasPage>): Promise<{ x: number; y: number }> {
	await expect.poll(async () => (await canvas.shapeBoxes('asset-selection-handle')).length).toBeGreaterThan(3);
	const handles = await canvas.shapeBoxes('asset-selection-handle');
	const corner = handles.toSorted((one, other) => other.left + other.top - (one.left + one.top))[0];
	return { x: Math.round(corner.left + corner.width / 2), y: Math.round(corner.top + corner.height / 2) };
}

/** A toilet with its bowl selected, on a vault whose sidecar writes each wait `ms`. */
async function slowToilet(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string, ms: number) {
	const designer = createDesignerPage(browser, page, ui);
	const assetId = await designer.createToilet(name);
	const revision = designer.readSidecar(assetId).revision;
	const corner = await bowlCorner(createCanvasPage(browser, designer));
	const body = await designer.partCentre('detail-2');
	if (!body) throw new Error('No bowl drawn.');
	await slowSidecarWrites(browser, ms);
	return { designer, assetId, revision, corner, body: { x: Math.round(body.x), y: Math.round(body.y) } };
}

/** The first gesture: the bowl's corner handle dragged 40 right and 30 down, in one chain. */
const resizeFrom = (browser: NativeBrowser, corner: { x: number; y: number }) =>
	browser.action('pointer').move({ ...corner, origin: 'viewport' }).down().move({ x: corner.x + 40, y: corner.y + 30, duration: 150, origin: 'viewport' }).up().perform();

/** A new asset over the PNG sheet, calibrated to 1000 mm, the calibration on disk. */
async function calibratedSheet(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string) {
	const made = await newDesign(browser, page, ui, name);
	await made.designer.chooseBackground(FIXTURE_PNG);
	await made.designer.calibrate(1000);
	await expect.poll(() => made.designer.readSidecar(made.assetId).calibration).not.toBeNull();
	return made;
}

describe('Design an Asset, first sightings in the real Obsidian host', () => {
	// Step 1's other half: the severity word, and the notice leaving on its own.
	desktop('prefixes the empty-catalogue notice with Information and clears it after about six seconds', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await ui.command('open-asset-designer');
		const notice = () => browser.$('.notice-container .rp-notice');
		await expect.poll(() => notice().isExisting()).toBe(true);
		const shown = Date.now();
		expect(await notice().$('.rp-notice-severity').getProperty('textContent')).toBe('Information');
		expect(await designer.notices()).toContain('This vault has no assets yet.');
		await expect.poll(() => notice().isExisting(), { timeout: 12_000 }).toBe(false);
		const gone = Date.now() - shown;
		expect(gone).toBeGreaterThan(4500);
		expect(gone).toBeLessThan(9000);
	});

	// Step 15: a pending footprint makes the calibration ask first, with a destructive confirm.
	desktop('asks before rescaling a pending trace, with a destructive-styled rightmost button', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, canvas, assetId } = await newDesign(browser, page, ui, 'Traced cooker');
		await designer.chooseBackground(FIXTURE_PNG);
		await canvas.trace('Trace footprint', SQUARE);
		await expect.poll(() => designer.readSidecar(assetId).shape?.footprint.points.length).toBe(4);
		const revision = designer.readSidecar(assetId).revision;

		await canvas.tool('Calibrate');
		await canvas.clickCanvas(0.3, 0.5);
		await browser.pause(400);
		await canvas.clickCanvas(0.7, 0.5);
		const dialog = () => browser.$('.rp-dialog');
		await expect.poll(() => dialog().isDisplayed()).toBe(true);
		// A confirmation, not the distance form: no field to type a length into yet.
		expect(await dialog().$('input').isExisting()).toBe(false);
		expect(await dialog().$('.rp-dialog-title').getText()).toBe('Rescale what was traced without a scale?');
		const buttons = await browser.execute(() =>
			[...document.querySelectorAll('.rp-dialog .rp-dialog-actions button')].map((button) => {
				const style = getComputedStyle(button);
				return { action: button.getAttribute('data-rp-action'), x: button.getBoundingClientRect().left, background: style.backgroundColor };
			}),
		);
		const error = await browser.execute(() => {
			const probe = document.body.createDiv();
			probe.style.backgroundColor = 'var(--background-modifier-error)';
			const colour = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return colour;
		});
		const rightmost = buttons.toSorted((one, other) => other.x - one.x)[0];
		expect(rightmost.action).toBe('confirm');
		expect(rightmost.background).toBe(error);
		expect(buttons.find((button) => button.action === 'cancel')?.background).not.toBe(error);
		await dialog().$('[data-rp-action="cancel"]').click();
		await expect.poll(() => dialog().isExisting()).toBe(false);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
	});

	// Step 21's first half: a typed Width and Depth is a drawn, measured rectangle with no trace.
	desktop('draws a typed width and depth as a measured rectangle before anything is traced', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await ui.openProjectView();
		await ui.projectView().$('.rp-view-aside__create-asset').click();
		await expect.poll(() => ui.dialog().isDisplayed()).toBe(true);
		await ui.dialog().$('[data-field="name"]').setValue('Typed cabinet');
		await ui.dialog().$('[data-field="width"]').setValue('600');
		await ui.dialog().$('[data-field="depth"]').setValue('400');
		await browser.pause(250);
		await ui.dialog().$('button[type="submit"]').click();
		await expect.poll(() => designer.designer().isDisplayed()).toBe(true);
		const assetId = await designer.openAssetId();

		await expect.poll(() => canvas.shapeBoxes('asset-footprint-outline')).toHaveLength(1);
		const [outline] = await canvas.shapeBoxes('asset-footprint-outline');
		expect(outline.width).toBeGreaterThan(50);
		expect(outline.width / outline.height).toBeCloseTo(600 / 400, 1);
		const points = designer.readSidecar(assetId).shape?.footprint.points ?? [];
		const xs = points.map(([x]) => x);
		const ys = points.map(([, y]) => y);
		expect([Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]).toEqual([600, 400]);
		await expect.poll(async () => (await canvas.labels()).map((label) => label.text)).toEqual(['600 mm', '400 mm']);
		expect(await designer.designer().$('.rp-empty-state__headline').isExisting()).toBe(false);
	});

	// Step 23: the toolbar at a sidebar's width.
	desktop('wraps the icon-only toolbar at a 460 px leaf and keeps Calibrate reachable by name', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('Narrow toilet');
		const toolbar = () =>
			browser.execute(() => {
				const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
				const bar = leaf?.querySelector('.rp-designer-tools');
				const edge = leaf?.getBoundingClientRect().right ?? 0;
				const buttons = [...(bar?.querySelectorAll('button, summary') ?? [])];
				return {
					// Every item the row lays out — the mode buttons, then the history, zoom and View groups.
					rows: new Set([...(bar?.children ?? [])].map((item) => Math.round(item.getBoundingClientRect().top))).size,
					names: buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
					visibleText: [...(bar?.querySelectorAll('.rp-designer-tool-label') ?? [])].map((text) => (text as HTMLElement).offsetWidth),
					overflowing: buttons.filter((button) => button.getBoundingClientRect().right > edge + 0.5).length,
				};
			});
		const wide = await toolbar();
		expect(await canvas.leafWidth(460)).toBeLessThan(462);
		const narrow = await toolbar();
		expect(narrow.rows).toBeGreaterThan(wide.rows);
		expect(narrow.overflowing).toBe(0);
		expect(narrow.visibleText.every((width) => width === 0)).toBe(true);
		expect(narrow.names).toEqual(wide.names);
		expect(narrow.names).toContain('Calibrate');
		const calibrate = designer.designer().$('.rp-designer-tools [aria-label="Calibrate"]');
		expect(await calibrate.isClickable()).toBe(true);
		await calibrate.click();
		await expect.poll(() => calibrate.getAttribute('aria-pressed')).toBe('true');
	});

	// Step 24a: a closed and reopened designer frames the whole symbol, as Fit would.
	desktop('reopens a closed designer framed on the whole symbol rather than at the last camera', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('Framed toilet');
		await designer.closeDesigner();
		await designer.openDesignerFor('Framed toilet');
		await expect.poll(canvas.zoom).toBeGreaterThan(0);
		const framed = await canvas.zoom();
		expect(framed).not.toBe(100);
		for (let press = 0; press < 3; press += 1) await designer.designer().$('[data-rp-view="zoom-in"]').click();
		await expect.poll(canvas.zoom).toBeGreaterThan(framed);

		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		await designer.openDesignerFor('Framed toilet');
		await expect.poll(canvas.zoom).toBe(framed);
		await designer.designer().$('[data-rp-view="zoom-fit"]').click();
		await browser.pause(300);
		expect(await canvas.zoom()).toBe(framed);
	});

	// Step 29d: the Line dropdown in the designer's own field chrome.
	desktop("draws the Line dropdown in the same host chrome as the Inspector's text field", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createToilet('Styled toilet');
		const inspector = designer.designer().$('.rp-designer-inspector');
		await inspector.$('summary*=Appearance').click();
		await expect.poll(() => inspector.$('select[name="detail-line"]').isDisplayed()).toBe(true);
		const chrome = await browser.execute(() => {
			const root = document.querySelector('.workspace-leaf.mod-active .rp-designer-inspector');
			const pick = (selector: string) => {
				const element = root?.querySelector(selector);
				if (!element) return null;
				const style = getComputedStyle(element);
				return {
					height: element.getBoundingClientRect().height,
					border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
					radius: style.borderTopLeftRadius,
					background: style.backgroundColor,
					colour: style.color,
				};
			};
			return { select: pick('select[name="detail-line"]'), input: pick('input[name="detail-name"]') };
		});
		expect(chrome.select).toEqual(chrome.input);
		expect(chrome.select?.height).toBeGreaterThan(19);
	});

	// Step 32a: a second drag and an arrow key arriving while a resize's write is in flight are held
	// and replayed. The vault is slowed so both land inside that window every run, not by luck.
	desktop('lands a second drag and an arrow key begun during a resize write on top of it, with no save error', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, assetId, revision, corner, body: { x, y } } = await slowToilet(browser, page, ui, 'Chained toilet', 1500);
		await designer.focusCanvas();
		await resizeFrom(browser, corner);
		await browser.action('pointer').move({ x, y, origin: 'viewport' }).down().move({ x: x + 30, y, duration: 150, origin: 'viewport' }).up().perform();
		await designer.keyPress('ArrowRight');
		const headers: string[] = [await designer.header()];

		await expect.poll(async () => {
			headers.push(await designer.header());
			return designer.readSidecar(assetId).revision;
		}, { timeout: 15_000 }).toBe(revision + 3);
		const width = Number(await designer.inspectorField('width').getValue());
		expect(width).toBeGreaterThan(304);
		// The resize moves the centre by half its growth; the drag and the nudge move it further right.
		expect(Number(await designer.inspectorField('centre-x').getValue())).toBeGreaterThan((width - 304) / 2 + 10 + 20);
		expect(headers.filter((text) => text.includes('Save error'))).toEqual([]);
		expect(await designer.notices()).toEqual([]);
	});

	// Step 32b: on a slow vault, a drag held behind the first one's write shows nothing until it lands.
	desktop('shows no preview of a drag held behind a slow write, then jumps to it once the write lands', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, assetId, revision, corner, body: { x, y } } = await slowToilet(browser, page, ui, 'Slow toilet', 2500);
		// The bowl's drawn left edge and width, read by the page itself: twice while the first write is
		// pending, once after it has landed with the pointer still held still.
		await browser.execute(() => {
			const konva = (window as unknown as { Konva: { stages: { find(s: string): { id(): string; getClientRect(): { x: number; width: number } }[] }[] } }).Konva;
			const store = window as unknown as { rpBowl: (number[] | null)[] };
			store.rpBowl = [];
			for (const at of [700, 1700, 4200]) {
				setTimeout(() => {
					const bowl = konva.stages.flatMap((stage) => stage.find('.asset-detail')).find((shape) => shape.id() === 'detail-2');
					store.rpBowl.push(bowl ? [Math.round(bowl.getClientRect().x), Math.round(bowl.getClientRect().width)] : null);
				}, at);
			}
		});
		await resizeFrom(browser, corner);
		// Held still across the landing (about 2.9 s in), then moved 10 px more before the release.
		await browser.action('pointer').move({ x, y, origin: 'viewport' }).down().move({ x: x + 50, y, duration: 150, origin: 'viewport' }).pause(4500).move({ x: x + 60, y, duration: 100, origin: 'viewport' }).pause(800).up().perform();
		const [early, later, landed] = await browser.execute(() => (window as unknown as { rpBowl: (number[] | null)[] }).rpBowl);
		// Still pending: the second drag's 50 px is nowhere on screen, and nothing moves between reads.
		expect(later).toEqual(early);
		// Landed, pointer still held: the bowl jumps to the held drag's position at the resized width.
		expect((landed?.[0] ?? 0) - (later?.[0] ?? 0)).toBeGreaterThan(35);
		expect(landed?.[1]).toBe(later?.[1]);
		await expect.poll(() => designer.readSidecar(assetId).revision, { timeout: 15_000 }).toBe(revision + 2);
		expect(await designer.notices()).toEqual([]);
	});

	// Step 34's other half: where the copy sits, on disk.
	desktop('duplicates the tank 100 mm right and down, one place above it in the drawing order', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Copied toilet');
		await designer.applyPreset('toilet');
		await designer.selectPart(TANK);
		const before = designer.readSidecar(assetId).shape?.details ?? [];
		const index = before.findIndex((detail) => detail.id === 'detail-1');
		await designer.designer().$('.rp-designer-inspector button[name="duplicate"]').click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(before.length + 1);
		const after = designer.readSidecar(assetId).shape?.details ?? [];
		expect(after[index].id).toBe('detail-1');
		const copy = after[index + 1];
		expect(copy.id).not.toBe('detail-1');
		expect(copy.name).toBe(before[index].name);
		expect(copy.outline.points).toEqual(before[index].outline.points.map(([px, py]) => [px + 100, py + 100]));
	});

	// Step 51: the grid paints over a calibrated spec sheet, not under it.
	desktop('paints the shown grid above the calibrated spec sheet', async ({ native: { browser, page, ui } }) => {
		const { designer, canvas } = await calibratedSheet(browser, page, ui, 'Gridded hob');
		await canvas.viewToggle('grid');
		const topmost = await browser.execute(() => {
			const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
			const grid = leaf?.querySelector<HTMLElement>('.rp-canvas-grid');
			const stage = leaf?.querySelector('.konvajs-content canvas');
			if (!grid || !stage) return 'missing';
			// The grid takes no press, so hit-testing skips it; lending it one for this single read
			// asks the renderer which of the two paints on top, and changes nothing about the order.
			grid.style.pointerEvents = 'auto';
			const area = stage.getBoundingClientRect();
			const hit = document.elementFromPoint(area.left + area.width * 0.5, area.top + area.height * 0.5);
			grid.style.pointerEvents = '';
			return hit === grid ? 'grid' : (hit?.className ?? 'nothing');
		});
		expect(topmost).toBe('grid');
		await expect.poll(() => designer.designer().$('.rp-designer-grid-step').getText()).toMatch(/^Grid \d+ mm$/);
	});

	// Step 52: Edit dimensions scales a traced L rather than replacing it with a rectangle.
	desktop('keeps an L-shaped footprint’s six corners and its notch through Edit dimensions', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, canvas, assetId } = await calibratedSheet(browser, page, ui, 'Corner unit');
		await canvas.trace('Trace footprint', [[0.3, 0.3], [0.7, 0.3], [0.7, 0.5], [0.5, 0.5], [0.5, 0.7], [0.3, 0.7]]);
		await expect.poll(() => designer.readSidecar(assetId).shape?.footprint.points.length).toBe(6);
		const traced = designer.readSidecar(assetId).shape?.footprint.points ?? [];
		const width = Math.round(box(traced).width * 2);
		const depth = Math.round(box(traced).depth);
		await designer.editDimensions(width, depth);
		await expect.poll(() => Math.round(box(designer.readSidecar(assetId).shape?.footprint.points ?? []).width)).toBe(width);
		const resized = designer.readSidecar(assetId).shape?.footprint.points ?? [];
		expect(resized).toHaveLength(6);
		expect(Math.round(box(resized).depth)).toBe(depth);
		expect(normalised(resized)).toEqual(normalised(traced));
	});
});
