import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createClearancePage, square } from './clearance';
import { createDesignerPage, type DesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Calibrate a sheet and reserve space.md`, the rows `assetReference.e2e.ts` left:
 * a PDF sheet named by its page, an outline TRACED over a sheet and never calibrated — its Source &
 * scale block, the pending lines Remove reference must leave standing, the hidden clearance a resize
 * or a calibration brings back — and the Placement point's Custom segment, by mouse and by keyboard.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';
const FIXTURE_PDF = 'editor-background-pdf-test.pdf';
const PENDING = ['The outline is still in reference pixels', 'The clearance is still in reference pixels'];
const PENDING_HINT = 'Calibrate a known length on the sheet to turn these into millimetres.';

type ClearancePage = ReturnType<typeof createClearancePage>;
interface Native { browser: NativeBrowser; page: ObsidianPage; ui: PlannerPage }

/** The three pages a case drives, over one asset made through the real New asset door. */
async function open(native: Native, name: string, start: typeof FIXTURE_PNG | typeof FIXTURE_PDF | 'toilet') {
	const designer = createDesignerPage(native.browser, native.page, native.ui);
	const reference = createClearancePage(native.browser, designer);
	const assetId = await designer.createAsset(name);
	if (start === 'toilet') await designer.applyPreset('toilet');
	else {
		await designer.chooseBackground(start);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);
	}
	return { browser: native.browser, designer, reference, assetId };
}

/** A sheet with an outline and a clearance traced over it, never calibrated: both groups pending. */
async function tracedAsset(native: Native, name: string) {
	const opened = await open(native, name, FIXTURE_PNG);
	const { designer, reference, assetId } = opened;
	await reference.trace('Trace footprint', square(0.05));
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(2);
	await reference.trace('Trace clearance', square(0.1));
	await expect.poll(() => designer.readSidecar(assetId).shape?.clearance).toBeTruthy();
	return opened;
}

/** The first calibration of a pending asset: two points, the rescale confirmation, the known length. */
async function calibratePending(browser: NativeBrowser, designer: DesignerPage, reference: ClearancePage): Promise<void> {
	await reference.tool('Calibrate').click();
	for (const fraction of [0.3, 0.7]) {
		await reference.clickAt(await reference.canvasPoint(fraction, 0.38));
		// Two clicks in one tick read as one.
		await browser.pause(400);
	}
	await reference.confirmDialog();
	await designer.submitDialog(async (form) => {
		await form.$('input[type="number"]').setValue('1000');
	});
}

describe('Calibrate a sheet and reserve space, the rest of it in the real Obsidian host', () => {
	// Step 3: a PDF sheet is named by its file AND its page, and Obsidian's own pdf.js draws it.
	desktop("names a PDF sheet by its file and its page, rendered by Obsidian's own pdf.js", async ({ native }) => {
		const { designer, reference } = await open(native, 'Catalogue basin', FIXTURE_PDF);
		await designer.referenceTab();
		await expect.poll(() => reference.referenceRow('Sheet').getText()).toBe(`${FIXTURE_PDF}, page 1`);
		await expect.poll(async () => (await reference.probe()).backgroundImage?.width ?? 0).toBeGreaterThan(0);
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
	});

	// Steps 38 and 36a: a traced, uncalibrated outline, and what Edit dimensions does to it.
	desktop('reads a traced outline as awaiting a scale, and RETYPES it on Edit dimensions, leaving a hidden pending clearance unscaled and hidden', async ({ native }) => {
		const { browser, designer, reference, assetId } = await tracedAsset(native, 'Traced cistern');

		// Step 38.
		await expect.poll(() => reference.sourceRow('Source').getText()).toBe('Traced on the canvas');
		expect(await reference.sourceRow('Dimensions set').getText()).toBe('Not yet, awaiting a scale');

		// Step 36a, AS MEASURED rather than as the case expects. The row says the resize scales the
		// pending clearance and so re-shows it. What the host does: Edit dimensions on an outline still
		// in sheet pixels REPLACES the footprint with a typed rectangle (`AssetDesignerRoot.editDimensions`'s
		// `unscaled` arm, `setFootprintFromDimensions`) and leaves the clearance exactly where it was,
		// still pending — so its geometry did not change, the read-back has nothing to reveal, and the
		// switch stays off. Pinned so the day either half changes is a red case.
		const before = reference.shapeOnDisk(assetId).clearance;
		const revision = designer.readSidecar(assetId).revision;
		await reference.setSwitch(false);
		expect((await reference.probe()).clearanceVisible).toBe(false);
		await designer.editDimensions(100, 100);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision + 1);
		const after = reference.shapeOnDisk(assetId);
		expect(after.footprint).toEqual({ points: [[-50, -50], [50, -50], [50, 50], [-50, 50]] });
		expect([after.footprintOrigin, after.footprintPending, after.clearancePending]).toEqual(['typed', false, true]);
		expect(after.clearance).toEqual(before);
		expect(after.clearanceNeedsReview).toBe(false);
		await browser.pause(500);
		expect(await reference.switchOn()).toBe(false);
		expect((await reference.probe()).clearanceVisible).toBe(false);
	});

	// Step 12's pending half: taking the sheet away leaves every pending line standing.
	desktop('removes the sheet and leaves every pending line exactly where it was', async ({ native }) => {
		const { designer, reference, assetId } = await tracedAsset(native, 'Unscaled cistern');
		await designer.referenceTab();
		await expect.poll(reference.pendingLines).toEqual(PENDING);
		expect(await designer.designer().$('.rp-designer-reference .rp-designer-field-hint').getText()).toBe(PENDING_HINT);

		await designer.designer().$('button[name="remove-reference"]').click();
		await expect.poll(() => reference.referenceRow('Sheet').getText()).toBe('None chosen');
		expect(await reference.referenceRow('Scale').getText()).toBe('Not calibrated');
		await expect.poll(async () => (await reference.probe()).backgroundImage).toBeNull();
		expect(await reference.pendingLines()).toEqual(PENDING);
		const shape = reference.shapeOnDisk(assetId);
		expect([shape.footprintPending, shape.clearancePending]).toEqual([true, true]);
		expect(designer.readSidecar(assetId).calibration).toBeNull();
	});

	// Steps 36b and 9: the first calibration re-shows a hidden pending clearance, and so does its Undo.
	desktop('shows a hidden pending clearance again when a calibration lands, and again when it is undone', async ({ native }) => {
		const { browser, designer, reference, assetId } = await tracedAsset(native, 'Calibrated cistern');
		const revision = designer.readSidecar(assetId).revision;

		await reference.setSwitch(false);
		await calibratePending(browser, designer, reference);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision + 1);
		await expect.poll(reference.switchOn).toBe(true);
		expect((await reference.probe()).clearanceVisible).toBe(true);

		// Step 9 with something traced: Calibrated, every pending line and the hint gone, the Sheet unchanged.
		await designer.referenceTab();
		await expect.poll(() => reference.referenceRow('Scale').getText()).toBe('Calibrated');
		expect(await reference.referenceRow('Sheet').getText()).toBe(FIXTURE_PNG);
		expect(await reference.pendingLines()).toEqual([]);
		expect(await designer.designer().$('.rp-designer-reference .rp-designer-field-hint').isExisting()).toBe(false);
		// Step 38's other half: still traced, and now measured.
		await reference.objectTab();
		expect(await reference.sourceRow('Source').getText()).toBe('Traced on the canvas');
		expect(await reference.sourceRow('Dimensions set').getText()).toBe('Yes');

		await reference.setSwitch(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(() => designer.readSidecar(assetId).calibration).toBeNull();
		await expect.poll(reference.switchOn).toBe(true);
		expect((await reference.probe()).clearanceVisible).toBe(true);
	});

	// Step 37: a typed object's Source & scale — read-only, and last in the Object tab even under the review notice.
	desktop('reads a typed object as authored in millimetres, with no control, last in the Object tab', async ({ native }) => {
		const { browser, designer, reference, assetId } = await open(native, 'Typed toilet', 'toilet');
		const block = () => designer.designer().$('.rp-designer-source');
		const isLast = async () => browser.execute((el: HTMLElement) => el.parentElement?.lastElementChild === el, await block().getElement());

		await expect.poll(() => reference.sourceRow('Source').getText()).toBe('Authored in millimetres');
		expect(await reference.sourceRow('Dimensions set').getText()).toBe('Yes');
		expect(await block().$$('button, input, select, textarea, [role="button"]').length).toBe(0);
		expect(await isLast()).toBe(true);

		await designer.editDimensions(200, 350);
		await expect.poll(() => designer.readSidecar(assetId).shape?.clearanceNeedsReview).toBe(true);
		await expect.poll(() => designer.designer().$('.rp-designer-clearance [role="status"]').isExisting()).toBe(true);
		expect(await isLast()).toBe(true);
	});

	// Steps 15b, 15a and 15c: Custom hands off to Set anchor — from the keyboard, then with a click.
	desktop('arms Set anchor from Custom by keyboard with no way to place the point, and places it with a click', async ({ native }) => {
		const { browser, designer, reference, assetId } = await open(native, 'Anchored toilet', 'toilet');
		const segment = (name: string) => designer.designer().$(`.rp-designer-placement-modes button[name="placement-${name}"]`);
		const pressed = () => Promise.all(['back-centre', 'centre', 'custom'].map((name) => segment(name).getAttribute('aria-pressed')));
		const revision = () => designer.readSidecar(assetId).revision;
		const activeName = () => browser.execute(() => document.activeElement?.getAttribute('name'));

		// Step 15c: the label is one line, never split into "Custo" / "m".
		const lines = await browser.execute((el: HTMLElement) => {
			const range = document.createRange();
			range.selectNodeContents(el);
			return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
		}, await segment('custom').$('span:last-child').getElement());
		expect(await segment('custom').$('span:last-child').getText()).toBe('Custom');
		expect(lines).toBe(1);

		// Step 15b: Tab to Custom and press it — the tool arms, and no key places the point.
		await browser.execute((el: HTMLElement) => el.focus(), await segment('back-centre').getElement());
		await browser.keys('Tab');
		await browser.keys('Tab');
		expect(await activeName()).toBe('placement-custom');
		await browser.keys(' ');
		await expect.poll(() => reference.toolActive('Set anchor')).toBe(true);
		const armed = revision();
		await designer.focusCanvas();
		for (const key of ['Enter', ' ', 'ArrowRight']) await browser.keys(key);
		await browser.pause(800);
		expect(revision()).toBe(armed);
		// ...and the anchor's own position fields are the keyboard's route to the same result.
		await browser.execute((el: HTMLElement) => el.focus(), await designer.designer().$('.rp-designer-part-row[name="anchor"]').getElement());
		await browser.keys('Enter');
		const x = designer.inspectorField('position-x');
		await expect.poll(() => x.isExisting()).toBe(true);
		await browser.execute((el: HTMLElement) => el.focus(), await x.getElement());
		await browser.keys(['Control', 'a']);
		await browser.keys(['2', '5', 'Enter']);
		await expect.poll(() => reference.shapeOnDisk(assetId).anchor.x).toBe(25);

		// Step 15a: Custom by mouse arms the same tool, and one click places the anchor there.
		await segment('custom').click();
		await expect.poll(() => reference.toolActive('Set anchor')).toBe(true);
		const placed = revision();
		await reference.clickAt(await reference.canvasPoint(0.3, 0.3));
		await expect.poll(revision).toBe(placed + 1);
		expect(reference.shapeOnDisk(assetId).anchor.x).not.toBe(25);
		await expect.poll(pressed).toEqual(['false', 'false', 'true']);
	});
});
