import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, type DesignerPage, type ObsidianPage } from './designer';
import { createFollowupsPage, type ScreenBox } from './designerFollowups';
import { mobileEmulation, type NativeBrowser } from './session';
import type { createPlannerPage } from './helpers';

/**
 * `docs/tests/cases/Design an Asset.md`, where a size LANDS: a curved clearance's handle drag
 * (AD18-R23, steps 110–113), a preset outline at the sizes that used to be refused (AD18-R24 Task 1,
 * steps 122–123), and the typed doors that warn when a shape cannot reach the number typed while a
 * drag never does (Task 2, steps 124–129). Desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

const REFUSED = 'This outline is not a shape this plugin can store.';
const landed = (width: number, depth: number) => `The typed size is out of reach for this shape. It now measures ${String(width)} × ${String(depth)} mm.`;
/** How long a notice that should NOT appear is given to appear anyway. */
const SETTLE_MS = 800;
const BASIN = 'detail:detail-2';

type Followups = ReturnType<typeof createFollowupsPage>;
interface Native {
	browser: NativeBrowser;
	page: ObsidianPage;
	ui: ReturnType<typeof createPlannerPage>;
}

/** A fresh asset with a preset applied and the Select tool active, and the pages that drive it. */
async function presetAsset({ browser, page, ui }: Native, name: string, preset: string) {
	const designer = createDesignerPage(browser, page, ui);
	const f = createFollowupsPage(browser, designer);
	const assetId = await designer.createAsset(name);
	await designer.applyPreset(preset);
	await f.tool('Select');
	return { browser, designer, f, assetId };
}

/** The selected part's curve-aware box on screen, from its left-middle and right-middle handles. */
async function sides(f: Followups): Promise<{ left: ScreenBox; right: ScreenBox }> {
	return { left: await f.handle(7), right: await f.handle(3) };
}

/** The Inspector's Size pair for the selection, to the nearest millimetre. */
async function expectSize(f: Followups, width: number, depth: number): Promise<void> {
	await expect.poll(async () => Math.round(await f.fieldNumber('width'))).toBe(width);
	expect(Math.round(await f.fieldNumber('depth'))).toBe(depth);
}

/** No notice, given time to arrive. */
async function expectQuiet(browser: NativeBrowser, designer: DesignerPage): Promise<void> {
	await browser.pause(SETTLE_MS);
	expect(await designer.notices()).toEqual([]);
}

/** Shift+1 on the canvas: the design framed again at the canvas it now has. */
async function refit(browser: NativeBrowser, designer: DesignerPage): Promise<void> {
	await designer.focusCanvas();
	await browser.keys(['Shift', '1']);
	await browser.pause(300);
}

/** Dismiss every notice shown — a click is Obsidian's own dismissal — so the next assertion reads only what follows. */
async function noticesCleared(browser: NativeBrowser, designer: DesignerPage): Promise<void> {
	await browser.execute(() => {
		for (const notice of document.querySelectorAll<HTMLElement>('.notice-container .notice')) notice.click();
	});
	await expect.poll(designer.notices).toEqual([]);
}

/**
 * One press-travel-release on a handle, with a dimension label's text read from INSIDE the page
 * while the button is still down — WebDriver runs nothing between an action chain's steps.
 */
async function holdAndRead(browser: NativeBrowser, from: ScreenBox, to: { x: number; y: number }, label: string): Promise<string> {
	await browser.execute((name) => {
		(window as unknown as { rpLive: string | null }).rpLive = null;
		setTimeout(() => {
			(window as unknown as { rpLive: string | null }).rpLive =
				document.querySelector(`.workspace-leaf.mod-active [data-rp-dimension="${name}"]`)?.textContent?.trim() ?? null;
		}, 900);
	}, label);
	await browser
		.action('pointer')
		.move({ x: Math.round(from.x), y: Math.round(from.y), origin: 'viewport' })
		.down()
		.move({ x: Math.round(to.x), y: Math.round(to.y), duration: 300, origin: 'viewport' })
		.pause(1200)
		.up()
		.perform();
	const live = await browser.execute(() => (window as unknown as { rpLive: string | null }).rpLive);
	if (live === null) throw new Error(`No ${label} figure was drawn during the drag.`);
	return live;
}

const millimetres = (text: string) => Number(text.replace(/\D/g, ''));

describe('Design an Asset, where a size lands, in the real Obsidian host', () => {
	// Steps 110 and 111: a curved clearance's side handle, dragged inward, on two presets.
	for (const [preset, step] of [['oval-table', 110], ['round-table', 111]] as const) {
		desktop(`keeps the opposite side of a ${preset} clearance still while the dragged side follows the pointer (step ${String(step)})`, async ({ native }) => {
			const { designer, f, assetId } = await presetAsset(native, `Cleared ${preset}`, preset);
			await designer.selectPart('clearance');
			const before = await sides(f);
			const to = await f.dragHandle(assetId, 3, -Math.round((before.right.x - before.left.x) * 0.08));
			await native.browser.pause(300);
			const after = await sides(f);
			expect(Math.abs(after.left.x - before.left.x)).toBeLessThan(0.1);
			expect(Math.abs(after.right.x - to.x)).toBeLessThan(1.5);
			expect(await designer.notices()).toEqual([]);
		});
	}

	// Steps 112 and 113: past the oval clearance's limit, and the figure that limit reads.
	desktop('holds a far-dragged oval clearance at its nearest reachable size and reads that size back', async ({ native }) => {
		const { browser, designer, f, assetId } = await presetAsset(native, 'Far oval', 'oval-table');
		// A leaf wide enough that the footprint draws over 240 px, so the resting clearance figures are
		// not thinned away (step 108) and the handles stay clear of labels (step 109a).
		await f.setWindowSize(1400, 900);
		await refit(browser, designer);
		await designer.selectPart('clearance');
		await browser.pause(300);
		const start = await sides(f);
		const centre = (start.left.x + start.right.x) / 2;
		const perMm = (start.right.x - start.left.x) / 3000;
		const reach = async () => ((await f.handle(3)).x - centre) / perMm;

		// Step 112: 300 mm from the centre, then 100 mm, each from the preset as applied.
		const revision = designer.readSidecar(assetId).revision;
		// A beat before the press: pressed as soon as the handles were read, this drag wrote NOTHING in two
		// whole-suite runs (the handle read where it was drawn, and the press hit the canvas); with the
		// beat it has written in every run since. Cause not settled — a ponytail: poll for a settled
		// selection layer instead of sleeping, if this reddens again.
		await browser.pause(500);
		const live = await holdAndRead(browser, start.right, { x: centre + 300 * perMm, y: start.right.y }, 'clearance-width');
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision + 1);
		const first = await reach();
		// Step 113: the figure the drag showed, the figure at rest, and the box on screen agree.
		const resting = await f.dimension('clearance-width').getText();
		expect(resting).toBe(live);
		const measured = ((await f.handle(3)).x - (await f.handle(7)).x) / perMm;
		expect(Math.abs(measured - millimetres(resting))).toBeLessThan(1);
		// Step 112's second half: further in, from the preset as applied, lands no further out.
		await designer.undoButton().click();
		await expect.poll(async () => Math.abs((await f.handle(3)).x - start.right.x)).toBeLessThan(0.5);
		await f.dragHandle(assetId, 3, Math.round(centre + 100 * perMm - start.right.x));
		const second = await reach();
		console.log(`steps 112-113: stopped at ${first.toFixed(2)} and ${second.toFixed(2)} mm from the centre; figure ${resting}`);
		// Step 113's other door: typing the number the drag stopped at lands the same box, and quietly.
		const revision2 = designer.readSidecar(assetId).revision;
		await f.typeFigure('clearance-width', millimetres(await f.dimension('clearance-width').getText()));
		await expectQuiet(browser, designer);
		expect(Math.abs((await reach()) - second)).toBeLessThan(1);
		expect(designer.readSidecar(assetId).revision).toBeLessThanOrEqual(revision2 + 1);
		expect(first).toBeGreaterThan(300 + 50);
		expect(Math.abs(first - 700)).toBeLessThan(60);
		expect(second).toBeLessThanOrEqual(first + 0.5);
		expect(Math.abs(second - first)).toBeLessThan(1);
	});

	// Step 122.
	desktop('sets a Tree preset to 2987 × 2987 with no refusal', async ({ native }) => {
		const { browser, designer, f, assetId } = await presetAsset(native, 'Odd tree', 'tree');
		const revision = designer.readSidecar(assetId).revision;
		await designer.editDimensions(2987, 2987);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision + 1);
		await designer.selectPart('footprint');
		await expectSize(f, 2987, 2987);
		await expectQuiet(browser, designer);
	});

	// Step 123.
	desktop('rotates a 4500 × 4500 Tree canopy at several angles with no refusal', async ({ native }) => {
		const { browser, designer, f, assetId } = await presetAsset(native, 'Big tree', 'tree');
		await designer.editDimensions(4500, 4500);
		// Framed again, so the rotate handle above the larger canopy is on the canvas.
		await refit(browser, designer);
		await designer.selectPart('footprint');
		await expectSize(f, 4500, 4500);
		const outcomes: { degrees: number; wrote: boolean; notices: string[] }[] = [];
		for (const degrees of [17, 43, 71, 122, 199, 263]) {
			const revision = designer.readSidecar(assetId).revision;
			const rotate = (await f.nodes('rotation-handle-button'))[0];
			const [left, right] = [await f.handle(7), await f.handle(3)];
			const centre = { x: (left.x + right.x) / 2, y: left.y };
			// Half the way out: the bearing from the centre sets the angle, and a release this close in
			// stays on the canvas whichever way it points.
			const radius = (centre.y - rotate.y) / 2;
			const angle = (degrees * Math.PI) / 180;
			await f.dragPoint(rotate, { x: centre.x + radius * Math.sin(angle), y: centre.y - radius * Math.cos(angle) });
			await browser.pause(SETTLE_MS);
			outcomes.push({ degrees, wrote: designer.readSidecar(assetId).revision === revision + 1, notices: await designer.notices() });
		}
		expect(outcomes).toEqual([17, 43, 71, 122, 199, 263].map((degrees) => ({ degrees, wrote: true, notices: [] })));
		expect(await designer.notices()).not.toContain(REFUSED);
	});

	// Steps 124 and 125: the Inspector door and the canvas-label door, the same landing and warning.
	desktop('lands a typed 191 on the Vanity basin at 270 × 270 and says so, from the Inspector and from the canvas', async ({ native }) => {
		const { browser, designer, f } = await presetAsset(native, 'Typed vanity', 'vanity');
		await designer.selectPart(BASIN);
		await f.typeField('width', 191);
		await expect.poll(designer.notices).toContain(landed(270, 270));
		await expectSize(f, 270, 270);

		await designer.undoButton().click();
		await expectSize(f, 360, 270);
		await noticesCleared(browser, designer);
		await f.allDimensions(true);
		// A finding, pinned: the basin's Width figure sits UNDER the clearance's top offset, which takes
		// a press aimed at it, at the default 1023 x 800 window and at 1400 x 900 alike — so the figure
		// is opened from the KEYBOARD, the one way still left to it.
		const covering = () =>
			browser.execute(() => {
				const box = document.querySelector('.workspace-leaf.mod-active [data-rp-dimension="detail-detail-2-width"]')?.getBoundingClientRect();
				return box ? (document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) as HTMLElement | null)?.dataset.rpDimension : 'none';
			});
		expect(await covering()).toBe('clearance-offset-top');
		await f.setWindowSize(1400, 900);
		await refit(browser, designer);
		expect(await covering()).toBe('clearance-offset-top');
		await f.typeFigure('detail-detail-2-width', 191, 'keyboard');
		await expect.poll(designer.notices).toEqual([landed(270, 270)]);
		await expectSize(f, 270, 270);
	});

	// Step 126.
	desktop('lands a Round table set to 1 × 1000 at about 207 × 1000 and names that size', async ({ native }) => {
		const { designer, f } = await presetAsset(native, 'Thin table', 'round-table');
		await designer.editDimensions(1, 1000);
		await expect.poll(designer.notices).toContain(landed(207, 1000));
		await designer.selectPart('footprint');
		await expectSize(f, 207, 1000);
	});

	// Step 127.
	desktop("lands the toilet's typed overall Width at exactly 50 and warns about nothing though its Depth moves", async ({ native }) => {
		const { browser, designer, f } = await presetAsset(native, 'Narrow toilet', 'toilet');
		await f.allDimensions(true);
		expect(await f.dimension('overall-depth').getText()).toBe('700 mm');
		await f.typeFigure('overall-width', 50);
		await expectQuiet(browser, designer);
		await designer.selectPart('footprint');
		expect(await f.fieldNumber('width')).toBe(50);
		const depth = await f.fieldNumber('depth');
		console.log(`step 127: depth ${String(depth)}`);
		expect(Math.abs(depth - 535)).toBeLessThan(10);
	});

	// Step 128.
	desktop('lands the Vanity basin at its 270 floor on a far handle drag and warns about nothing', async ({ native }) => {
		const { browser, designer, f, assetId } = await presetAsset(native, 'Dragged vanity', 'vanity');
		await designer.selectPart(BASIN);
		expect(Math.round(await f.fieldNumber('width'))).toBe(360);
		const { left, right } = await sides(f);
		const perMm = (right.x - left.x) / 360;
		// To a 150 mm width, far past the floor.
		await f.dragHandle(assetId, 3, -Math.round(210 * perMm));
		await expectSize(f, 270, 270);
		await expectQuiet(browser, designer);
	});

	// Step 129.
	desktop('lands a Round table set to 1500 × 1500 at that size and warns about nothing', async ({ native }) => {
		const { browser, designer, f } = await presetAsset(native, 'Wide table', 'round-table');
		await designer.editDimensions(1500, 1500);
		await designer.selectPart('footprint');
		await expect.poll(async () => Math.abs((await f.fieldNumber('width')) - 1500)).toBeLessThan(0.5);
		expect(Math.abs((await f.fieldNumber('depth')) - 1500)).toBeLessThan(0.5);
		await expectQuiet(browser, designer);
	});
});
