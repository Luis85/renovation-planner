import { describe, expect } from 'vitest';
import { test } from './fixture';
import { ACTIVE_DESIGNER, createDesignerPage } from './designer';
import { createCanvasPage, newDesign } from './designerCanvas';
import { createFollowupsPage } from './designerFollowups';
import { contrastOf, createParityPage } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, NON_TEXT_CONTRAST, paints, TEXT_CONTRAST, type Paint } from './legibility';
import { FIXTURE_PNG } from './recovery';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, three "readable" and "legible" clauses a person judged by
 * eye: step 7's scale bar, step 57's preset card at thumbnail size and step 70's dimension numbers.
 * **Every case here is a GUARD under ruling AD18-R30, not a discharge**: each measures a published
 * floor or a relation the clause cannot be met without — WCAG 2.x contrast, a font size against the
 * host's own, a stroke that keeps its width — and each docblock names the half of the clause that stays a person's judgement. Desktop
 * only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

/**
 * Where the fixture's scale bar is, in `editor-background-png-test.png`'s own pixels, from
 * `scripts/background-fixture.mjs`: a 10 px `INK` line at y 1870 from x 400 to x 1400 of the
 * 3000 × 2000 sheet. `COLUMNS` sit halfway between the sheet's 100 px minor grid lines, so the
 * paper sample 30 px above the bar (`PAPER_Y`, clear of the `1000 mm` label, seven 64 px
 * characters from x 400) is bare paper, and none is the 1000 px major line.
 */
const SHEET = { width: 3000, height: 2000 };
const BAR = { y: 1870, half: 5 };
const PAPER_Y = 1840;
const COLUMNS = [750, 850, 950];

/**
 * How thick the bar must be DRAWN, in CSS px, before its colour is read: a 3 × 3 device-pixel
 * patch (`drawnSheet`'s sample) then sits inside the ink even at a device pixel ratio of 1, where
 * the bar is 6 device px (12 at this machine's 2), so the reading is the bar's paint and not the resampler's blend of ink and paper.
 */
const MEASURABLE_BAR_PX = 6;

/** A computed colour string for `contrastOf`, from a 0–255 RGBA sample. */
const rgbaOf = ([r = 0, g = 0, b = 0, a = 255]: number[]): string => `rgba(${r}, ${g}, ${b}, ${a / 255})`;

/** The smaller of a stroke's two contrasts: against what is outside it, and against its own fill. */
const strokeContrast = (paint: Paint): number =>
	Math.min(contrastOf(paint).ratio, paint.fill.startsWith('rgb') ? contrastOf({ ...paint, backgrounds: [paint.fill, ...paint.backgrounds] }).ratio : Number.POSITIVE_INFINITY);

/** One label's text as step 70's guard grades it. */
const report = (paint: Paint) => ({ name: paint.name, ratio: contrastOf(paint).ratio, box: paint.backgrounds[0] ?? '', size: paint.fontSize });

describe('Design an Asset, legibility guards in the real Obsidian host', () => {
	/*
	 * Step 7, "with its 1000mm scale bar readable". GUARD (AD18-R30). The floor is WCAG 2.x SC
	 * 1.4.11's 3:1 for a graphic someone must see: the bar's drawn ink against the paper beside it,
	 * each read from the background LAYER's own pixels — so at the opacity the layer is drawn with,
	 * which Konva multiplies into every pixel's alpha — and composited over the canvas's own
	 * backgrounds, which is what shows through a translucent layer. The fixture's `INK` on `PAPER`
	 * is about 13:1 at full opacity, so the floor catches a sheet washed out by the layer, not the
	 * fixture's own colours.
	 *
	 * Read at a camera where the bar is `MEASURABLE_BAR_PX` thick, reached with the toolbar's own
	 * zoom after centring the bar: at the opening camera the bar is drawn about a pixel thick (the
	 * evidence file's `opening`), and a sample of it is the resampler's blend of ink and paper. WHAT STAYS HUMAN: whether a person reads "1000 mm" off the sheet
	 * at the camera the designer opens on, where the label is drawn a few pixels tall — a size this
	 * guard deliberately does not grade — and whether the bar reads as a scale bar at all.
	 * BLIND SPOTS, because the reading is the layer canvas's backing store: a fade applied by CSS
	 * `opacity` or `filter` on that canvas or an ancestor moves no stored pixel, so it is invisible
	 * here (`under` reads background colours, not opacity); and anything drawn ABOVE the background
	 * — a later Konva layer, or the canvas grid the DOM draws over the stage — is not composited.
	 */
	desktop('draws the reference sheet\'s scale bar at 3:1 or more against its paper, at the layer\'s own opacity', async ({
		native: { browser, page, ui, directory },
	}) => {
		const { designer, canvas, assetId } = await newDesign(browser, page, ui, 'Scaled hob');
		await designer.chooseBackground(FIXTURE_PNG);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);

		const at = (x: number, y: number): [number, number] => [x / SHEET.width, y / SHEET.height];
		const read = () => canvas.drawnSheet([at(900, BAR.y), at(COLUMNS[1] ?? 0, BAR.y - BAR.half), at(COLUMNS[1] ?? 0, BAR.y + BAR.half)]);
		await expect.poll(async () => (await read())?.samples.every((sample) => sample.inside) ?? false).toBe(true);
		// The bar's middle to the stage's middle, so the toolbar's zoom (about the stage centre) keeps it on screen.
		const box = await canvas.canvasBox();
		const [middle, top, bottom] = (await read())?.samples ?? [];
		if (!middle || !top || !bottom) throw new Error('No drawn sheet.');
		const opening = bottom.screen.y - top.screen.y;
		await canvas.pan(box.left + box.width / 2 - middle.screen.x, box.top + box.height / 2 - middle.screen.y);
		let thickness = 0;
		for (let press = 0; press < 20 && thickness < MEASURABLE_BAR_PX; press += 1) {
			await canvas.zoomBy('zoom-in');
			const [, upper, lower] = (await read())?.samples ?? [];
			thickness = (lower?.screen.y ?? 0) - (upper?.screen.y ?? 0);
		}
		expect(thickness, 'the bar drawn thick enough to sample').toBeGreaterThanOrEqual(MEASURABLE_BAR_PX);

		const sheet = await canvas.drawnSheet(COLUMNS.flatMap((x) => [at(x, BAR.y), at(x, PAPER_Y)]));
		if (!sheet) throw new Error('The sheet went away after it was drawn.');
		const under = await browser.execute((root) => {
			const layer = document.querySelector(`${root} .rp-plan-canvas canvas`);
			const chain: string[] = [];
			for (let el = layer?.parentElement ?? null; el; el = el.parentElement) chain.push(getComputedStyle(el).backgroundColor);
			return chain;
		}, ACTIVE_DESIGNER);
		const shown = (rgba: number[]): string => `rgb(${contrastOf({ stroke: rgbaOf(rgba), opacity: 1, backgrounds: under }).stroke.join(', ')})`;
		const ratios = COLUMNS.map((_, column) => {
			const [bar, paper] = [sheet.samples[column * 2], sheet.samples[column * 2 + 1]];
			if (!bar?.inside || !paper?.inside) throw new Error(`Column ${String(column)} is off the canvas.`);
			return contrastOf({ stroke: shown(bar.rgba), opacity: 1, backgrounds: [shown(paper.rgba)] }).ratio;
		});
		await writeEvidence(directory, 'scale-bar-contrast', { opening, thickness, under, samples: sheet.samples, ratios });
		expect(Math.min(...ratios), `scale bar against paper, per column ${JSON.stringify(ratios)}`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
	});

	/*
	 * Step 57, "legible at thumbnail size". GUARD (AD18-R30). Every line of every preset card in
	 * the gallery — the vanity's among them — keeps WCAG 2.x SC 1.4.11's 3:1 against what it is
	 * drawn on (the card's surround and, for a filled outline, its own fill: a stroke straddles its
	 * edge), in both of Obsidian's themes; and its rendered width does not shrink with the
	 * thumbnail's scale. That width is DERIVED rather than photographed: SVG draws a stroke at its
	 * computed `stroke-width` times the element's screen scale unless `vector-effect` is
	 * `non-scaling-stroke`, and both inputs are read from the page — the scale being below 1 is
	 * asserted first, since without it no stroke could shrink and the relation would hold vacuously.
	 * The width half has NO LOWER BOUND: a non-scaling stroke declared at 0.2 px passes, since it is
	 * drawn at what it declares; the absolute width stays with the human judgement below (and with
	 * Task 6's pixel captures). WHAT STAYS HUMAN: whether a person can make out the cabinet, the
	 * basin and the tap hole at 48 px, which depends on the drawing, not on its ink.
	 */
	desktop('draws every preset card\'s lines at 3:1 or more in both themes, at a width the thumbnail\'s scale does not shrink', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Legible vanity');
		await designer.designer().$('.rp-designer-start-preset').click();
		await expect.poll(() => browser.$('.rp-preset-choice[data-preset="vanity"] svg path').isDisplayed()).toBe(true);

		const measured = await inBothThemes(browser, () => paints(browser, '.rp-preset-choice svg path', 'stroke', 'data-preset'));
		const rendered = measured.light.map((paint) => ({
			name: paint.name,
			scale: paint.userScale,
			declared: paint.strokeWidth,
			drawn: paint.vectorEffect === 'non-scaling-stroke' ? paint.strokeWidth : paint.strokeWidth * paint.userScale,
		}));
		const contrast = { light: measured.light.map(strokeContrast), dark: measured.dark.map(strokeContrast) };
		await writeEvidence(directory, 'preset-card-legibility', { measured, rendered, contrast });

		expect(measured.light.map((paint) => paint.name)).toContain('vanity');
		expect(rendered.filter((line) => !(line.scale < 1)), 'every card drawn smaller than its own units').toEqual([]);
		expect(rendered.filter((line) => line.drawn < line.declared), 'lines the thumbnail\'s scale thins').toEqual([]);
		expect.soft(Math.min(...contrast.light), 'light theme').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
		expect.soft(Math.min(...contrast.dark), 'dark theme').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
	});

	/*
	 * Step 70, "whether every number is readable". GUARD (AD18-R30). Each of the 26 labels the
	 * clickability walk (`assetDesignerInput.e2e.ts`) finds, at the same leaf width and camera:
	 * its text at WCAG 2.x SC 1.4.3's 4.5:1 against what is drawn under it — the label's own box,
	 * asserted opaque first, since that is what makes the box the thing under the text — in both
	 * themes; and its computed font size no smaller than the host's `--font-ui-smaller`, resolved in
	 * the same run on `document.body`, so a plugin-scoped redefinition of that variable around the
	 * labels would lower the label and never the floor. WHAT STAYS HUMAN: whether a number stays readable
	 * where labels overlap (the case counts 15 pairs, left overlapping by design), which is crowding
	 * rather than ink.
	 */
	desktop('draws every All dimensions number at 4.5:1 or more in both themes, no smaller than the host\'s smallest UI text', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const followups = createFollowupsPage(browser, designer);
		await designer.createAsset('Readable vanity');
		await designer.applyPreset('vanity');
		await createParityPage(browser, designer).setLeafWidth(680);
		await createCanvasPage(browser, designer).zoomBy('zoom-fit');
		await followups.allDimensions(true);
		await expect.poll(async () => (await followups.dimensionNames()).length).toBe(26);

		const labels = `${ACTIVE_DESIGNER} [data-rp-dimension]`;
		const measured = await inBothThemes(browser, () => paints(browser, labels, 'color', 'data-rp-dimension'));
		const floor = await browser.execute(() => {
			const probe = document.createElement('span');
			probe.style.fontSize = 'var(--font-ui-smaller)';
			document.body.append(probe);
			const size = Number.parseFloat(getComputedStyle(probe).fontSize);
			probe.remove();
			return size;
		});
		const light = measured.light.map(report);
		const dark = measured.dark.map(report);
		await writeEvidence(directory, 'dimension-legibility', { floor, light, dark });

		expect(light).toHaveLength(26);
		expect([...light, ...dark].filter((label) => !label.box.startsWith('rgb(')), 'labels with a see-through box').toEqual([]);
		expect(floor).toBeGreaterThan(0);
		expect(light.filter((label) => label.size < floor), `labels under --font-ui-smaller (${String(floor)} px)`).toEqual([]);
		expect.soft(light.filter((label) => label.ratio < TEXT_CONTRAST), 'light theme').toEqual([]);
		expect.soft(dark.filter((label) => label.ratio < TEXT_CONTRAST), 'dark theme').toEqual([]);
	});
});
