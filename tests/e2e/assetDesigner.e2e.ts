import { existsSync } from 'node:fs';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, DESIGNER } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the steps whose `Reachable by` is `obsidian` and that
 * a driven host can settle: a real notice, a real FuzzySuggestModal, Obsidian's own pdf.js, a
 * plugin reload with the console read back, and the keyboard chords a jsdom test cannot hand
 * to the host. Each case names the manual step it discharges.
 *
 * The designer draws nothing on mobile (`AssetDesignerView.sync`), so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';
const FIXTURE_PDF = 'editor-background-pdf-test.pdf';

describe('Design an Asset, in the real Obsidian host', () => {
	// Step 1.
	desktop('refuses to open the designer picker over an empty catalogue, with a real notice', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await ui.command('open-asset-designer');
		await expect.poll(designer.notices).toContain('This vault has no assets yet.');
		expect(await browser.$('.prompt').isExisting()).toBe(false);
		expect(await designer.leafStates(DESIGNER)).toEqual([]);
	});

	// Step 3.
	desktop('opens the designer on the asset the New asset form just created', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Kitchen tap');
		expect(await designer.designer().$('.rp-designer-asset-name').getText()).toBe('Kitchen tap');
		await expect.poll(() => ui.notesOfType('renovation-asset')).toEqual({
			'Renovation/Library/Assets/Kitchen tap.md': expect.objectContaining({ id: assetId, name: 'Kitchen tap' }),
		});
		// No shape yet, so no sidecar yet — the first geometry write is what creates it.
		expect(existsSync(designer.sidecarPath(assetId))).toBe(false);
	});

	// Steps 7 and 8, and Calibrate a sheet step 1.
	desktop('lists every image and PDF in a real picker, draws the chosen sheet and writes the sidecar', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Traced hob');
		const listed = await designer.chooseBackground(FIXTURE_PNG);
		expect(listed).toEqual(expect.arrayContaining([FIXTURE_PNG, FIXTURE_PDF]));
		await expect.poll(() => existsSync(designer.sidecarPath(assetId))).toBe(true);
		expect(designer.readSidecar(assetId)).toMatchObject({ assetId, schemaVersion: 4, revision: 1 });
		// The background nag gives way to the next empty state, not to none (step 6's precedence).
		await expect.poll(() => designer.designer().$('.rp-empty-state__headline').getText()).toBe('No footprint yet');
		await designer.referenceTab();
		expect(await designer.referenceRow('Sheet').getText()).toBe(FIXTURE_PNG);
		expect(await designer.referenceRow('Scale').getText()).toBe('Not calibrated');
		expect(await designer.notices()).toEqual([]);
	});

	// Step 21, and Calibrate a sheet step 3: the one thing no fake stands in for.
	desktop("renders a PDF page through Obsidian's own pdf.js and names the page in the Sheet row", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Catalogue oven');
		await designer.chooseBackground(FIXTURE_PDF);
		await designer.referenceTab();
		await expect.poll(() => designer.referenceRow('Sheet').getText()).toBe(`${FIXTURE_PDF}, page 1`);
		// The raster the page became, on the stage, with a size — not a failure notice.
		await expect
			.poll(() =>
				browser.execute(() => {
					const konva = (window as unknown as { Konva: { stages: { find(sel: string): { width(): number; height(): number }[] }[] } }).Konva;
					return konva.stages.flatMap((stage) => stage.find('Image').map((image) => image.width() * image.height()));
				}),
			)
			.toSatisfy((areas: number[]) => areas.some((area) => area > 0));
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
		expect(await designer.notices()).toEqual([]);
	});

	// Steps 24 and 25: persistence in the sidecar, and what a plugin unload leaves behind.
	desktop('keeps every shape across a plugin reload, which detaches the leaf and leaves the console clean', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Reloaded toilet');
		await designer.nudgeTo(assetId, 2);
		const bowl = designer.readSidecar(assetId).shape?.details.find((detail) => detail.name === 'bowl');

		await page.disablePlugin('renovation-planner');
		await page.enablePlugin('renovation-planner');
		// A finding, pinned: Obsidian detaches a disabled plugin's leaves and re-enabling restores
		// none of them — the manual case's "reopen both asset designers" is a reopen, not a return.
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);

		await designer.openDesignerFor('Reloaded toilet');
		expect(await designer.openAssetId()).toBe(assetId);
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');
		expect(designer.readSidecar(assetId).shape?.details.find((detail) => detail.name === 'bowl')).toEqual(bowl);
		const messages = await designer.consoleMessages();
		expect(messages.filter((message) => message.includes('Several Konva instances'))).toEqual([]);
		expect(messages.filter((message) => /duplicate.*view|already registered/i.test(message))).toEqual([]);
	});

	// Steps 114, 115 and 119: the history chords, which only a host can hand to the root.
	desktop('undoes with Ctrl+Z, redoes with Ctrl+Y, and declines both while a dialog is open', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Chorded toilet');
		await designer.nudgeTo(assetId, 2);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');

		await browser.keys(['Control', 'z']);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('0');
		await browser.keys(['Control', 'y']);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(4);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');

		await designer.designer().$('.rp-designer-edit-dimensions').click();
		await expect.poll(() => browser.$('.rp-dialog').isDisplayed()).toBe(true);
		await browser.keys(['Control', 'z']);
		await browser.pause(500);
		expect(await browser.$('.rp-dialog').isDisplayed()).toBe(true);
		expect(designer.readSidecar(assetId).revision).toBe(4);
		await browser.$('.rp-dialog [data-rp-action="cancel"]').click();
	});

	// Steps 34 and 35: where keyboard focus lands after the Inspector's own Duplicate and Delete.
	desktop("keeps keyboard focus in the Inspector after its Duplicate and Delete buttons", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Focused toilet');
		await designer.applyPreset('toilet');
		await designer.selectPart('detail:detail-1');
		const focusedRegion = () =>
			browser.execute(() => document.activeElement?.closest('.rp-designer-inspector, .rp-designer-parts, .rp-plan-canvas')?.className ?? String(document.activeElement?.tagName));

		await designer.designer().$('.rp-designer-inspector button[name="duplicate"]').click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(3);
		expect(await designer.inspectorField('detail-name').getValue()).toBe('Tank');
		expect(await focusedRegion()).toContain('rp-designer-inspector');

		await designer.designer().$('.rp-designer-inspector button[name="delete"]').click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(2);
		expect(await designer.designer().$('.rp-designer-selection').isExisting()).toBe(false);
		expect(await focusedRegion()).toContain('rp-designer-inspector');
	});
});
