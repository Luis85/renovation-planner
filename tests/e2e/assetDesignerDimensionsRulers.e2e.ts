import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { createCanvasPage, type Box } from './designerCanvas';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, "the canvas rulers and the vanity preset" (steps 53 to
 * 58): the rulers' first sighting in a real vault, read as numbers against the footprint Konva
 * draws, through a real pan, the zoom cluster and a held drag; and the vanity preset's card and
 * default size. The designer draws nothing on mobile, so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The toilet preset's footprint: 380 mm across, as its Dimensions line reads. */
const TOILET_WIDTH_MM = 380;
const STEPS = [1, 5, 10, 50, 100, 500, 1000, 5000];

interface Rulers {
	step: number;
	/** The strip's thickness, and the tick pitch the strip's gradient repeats at, in px. */
	thickness: number;
	tick: number;
	top: { mm: number; x: number }[];
	canvas: Box;
	strips: Box[];
	position: string;
}

/** The active designer's rulers as drawn: every labelled mark at the screen x its style places it. */
const readRulers = (browser: NativeBrowser): Promise<Rulers | null> =>
	browser.execute(() => {
		const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
		const rulers = leaf?.querySelector('.rp-designer-rulers');
		const top = rulers?.querySelector<HTMLElement>('.rp-designer-ruler--top');
		const canvas = leaf?.querySelector('.rp-plan-canvas');
		if (!rulers || !top || !canvas) return null;
		const origin = top.getBoundingClientRect().left;
		return {
			step: Number(/(\d+) mm/.exec(rulers.getAttribute('aria-label') ?? '')?.[1]),
			thickness: top.getBoundingClientRect().height,
			tick: Number.parseFloat(top.style.backgroundSize),
			top: [...top.querySelectorAll<HTMLElement>('.rp-designer-ruler__label')].map((label) => ({ mm: Number(label.textContent), x: origin + Number.parseFloat(label.style.left) })),
			canvas: canvas.getBoundingClientRect().toJSON() as Box,
			strips: [...rulers.querySelectorAll('.rp-designer-ruler')].map((strip) => strip.getBoundingClientRect().toJSON() as Box),
			position: getComputedStyle(rulers).position,
		};
	});

describe('Design an Asset, the canvas rulers and the vanity preset in the real Obsidian host', () => {
	// Step 53.
	desktop('draws a ticked, numbered ruler along the top and left edges, inside the canvas', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Ruled toilet');
		await designer.applyPreset('toilet');
		await expect.poll(() => readRulers(browser)).not.toBeNull();
		const rulers = await readRulers(browser);
		if (!rulers) throw new Error('No rulers.');
		expect(rulers.strips).toHaveLength(2);
		const [left, top] = rulers.strips;
		expect(top.width).toBeGreaterThan(top.height);
		expect(left.height).toBeGreaterThan(left.width);
		expect(rulers.top.length).toBeGreaterThan(1);
		expect(rulers.top.every((label) => Number.isFinite(label.mm))).toBe(true);
		expect(rulers.tick).toBeGreaterThanOrEqual(12);
		// Inside the canvas area, laid over it rather than laid out beside it.
		expect(rulers.position).toBe('absolute');
		for (const strip of rulers.strips) {
			expect(strip.left).toBeGreaterThanOrEqual(rulers.canvas.left - 0.5);
			expect(strip.top).toBeGreaterThanOrEqual(rulers.canvas.top - 0.5);
			expect(strip.left + strip.width).toBeLessThanOrEqual(rulers.canvas.left + rulers.canvas.width + 0.5);
			expect(strip.top + strip.height).toBeLessThanOrEqual(rulers.canvas.top + rulers.canvas.height + 0.5);
		}
	});

	// Step 54.
	desktop('reads the millimetres under the marks through a pan and both zoom directions, in the step series', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createAsset('Panned toilet');
		await designer.applyPreset('toilet');
		/** Every label against the footprint Konva draws: 0 at its left edge, 380 at its right. */
		const measure = async (): Promise<Rulers> => {
			const rulers = await readRulers(browser);
			const [footprint] = await canvas.shapeBoxes('asset-footprint-outline');
			if (!rulers || !footprint) throw new Error('No rulers or no footprint.');
			const pxPerMm = footprint.width / TOILET_WIDTH_MM;
			for (const label of rulers.top) expect(Math.abs(footprint.left + label.mm * pxPerMm - label.x)).toBeLessThan(3);
			expect(STEPS).toContain(rulers.step);
			const pitch = rulers.top.slice(1).map((label, index) => label.x - rulers.top[index].x);
			for (const gap of pitch) {
				expect(gap).toBeGreaterThanOrEqual(59);
				expect(gap).toBeLessThan(300);
			}
			return rulers;
		};
		const fitted = await measure();
		await canvas.pan(-120, 80);
		const panned = await measure();
		expect(panned.top.map((label) => label.mm)).not.toEqual(fitted.top.map((label) => label.mm));
		await canvas.zoomBy('zoom-out', 5);
		const out = await measure();
		expect(out.step).toBeGreaterThan(fitted.step);
		await canvas.zoomBy('zoom-in', 12);
		const inward = await measure();
		expect(inward.step).toBeLessThan(fitted.step);
		// The ticks keep their size on screen: the strip is as thick, and no pitch drops under 12 px.
		expect(new Set([fitted, panned, out, inward].map((rulers) => rulers.thickness)).size).toBe(1);
		for (const rulers of [fitted, panned, out, inward]) expect(rulers.tick).toBeGreaterThanOrEqual(12);
	});

	// Step 55.
	desktop("moves the selection's extent band on the ruler live with the drag, before it lands", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('Banded toilet');
		const band = () =>
			browser.execute(() => {
				const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
				const extent = leaf?.querySelector<HTMLElement>('.rp-designer-ruler--top .rp-designer-ruler__extent');
				return extent ? extent.getBoundingClientRect().left : null;
			});
		await expect.poll(band).not.toBeNull();
		const before = (await band()) ?? 0;
		const from = await designer.partCentre('detail-2');
		if (!from) throw new Error('No bowl drawn.');
		const assetId = await designer.openAssetId();
		const revision = designer.readSidecar(assetId).revision;
		const held = await canvas.holdSnapshot(from.x, from.y, 60);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision + 1);
		expect((held.band ?? 0) - before).toBeGreaterThan(50);
		// Arriving where the part lands: the committed band sits where the held one did.
		await expect.poll(async () => Math.abs(((await band()) ?? 0) - (held.band ?? 0))).toBeLessThan(3);
	});

	// Steps 57 and 58: the vanity's card, and its default size.
	desktop('offers the vanity under Bathroom with a wireframe card and lands it at 800 × 450, taking 1000 × 500 too', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Bathroom vanity');
		await designer.designer().$('.rp-designer-start-preset').click();
		const card = browser.$('.rp-preset-gallery[aria-label="Bathroom"] .rp-preset-choice[data-preset="vanity"]');
		await expect.poll(() => card.isDisplayed()).toBe(true);
		const [vanity, washbasin] = await browser.execute(() =>
			['vanity', 'washbasin'].map((id) =>
				[...document.querySelectorAll(`.rp-preset-choice[data-preset="${id}"] svg path`)].map((path) => ({
					d: path.getAttribute('d'),
					dashed: path.classList.contains('rp-asset-preset-preview__detail--dashed'),
					drawn: (path as SVGPathElement).getBBox().width > 0,
				})),
			),
		);
		const picture = { vanity, washbasin };
		// The outline, then a dashed carcass, a basin and a tap hole — each drawn at a size.
		expect(picture.vanity).toHaveLength(4);
		expect(picture.vanity.map((path) => path.dashed)).toEqual([false, true, false, false]);
		expect(picture.vanity.every((path) => path.drawn)).toBe(true);
		expect(picture.vanity.map((path) => path.d)).not.toEqual(picture.washbasin.map((path) => path.d));

		await card.click();
		await designer.submitDialog(() => Promise.resolve());
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(3);
		await designer.designer().$('.rp-designer-edit-dimensions').click();
		const form = browser.$('.rp-dialog .rp-dialog-form');
		await expect.poll(() => form.isDisplayed()).toBe(true);
		expect([await form.$('input[name="width"]').getValue(), await form.$('input[name="depth"]').getValue()]).toEqual(['800', '450']);
		await browser.$('.rp-dialog [data-rp-action="cancel"]').click();
		await expect.poll(() => browser.$('.rp-dialog').isExisting()).toBe(false);

		await designer.editDimensions(1000, 500);
		const box = () => {
			const points = designer.readSidecar(assetId).shape?.footprint.points ?? [];
			const xs = points.map(([x]) => x);
			const ys = points.map(([, y]) => y);
			return [Math.round(Math.max(...xs) - Math.min(...xs)), Math.round(Math.max(...ys) - Math.min(...ys))];
		};
		await expect.poll(box).toEqual([1000, 500]);
		expect(await designer.notices()).toEqual([]);
	});
});
