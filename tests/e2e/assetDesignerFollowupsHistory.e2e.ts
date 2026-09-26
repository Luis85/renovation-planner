import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, type DesignerPage } from './designer';
import { createFollowupsPage, outlineOn } from './designerFollowups';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the follow-up round's history chords (AD18-R23 Task 10)
 * that `assetDesigner.e2e.ts` does not already press: Ctrl+Shift+Z, the chord from every focusable
 * region of the leaf, a text field's own native undo, the two controls declined for owning their
 * keys, and a gesture the chord must not unwind. Desktop only, as the designer is.
 */
const desktop = mobileEmulation ? test.skip : test;

/** How long a chord that should do nothing is given to do something anyway. */
const SETTLE_MS = 600;

const chord = (browser: NativeBrowser, ...keys: string[]) => browser.keys(['Control', ...keys]);

/** The toilet fixture with one nudge written (revision 2, the bowl's centre at 10). */
async function nudgedToilet(designer: DesignerPage, name: string): Promise<string> {
	const assetId = await designer.createToilet(name);
	await designer.nudgeTo(assetId, 2);
	await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');
	return assetId;
}

/** A chord that acts: the revision it writes, and where the bowl's centre lands. */
async function chordTo(browser: NativeBrowser, designer: DesignerPage, assetId: string, keys: string[], revision: number, centre: string): Promise<void> {
	await chord(browser, ...keys);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision);
	await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe(centre);
}

/** Type into the Height field WITHOUT committing, and take it back with the chord; answers the field. */
async function typeHeightAndUndo(browser: NativeBrowser, designer: DesignerPage) {
	const height = designer.designer().$('input[name="height"]');
	const before = await height.getValue();
	await height.click();
	await browser.keys(['7', '5', '0']);
	await expect.poll(() => height.getValue()).toBe(`${before}750`);
	await chord(browser, 'z');
	// The browser's own field history took the typing back.
	await expect.poll(() => height.getValue()).toBe(before);
	return height;
}

/** Nothing written and nothing moved: the revision and the bowl's centre as they were. */
async function expectUntouched(browser: NativeBrowser, designer: DesignerPage, assetId: string, revision: number, centre: string): Promise<void> {
	await browser.pause(SETTLE_MS);
	expect(designer.readSidecar(assetId).revision).toBe(revision);
	expect(await designer.inspectorField('centre-x').getValue()).toBe(centre);
}

describe('Design an Asset, the history chords, in the real Obsidian host', () => {
	// Step 115.
	desktop('redoes with Ctrl+Shift+Z, and Ctrl+Y does nothing once the redo history is spent', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await nudgedToilet(designer, 'Redone toilet');
		await chordTo(browser, designer, assetId, ['z'], 3, '0');
		await chordTo(browser, designer, assetId, ['Shift', 'z'], 4, '10');
		await chord(browser, 'y');
		await expectUntouched(browser, designer, assetId, 4, '10');
	});

	// Step 116.
	desktop('undoes with Ctrl+Z from a Parts row and from an Inspector tab, as from the canvas', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await nudgedToilet(designer, 'Everywhere toilet');
		await designer.nudgeTo(assetId, 3);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('20');
		const focused = () => browser.execute(() => document.activeElement?.getAttribute('name') ?? document.activeElement?.getAttribute('data-rp-tab') ?? '');

		await designer.selectPart(BOWL);
		expect(await focused()).toBe(BOWL);
		await chordTo(browser, designer, assetId, ['z'], 4, '10');

		await designer.designer().$('.rp-designer-tab[data-rp-tab="object"]').click();
		expect(await focused()).toBe('object');
		await chordTo(browser, designer, assetId, ['z'], 5, '0');
	});

	// Step 117.
	desktop("leaves Ctrl+Z to the Height field's own native undo while its text is uncommitted", async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await nudgedToilet(designer, 'Tall toilet');
		const note = async () => Object.values(await ui.notesOfType('renovation-asset'))[0];
		const frontmatter = await note();
		const height = await typeHeightAndUndo(browser, designer);
		// ...and nothing else moved.
		expect(await height.isFocused()).toBe(true);
		await expectUntouched(browser, designer, assetId, 2, '10');
		expect(await note()).toEqual(frontmatter);

		// The design's own history is where it was: the nudge is still the next thing to undo. Escape
		// leaves the field the way that commits nothing.
		await browser.keys('Escape');
		await designer.focusCanvas();
		await chordTo(browser, designer, assetId, ['z'], 3, '0');
	});

	// Step 117's other way out of the field, measured: leaving it by moving focus rather than Escape.
	desktop('spends the first canvas Ctrl+Z on nothing visible after the Height field is left by a focus move', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await nudgedToilet(designer, 'Blurred toilet');
		await typeHeightAndUndo(browser, designer);
		await designer.focusCanvas();
		// A finding, pinned: the blur commits the field's (unchanged) text, and the first chord on the
		// canvas afterwards writes nothing and moves nothing; only the SECOND undoes the nudge.
		await chord(browser, 'z');
		await expectUntouched(browser, designer, assetId, 2, '10');
		await chordTo(browser, designer, assetId, ['z'], 3, '0');
	});

	// Step 118, first half.
	desktop('does nothing on Ctrl+Z while the Line dropdown holds focus', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await nudgedToilet(designer, 'Lined toilet');
		await designer.designer().$('//details[.//select[@name="detail-line"]]/summary').click();
		const line = designer.designer().$('select[name="detail-line"]');
		await expect.poll(() => line.isDisplayed()).toBe(true);
		await browser.execute((select: HTMLElement) => {
			select.focus();
		}, await line.getElement());
		await chord(browser, 'z');
		await expectUntouched(browser, designer, assetId, 2, '10');
		expect(await line.getValue()).toBe('solid');
		expect(await line.isFocused()).toBe(true);
		expect(await designer.undoDisabled()).toBe(false);
	});

	// Step 118, second half.
	desktop('does nothing on Ctrl+Z while the Corner radius slider holds focus', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		const assetId = await designer.createAsset('Rounded box');
		await designer.applyPreset('toilet');
		await f.tool('Draw rounded rectangle');
		const canvas = await f.canvasBox();
		const at = { x: canvas.left + canvas.width * 0.35, y: canvas.top + canvas.height * 0.6 };
		await f.dragPoint(at, { x: at.x + 60, y: at.y + 40 });
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(3);
		const drawn = designer.readSidecar(assetId).shape?.details.at(-1)?.id ?? '';
		await f.tool('Select');
		await designer.selectPart(`detail:${drawn}`);
		const slider = designer.designer().$('input[name="corner-radius-slider"]');
		await expect.poll(() => slider.isDisplayed()).toBe(true);
		const revision = designer.readSidecar(assetId).revision;
		const value = await slider.getValue();
		await browser.execute((input: HTMLElement) => {
			input.focus();
		}, await slider.getElement());
		await chord(browser, 'z');
		await browser.pause(SETTLE_MS);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
		expect(designer.readSidecar(assetId).shape?.details.length).toBe(3);
		expect(await slider.getValue()).toBe(value);
		expect(await slider.isFocused()).toBe(true);
	});

	// Step 120: the chord under a held draw gesture, and after it finishes.
	desktop('declines Ctrl+Z while a rectangle is being drawn, and undoes it once the draw is finished', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		const assetId = await nudgedToilet(designer, 'Drawn toilet');
		await f.tool('Draw rectangle');
		const canvas = await f.canvasBox();
		const at = { x: Math.round(canvas.left + canvas.width * 0.35), y: Math.round(canvas.top + canvas.height * 0.6) };
		const end = { x: at.x + 60, y: at.y + 40 };
		const bowl = outlineOn(designer.readSidecar(assetId), BOWL);
		// The chord arrives from INSIDE the page 400 ms into a held draw: WebDriver serialises its own
		// commands, so nothing it sends can land between a press and its release (W23-A). The event
		// goes to the canvas, which holds focus, and bubbles through the root's capture handler.
		await browser.execute(() => {
			setTimeout(() => {
				const target = document.activeElement ?? document.body;
				const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true });
				target.dispatchEvent(event);
				(window as unknown as { rpChord: unknown }).rpChord = { claimed: event.defaultPrevented, on: target.className };
			}, 400);
		});
		await browser
			.action('pointer')
			.move({ ...at, origin: 'viewport' })
			.down()
			.move({ ...end, duration: 150, origin: 'viewport' })
			.pause(1200)
			.up()
			.perform();
		// Claimed and swallowed: nothing undone, and the rectangle the release finished is the one write.
		expect(await browser.execute(() => (window as unknown as { rpChord: unknown }).rpChord)).toEqual({ claimed: true, on: expect.stringContaining('rp-plan-canvas') });
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
		await browser.pause(SETTLE_MS);
		expect(designer.readSidecar(assetId).revision).toBe(3);
		expect(outlineOn(designer.readSidecar(assetId), BOWL)).toEqual(bowl);
		expect(designer.readSidecar(assetId).shape?.details.length).toBe(3);
		await designer.focusCanvas();
		await chord(browser, 'z');
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(4);
		expect(designer.readSidecar(assetId).shape?.details.length).toBe(2);
	});

	// Step 120's click-placed door, measured: one Trace footprint point placed, the press released.
	desktop('undoes the last edit on Ctrl+Z with one trace point placed and the pointer released', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		const assetId = await nudgedToilet(designer, 'Traced toilet');
		await f.tool('Trace footprint');
		const canvas = await f.canvasBox();
		await browser.action('pointer').move({ x: Math.round(canvas.left + canvas.width * 0.3), y: Math.round(canvas.bottom - 60), origin: 'viewport' }).down().up().perform();
		await browser.pause(300);
		// The trace holds a draft: its first point is drawn on the gesture layer.
		const sketched = () =>
			browser.execute(() => {
				const konva = (window as unknown as { Konva: { stages: { findOne(sel: string): { find(sel: string): unknown[] } | undefined; container(): HTMLElement }[] } }).Konva;
				const host = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
				return konva.stages.find((stage) => host?.contains(stage.container()))?.findOne('.asset-gesture')?.find('Shape').length ?? 0;
			});
		expect(await sketched()).toBeGreaterThan(0);
		await chord(browser, 'z');
		// A finding, pinned: the tool manager's gesture flag spans a press, not a draft, so between
		// two clicks of a trace the chord reaches the design's history and undoes the nudge.
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
	});
});
