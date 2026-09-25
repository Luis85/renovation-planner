import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, type ObsidianPage } from './designer';
import { centreOf, createCanvasPage, newDesign, overlaps } from './designerCanvas';
import type { PlannerPage } from './helpers';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, "dimensions on canvas" (steps 59 to 71b): the numbers
 * as a real renderer lays them out — where they paint, what a click on one focuses, what Apply
 * and Escape write to the sidecar on disk, whether a draw tool withdraws them, and whether the
 * resting labels share any area at four leaf widths. The designer draws nothing on mobile.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';
const BOWL_FIGURES = ['width', 'depth', 'offset-left', 'offset-right', 'offset-top', 'offset-bottom'].map((figure) => `detail-detail-2-${figure}`);
const OVERALL = ['overall-width', 'overall-depth'];

/** The figure a label measures, as its number: `-2 mm` is -2. */
const valueOf = (text: string): number => Number.parseFloat(text);

/**
 * A toilet with its bowl selected, zoomed in four steps: at this host's default leaf the fitted
 * footprint draws about 120 px across, under the 240 px the resting state needs before it adds a
 * part's figures (AD18-R21), so the part's six numbers are only drawn once the drawing is larger.
 */
async function toiletAtWorkingZoom(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string) {
	const designer = createDesignerPage(browser, page, ui);
	const canvas = createCanvasPage(browser, designer);
	const assetId = await designer.createToilet(name);
	await canvas.zoomBy('zoom-in', 4);
	await expect.poll(async () => (await canvas.labels()).length).toBe(8);
	return { designer, canvas, assetId };
}

/** Whether keyboard focus sits on the element a selector names, inside the active designer. */
const focused = (browser: NativeBrowser, selector: string) =>
	browser.execute((sel) => {
		const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
		return document.activeElement !== null && document.activeElement === leaf?.querySelector(sel);
	}, selector);

describe('Design an Asset, dimensions on canvas in the real Obsidian host', () => {
	// Step 59.
	desktop('draws the overall pair as buttons over double-arrowed lines with extension lines, nothing selected', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createAsset('Resting toilet');
		await designer.applyPreset('toilet');
		await expect.poll(async () => (await canvas.labels()).map((label) => [label.name, label.text])).toEqual([
			['overall-width', '380 mm'],
			['overall-depth', '700 mm'],
		]);
		expect(await designer.designer().$('[data-rp-dimension="overall-width"]').getTagName()).toBe('button');
		const marks = await browser.execute(() =>
			[...document.querySelectorAll('.workspace-leaf.mod-active [data-rp-dimension-line]')].map((group) => {
				const line = group.querySelector<SVGPathElement>('.rp-designer-dimension-lines__line');
				const arrows = group.querySelector<SVGPathElement>('.rp-designer-dimension-lines__arrows');
				return {
					name: group.getAttribute('data-rp-dimension-line'),
					// One dimension line plus an extension line at each end; one closed head at each end.
					strokes: (line?.getAttribute('d') ?? '').split('M').length - 1,
					heads: (arrows?.getAttribute('d') ?? '').split('Z').length - 1,
					drawn: (arrows?.getBBox().width ?? 0) > 0 && (line?.getBBox().width ?? 0) > 0,
				};
			}),
		);
		expect(marks).toEqual(OVERALL.map((name) => ({ name, strokes: 3, heads: 2, drawn: true })));
	});

	// Step 59a.
	desktop('stands the overall pair outside the footprint where there is room, and on its edge where there is not', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createAsset('Outside toilet');
		await designer.applyPreset('toilet');
		await expect.poll(async () => (await canvas.labels()).length).toBe(2);
		const [footprint] = await canvas.shapeBoxes('asset-footprint-outline');
		const width = centreOf((await canvas.label('overall-width')).box);
		const depth = centreOf((await canvas.label('overall-depth')).box);
		expect(width.y).toBeLessThan(footprint.top);
		expect(depth.x).toBeLessThan(footprint.left);

		// No room above: the footprint's top edge brought up under the top ruler's strip.
		const box = await canvas.canvasBox();
		await canvas.pan(0, box.top + 24 - footprint.top);
		const [moved] = await canvas.shapeBoxes('asset-footprint-outline');
		expect(moved.top - box.top).toBeLessThan(30);
		const fallen = centreOf((await canvas.label('overall-width')).box);
		expect(Math.abs(fallen.y - moved.top)).toBeLessThan(4);
	});

	// Steps 60 and 61.
	desktop('adds the selected part’s size and four signed offsets beside the overall pair', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('Measured toilet');
		// A finding, pinned: at this host's default leaf the fitted toilet is too small on screen for
		// the resting state to add a part's figures, so a selection draws the overall pair alone.
		await expect.poll(async () => (await canvas.labels()).map((label) => label.name)).toEqual(OVERALL);
		const [fitted] = await canvas.shapeBoxes('asset-footprint-outline');
		expect(fitted.width).toBeLessThan(240);
		await canvas.zoomBy('zoom-in', 2);
		await browser.pause(300);
		expect((await canvas.labels()).map((label) => label.name)).toEqual(OVERALL);
		await canvas.zoomBy('zoom-in', 2);
		await expect.poll(async () => (await canvas.labels()).map((label) => label.name).toSorted()).toEqual([...BOWL_FIGURES, ...OVERALL].toSorted());
		const labels = await canvas.labels();
		expect(labels.every((label) => /^-?\d+ mm$/.test(label.text))).toBe(true);
		const decorated = await browser.execute(() =>
			[...document.querySelectorAll('.workspace-leaf.mod-active [data-rp-dimension-line]')].map((group) => group.getAttribute('data-rp-dimension-line')),
		);
		expect(decorated.toSorted()).toEqual(labels.map((label) => label.name).toSorted());
		expect(valueOf((await canvas.label('detail-detail-2-width')).text)).toBe(304);
		expect(valueOf((await canvas.label('detail-detail-2-offset-left')).text)).toBe(38);

		// Step 61: pushed past the footprint's left edge, the gap reads negative.
		await designer.focusCanvas();
		for (let press = 0; press < 4; press += 1) await designer.keyPress('ArrowLeft');
		await expect.poll(async () => (await canvas.label('detail-detail-2-offset-left')).text).toBe('-2 mm');
		expect((await canvas.label('detail-detail-2-offset-right')).text).toBe('78 mm');
	});

	// Steps 62 and 66: the field opens focused and selected; Escape writes nothing and hands focus back.
	desktop('opens a number as a focused, selected field and closes it on Escape with focus on its button', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Focused numbers');
		await designer.applyPreset('toilet');
		const revision = designer.readSidecar(assetId).revision;
		await designer.designer().$('[data-rp-dimension="overall-width"]').click();
		const field = designer.designer().$('.rp-designer-dimension__form input[name="overall-width"]');
		await expect.poll(() => field.isDisplayed()).toBe(true);
		expect(await focused(browser, '.rp-designer-dimension__form input[name="overall-width"]')).toBe(true);
		const selection = await browser.execute(() => {
			const input = document.activeElement as HTMLInputElement | null;
			return { value: input?.value, start: input?.selectionStart, end: input?.selectionEnd };
		});
		expect(selection).toEqual({ value: '380', start: 0, end: 3 });

		await browser.keys('Escape');
		await expect.poll(() => field.isExisting()).toBe(false);
		await expect.poll(() => focused(browser, '[data-rp-dimension="overall-width"]')).toBe(true);
		await browser.pause(500);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
	});

	// Steps 63 and 65: the same number is not an edit; a different one is.
	desktop('writes nothing and records no undo for the number already shown, and resizes for a new one', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, canvas, assetId } = await toiletAtWorkingZoom(browser, page, ui, 'Typed toilet');
		await designer.nudgeTo(assetId, designer.readSidecar(assetId).revision + 1);
		const nudged = designer.readSidecar(assetId).revision;
		const apply = async (name: string, text: string): Promise<void> => {
			await designer.designer().$(`[data-rp-dimension="${name}"]`).click();
			const field = designer.designer().$(`.rp-designer-dimension__form input[name="${name}"]`);
			await expect.poll(() => field.isDisplayed()).toBe(true);
			await field.setValue(text);
			await designer.designer().$('.rp-designer-dimension__form button[type="submit"]').click();
			await expect.poll(() => field.isExisting()).toBe(false);
		};
		await apply('detail-detail-2-width', '304');
		await browser.pause(500);
		expect(designer.readSidecar(assetId).revision).toBe(nudged);
		// Undo steps over the no-op to the nudge before it.
		await designer.undoButton().click();
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('0');
		expect(designer.readSidecar(assetId).revision).toBe(nudged + 1);

		await apply('detail-detail-2-width', '250');
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(nudged + 2);
		await expect.poll(() => designer.inspectorField('width').getValue()).toBe('250');
		await expect.poll(async () => (await canvas.label('detail-detail-2-width')).text).toBe('250 mm');
		expect(await designer.notices()).toEqual([]);
	});

	// Step 64: accepting a rounded display does not write the rounding back.
	desktop('writes nothing when a field showing a rounded number is applied untouched', async ({ native: { browser, page, ui } }) => {
		const { designer, canvas, assetId } = await newDesign(browser, page, ui, 'Uneven toilet');
		await designer.applyPreset('toilet');
		await designer.editDimensions(381, 700);
		await designer.selectPart('detail:detail-2');
		await canvas.zoomBy('zoom-in', 4);
		await expect.poll(async () => (await canvas.label('detail-detail-2-width')).text).toBe('305 mm');
		const before = designer.readSidecar(assetId);
		const bowl = before.shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points ?? [];
		const xs = bowl.map(([x]) => x);
		expect(Number.isInteger(Math.max(...xs) - Math.min(...xs))).toBe(false);

		await designer.designer().$('[data-rp-dimension="detail-detail-2-width"]').click();
		await expect.poll(() => designer.designer().$('.rp-designer-dimension__form').isDisplayed()).toBe(true);
		await designer.designer().$('.rp-designer-dimension__form button[type="submit"]').click();
		await expect.poll(() => designer.designer().$('.rp-designer-dimension__form').isExisting()).toBe(false);
		await browser.pause(500);
		expect(designer.readSidecar(assetId)).toEqual(before);
	});

	// Step 67.
	desktop('withdraws every number while a draw tool is active and brings them back on Select', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, canvas } = await toiletAtWorkingZoom(browser, page, ui, 'Traced over');
		await canvas.tool('Trace footprint');
		await expect.poll(async () => (await canvas.labels()).length).toBe(0);
		// The Add rail's own tile, the other kind of draw tool.
		await designer.designer().$('button[aria-label="Draw rectangle"]').click();
		await browser.pause(300);
		expect(await canvas.labels()).toEqual([]);
		await canvas.tool('Select');
		await expect.poll(async () => (await canvas.labels()).length).toBeGreaterThan(0);
	});

	// Step 68.
	desktop('changes the numbers while a part is dragged, before it lands', async ({ native: { browser, page, ui } }) => {
		const { designer, canvas } = await toiletAtWorkingZoom(browser, page, ui, 'Dragged toilet');
		const gap = async () => valueOf((await canvas.label('detail-detail-2-offset-left')).text);
		expect(await gap()).toBe(38);
		const [footprint] = await canvas.shapeBoxes('asset-footprint-outline');
		const from = await designer.partCentre('detail-2');
		if (!from) throw new Error('No bowl drawn.');
		const held = await canvas.holdSnapshot(from.x, from.y, 30);
		const during = valueOf(held.labels.find((label) => label.name === 'detail-detail-2-offset-left')?.text ?? '');
		// Thirty screen pixels, in millimetres at this camera, while the pointer is still down.
		const travel = (30 * 380) / footprint.width;
		expect(Math.abs(during - 38 - travel)).toBeLessThan(6);
		// And where it landed agrees with the last number the drag showed.
		await expect.poll(gap).toBe(during);
	});

	// Step 69.
	desktop('measures every part under All dimensions and goes back to the selection’s, keeping the selection', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, canvas } = await toiletAtWorkingZoom(browser, page, ui, 'Every toilet');
		const names = async () => (await canvas.labels()).map((label) => label.name);
		await canvas.viewToggle('all-dimensions');
		await expect.poll(names).toEqual(expect.arrayContaining(['detail-detail-1-width', 'detail-detail-2-width', 'clearance-width', ...OVERALL]));
		expect(await designer.inspectorField('detail-name').getValue()).toBe('Bowl');
		await canvas.viewToggle('all-dimensions');
		await expect.poll(async () => (await names()).toSorted()).toEqual([...BOWL_FIGURES, ...OVERALL].toSorted());
		expect(await designer.inspectorField('detail-name').getValue()).toBe('Bowl');
	});

	// Step 71.
	desktop('draws no number over a footprint traced before any scale existed', async ({ native: { browser, page, ui } }) => {
		const { designer, canvas, assetId } = await newDesign(browser, page, ui, 'Unscaled trace');
		await designer.chooseBackground(FIXTURE_PNG);
		await canvas.trace('Trace footprint', [[0.35, 0.35], [0.65, 0.35], [0.65, 0.65], [0.35, 0.65]]);
		await expect.poll(() => designer.readSidecar(assetId).shape?.footprint.points.length).toBe(4);
		await canvas.tool('Select');
		await canvas.clickCanvas(0.5, 0.5);
		await browser.pause(500);
		expect(await canvas.labels()).toEqual([]);
		expect(await designer.designer().$('.rp-designer-dimension__form').isExisting()).toBe(false);
		await canvas.viewToggle('all-dimensions');
		expect(await canvas.labels()).toEqual([]);
	});

	// Step 71a.
	desktop('keeps every resting label clear of every other at four leaf widths, a detail selected', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('Crowded toilet');
		let most = 0;
		const pairs: string[] = [];
		for (const width of [900, 760, 580, 460]) {
			await canvas.leafWidth(width);
			// At the camera the fit gives this width, then four zoom steps in, where the part's figures draw.
			for (const zoomIn of [0, 4]) {
				await canvas.zoomBy('zoom-fit');
				await canvas.zoomBy('zoom-in', zoomIn);
				await browser.pause(300);
				const labels = await canvas.labels();
				most = Math.max(most, labels.length);
				pairs.push(...labels.flatMap((one, index) => labels.slice(index + 1).filter((other) => overlaps(one.box, other.box)).map((other) => `${width}/${zoomIn}: ${one.name} × ${other.name}`)));
			}
		}
		expect(pairs).toEqual([]);
		// The instrument reached a crowded state, not only the thinned overall pair.
		expect(most).toBe(8);
	});

	// Step 71b.
	desktop('paints a resting label that lands on the canvas key above it, where a click still reaches it', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createAsset('Keyed toilet');
		await designer.applyPreset('toilet');
		await expect.poll(async () => (await canvas.labels()).length).toBe(2);
		const keyBox = await browser.execute(() => document.querySelector('.workspace-leaf.mod-active .rp-designer-key')?.getBoundingClientRect().toJSON() as { left: number; top: number; width: number; height: number } | undefined);
		if (!keyBox) throw new Error('No canvas key.');
		const start = centreOf((await canvas.label('overall-depth')).box);
		const target = centreOf(keyBox);
		await canvas.pan(target.x - start.x, target.y - start.y);
		const label = (await canvas.label('overall-depth')).box;
		expect(overlaps(label, keyBox)).toBe(true);
		const at = centreOf(label);
		const hit = await browser.execute((x, y) => document.elementFromPoint(x, y)?.closest('[data-rp-dimension]')?.getAttribute('data-rp-dimension') ?? null, at.x, at.y);
		expect(hit).toBe('overall-depth');
		await canvas.clickAt(at.x, at.y);
		await expect.poll(() => designer.designer().$('.rp-designer-dimension__form input[name="overall-depth"]').isDisplayed()).toBe(true);
	});
});
