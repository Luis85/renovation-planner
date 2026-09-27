import { describe, expect } from 'vitest';
import { test } from './fixture';
import { ACTIVE_DESIGNER, createDesignerPage } from './designer';
import { centreOf, createCanvasPage, type Box } from './designerCanvas';
import { createParityPage } from './designerParity';
import { retryButton, setSchema, staleAfter, staleNotice } from './recovery';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * Three GEOMETRY GUARDS from `docs/tests/cases/` (ruling AD18-R30): Design an Asset steps 109 and
 * 56 and Recover step 34. Each reads boxes a real renderer laid out and asserts a RELATION between
 * two of them taken in the same run — never a pixel figure from one machine, since CI's Linux fonts
 * and 1024 x 800 window lay the same tree out differently. A guard is not a discharge: each step
 * keeps its human tier, because the part of its clause that is a person's reading ("reads as
 * detached", "enough room", "reads as an action") is not something a box can answer. Each case
 * says which part that is. The designer draws nothing on mobile, so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

/** A horizontal segment on screen: from `x1` to `x2` at height `y`. */
interface Segment { x1: number; x2: number; y: number }

/** How far a box is from a horizontal segment; 0 when the segment touches or crosses it. */
const gap = (box: Box, line: Segment): number =>
	Math.hypot(Math.max(0, line.x1 - (box.left + box.width), box.left - line.x2), Math.max(0, box.top - line.y, line.y - (box.top + box.height)));

/**
 * The overall width's label box and its DRAWN dimension line: the first stroke of the line path,
 * mapped to the screen through the path's own transform.
 */
const overallWidth = (browser: NativeBrowser) =>
	browser.execute((root) => {
		const leaf = document.querySelector(root);
		const label = leaf?.querySelector('[data-rp-dimension="overall-width"]');
		const path = leaf?.querySelector<SVGPathElement>('[data-rp-dimension-line="overall-width"] .rp-designer-dimension-lines__line');
		const matrix = path?.getScreenCTM();
		const [x1, y, x2] = (/^M([\d.-]+) ([\d.-]+)L([\d.-]+) /.exec(path?.getAttribute('d') ?? '') ?? []).slice(1).map(Number);
		if (!label || !matrix || x1 === undefined || y === undefined || x2 === undefined) return null;
		const from = new DOMPoint(x1, y).matrixTransform(matrix);
		const to = new DOMPoint(x2, y).matrixTransform(matrix);
		return { label: label.getBoundingClientRect().toJSON() as Box, line: { x1: Math.min(from.x, to.x), x2: Math.max(from.x, to.x), y: from.y } };
	}, ACTIVE_DESIGNER);

describe('Design an Asset and Recover, geometry guards in the real Obsidian host', () => {
	/**
	 * Step 109, GUARD (AD18-R30). The row: an overall label slides along its OWN line before it is
	 * placed further out, "and that slide can run past the line's own end … the line itself is drawn
	 * on into it", landing "off the drawing". Measured here, at two frames of the toilet with its
	 * footprint selected: the camera the designer fits on opening (the row's frame, at whatever leaf
	 * this host gives), and that footprint panned up under the top ruler as step 59a does — the
	 * frame where the slide ALONG the line is what decides, since the label's anchor row is on the
	 * ruler's strip and only a slide keeps it off the drawing (`overallSlot`'s docblock).
	 *
	 * Two relations, each between two boxes of the same frame:
	 * - **the drawn dimension line meets the label's box** (within a pixel). The brief asked for
	 *   "no farther than the label's own height"; verified at source, `dimensionLine` runs the line
	 *   THROUGH the placed label, so the build claims a distance of zero, and at the panned frame a
	 *   line stopped at its span's end would leave the label about 26 px past it (measured on
	 *   Windows) — under one label height, which the looser bound would pass.
	 * - **the label's centre is not below the footprint's top edge** — the row's "off the drawing",
	 *   and AD18-R14's "never back over the footprint". On the edge is allowed: step 59a pins that
	 *   the pair falls onto its edge where there is no room outside.
	 *
	 * What stays human: whether a label slid past its line's end "reads as detached from the part it
	 * measures". How far past the end it lands is not asserted, because that figure is a font's.
	 */
	desktop('draws the overall width on its own line and off the drawing, at the fitted camera and under the ruler', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createAsset('Measured toilet');
		await designer.applyPreset('toilet');
		await designer.selectPart('footprint');
		const check = async (frame: string) => {
			let drawn: Awaited<ReturnType<typeof overallWidth>> = null;
			await expect.poll(async () => (drawn = await overallWidth(browser))).not.toBeNull();
			if (!drawn) throw new Error('No overall width drawn.');
			const { label, line } = drawn;
			const [footprint] = await canvas.shapeBoxes('asset-footprint-outline');
			console.log(`step 109 ${frame}: label ${JSON.stringify(label)} line ${JSON.stringify(line)} footprint top ${String(footprint.top)}`);
			expect(gap(label, line), `${frame}: the line meets its label`).toBeLessThanOrEqual(1);
			expect(centreOf(label).y, `${frame}: the label is off the drawing`).toBeLessThanOrEqual(footprint.top + 1);
			return { label, footprint };
		};

		await check('fitted');
		const box = await canvas.canvasBox();
		const [fitted] = await canvas.shapeBoxes('asset-footprint-outline');
		await canvas.pan(0, box.top + 24 - fitted.top);
		await designer.selectPart('footprint');
		// The frame is the one meant: the top edge under the ruler's strip, the label on that edge.
		const [panned] = await canvas.shapeBoxes('asset-footprint-outline');
		expect(panned.top - box.top).toBeLessThan(30);
		const { label, footprint } = await check('under the ruler');
		expect(Math.abs(centreOf(label).y - footprint.top)).toBeLessThanOrEqual(1);
	});

	/**
	 * Step 56, GUARD (AD18-R30). The row asks, at a sidebar-width leaf, whether the drawing still has
	 * enough room beside the rulers, and discloses its own frame: "18 px per axis of occlusion … 272 px
	 * of drawing in a 290 px canvas at a 580 px leaf" — about 94 % of each axis left to draw on.
	 * Measured here at that leaf: the room each ruler strip leaves (the canvas's far edge less the
	 * strip's inner edge) keeps at least 90 % of the canvas along each axis. The share is the row's
	 * 94 % less a margin for a narrower canvas on CI's wider fonts; it trips once a strip takes more
	 * than a tenth of an axis — at the row's 290 px canvas, a strip past 29 px, where the row judged 18.
	 *
	 * What stays human: whether that room is "enough" — the row's own words, a judgement it asks a
	 * person to record, with hiding the rulers below 35rem as the recorded remedy if it is not.
	 */
	desktop('leaves at least nine tenths of each canvas axis to the drawing beside the rulers, at a 580 px leaf', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createAsset('Ruled toilet');
		await designer.applyPreset('toilet');
		await parity.setLeafWidth(580);
		await expect.poll(async () => Math.abs((await parity.leafWidth()) - 580)).toBeLessThan(6);
		const boxes = await browser.execute((root) => {
			const leaf = document.querySelector(root);
			const rect = (sel: string) => leaf?.querySelector(sel)?.getBoundingClientRect().toJSON() as Box | undefined;
			return { canvas: rect('.rp-plan-canvas'), top: rect('.rp-designer-ruler--top'), left: rect('.rp-designer-ruler--left') };
		}, ACTIVE_DESIGNER);
		const { canvas, top, left } = boxes;
		if (!canvas || !top || !left) throw new Error(`No canvas or no rulers: ${JSON.stringify(boxes)}.`);
		console.log(`step 56 at ${String(await parity.leafWidth())}: ${JSON.stringify(boxes)}`);
		// The strips are laid over the canvas, not beside it, so the subtraction below is the room.
		expect(left.left).toBeGreaterThanOrEqual(canvas.left - 0.5);
		expect(top.top).toBeGreaterThanOrEqual(canvas.top - 0.5);
		expect((canvas.left + canvas.width - (left.left + left.width)) / canvas.width).toBeGreaterThanOrEqual(0.9);
		expect((canvas.top + canvas.height - (top.top + top.height)) / canvas.height).toBeGreaterThanOrEqual(0.9);
	});

	/**
	 * Recover step 34, GUARD (AD18-R30). The row's defect was MEASURED: the stale notice's Try again
	 * first shipped as wide as the leaf, a bar of chrome under the notice's strip. Asserted here in
	 * the host's own layout, as relations: the button is narrower than half its notice and half its
	 * leaf — a stretched one is as wide as both — and its box sits against the notice's, starting
	 * within its own width of the notice's start and below it by less than its own height.
	 *
	 * What stays human: whether the button "reads as an ACTION belonging to the notice".
	 */
	desktop('keeps the stale notice’s Try again narrower than half its notice and its leaf, set against the notice', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Stale toilet');
		await staleAfter(designer, assetId, setSchema(99));
		const rect = async (element: ReturnType<typeof retryButton>) =>
			browser.execute((el: HTMLElement) => el.getBoundingClientRect().toJSON() as Box, await element.getElement());
		const retry = await rect(retryButton(designer));
		const notice = await rect(staleNotice(designer));
		const leaf = await rect(designer.designer());
		console.log(`step 34: ${JSON.stringify({ retry, notice, leaf })}`);
		expect(retry.width).toBeLessThan(notice.width / 2);
		expect(retry.width).toBeLessThan(leaf.width / 2);
		expect(retry.left - notice.left).toBeGreaterThanOrEqual(0);
		expect(retry.left - notice.left).toBeLessThan(retry.width);
		expect(retry.top - (notice.top + notice.height)).toBeGreaterThanOrEqual(-0.5);
		expect(retry.top - (notice.top + notice.height)).toBeLessThan(retry.height);
	});
});
