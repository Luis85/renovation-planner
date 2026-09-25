import { describe, expect } from 'vitest';
import { test } from './fixture';
import { expectNoViolations } from './accessibility';
import { createDesignerPage, DESIGNER } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Calibrate a sheet and reserve space.md`: the reference sheet, its scale,
 * taking it away again — including against a file Obsidian has already deleted — the opacity
 * that is remembered nowhere, and the clearance-review flag that must survive a reopen and
 * has never been graded by any accessibility scan, because no harness fixture sets it.
 */
const desktop = mobileEmulation ? test.skip : test;

const FIXTURE_PNG = 'editor-background-png-test.png';
const REVIEW_NOTICE =
	'This clearance was kept at the size you drew it when the object was resized. Check that it still describes the space you need.';

describe('Calibrate a sheet and reserve space, in the real Obsidian host', () => {
	// Steps 9, 12, 13 and 14.
	desktop('calibrates the sheet, removes it with one undo back, and removes it again once its file is gone', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Traced hob');
		await designer.chooseBackground(FIXTURE_PNG);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(1);

		// Step 9: nothing is pending, so no confirmation comes first (Design an Asset step 22).
		await designer.calibrate(1000);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(2);
		expect(designer.readSidecar(assetId).calibration).not.toBeNull();
		await designer.referenceTab();
		await expect.poll(() => designer.referenceRow('Scale').getText()).toBe('Calibrated');
		expect(await designer.referenceRow('Sheet').getText()).toBe(FIXTURE_PNG);

		// Steps 12 and 13: the sheet and the calibration leave together, and come back together. With
		// nothing traced, no pending line keeps the section, so the whole Reference block withdraws
		// (step 2's rule) rather than reading 'None chosen'.
		const fields = () => designer.designer().$('.rp-designer-reference-fields');
		await designer.designer().$('button[name="remove-reference"]').click();
		await expect.poll(() => fields().isExisting()).toBe(false);
		await expect.poll(() => designer.readSidecar(assetId).calibration).toBeNull();
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(() => designer.referenceRow('Sheet').getText()).toBe(FIXTURE_PNG);
		expect(await designer.referenceRow('Scale').getText()).toBe('Calibrated');
		expect(designer.readSidecar(assetId).calibration).not.toBeNull();

		// Step 14: the file Obsidian deleted from under the reference.
		await browser.executeObsidian(async ({ app }, name) => {
			const file = app.vault.getFileByPath(name);
			if (!file) throw new Error('The fixture is missing.');
			await app.fileManager.trashFile(file);
		}, FIXTURE_PNG);
		await browser.pause(1500);
		await designer.designer().$('button[name="remove-reference"]').click();
		await expect.poll(() => fields().isExisting()).toBe(false);
		await expect.poll(() => designer.readSidecar(assetId).calibration).toBeNull();
		expect(await designer.notices()).toEqual([]);
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
	});

	// Step 7: opacity is a leaf-local ref; Show grid is this device's remembered choice.
	desktop('forgets the reference opacity on reopen and remembers Show grid', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Faded hob');
		await designer.chooseBackground(FIXTURE_PNG);
		const menu = () => designer.designer().$('.rp-view-menu');
		await menu().$('summary').click();
		const opacity = () => menu().$('input[data-rp-view="reference-opacity"]');
		await expect.poll(() => opacity().isDisplayed()).toBe(true);
		await browser.execute((el: HTMLElement) => {
			const slider = el as HTMLInputElement;
			slider.value = '0.3';
			slider.dispatchEvent(new Event('input', { bubbles: true }));
			slider.dispatchEvent(new Event('change', { bubbles: true }));
		}, await opacity().getElement());
		await menu().$('input[data-rp-view="grid"]').click();
		expect(await opacity().getValue()).toBe('0.3');
		expect(await menu().$('input[data-rp-view="grid"]').isSelected()).toBe(true);

		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		await designer.openDesignerFor('Faded hob');
		await menu().$('summary').click();
		await expect.poll(() => opacity().isDisplayed()).toBe(true);
		expect(await opacity().getValue()).toBe('1');
		expect(await menu().$('input[data-rp-view="grid"]').isSelected()).toBe(true);
	});

	// Steps 25, 26, 32, 33 and 34: the review block, graded by axe for the first time, and durable.
	desktop('flags a preserved clearance after a resize as a live region that survives a reopen', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Reviewed toilet');
		await designer.applyPreset('toilet');
		const clearance = () => designer.readSidecar(assetId).shape?.clearance;
		const before = clearance();

		await designer.editDimensions(200, 350);
		await expect.poll(() => designer.readSidecar(assetId).shape?.clearanceNeedsReview).toBe(true);
		expect(clearance()).toEqual(before);
		const notice = () => designer.designer().$('.rp-designer-clearance [role="status"]');
		await expect.poll(() => notice().getText()).toBe(REVIEW_NOTICE);
		const action = () => designer.designer().$('button=Mark clearance as reviewed');
		expect(await action().isExisting()).toBe(true);

		// Step 32's automatable half: the block no scan has ever reached, graded in a real renderer.
		await expectNoViolations(browser, directory, '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"] .rp-designer-inspector', 'button-name');

		// Step 34: a durable boolean, not an ephemeral warning.
		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		await designer.openDesignerFor('Reviewed toilet');
		await expect.poll(() => notice().getText()).toBe(REVIEW_NOTICE);

		// Step 33: the action writes the flag down and moves nothing.
		await action().click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.clearanceNeedsReview).toBe(false);
		expect(clearance()).toEqual(before);
		await expect.poll(() => notice().isExisting()).toBe(false);
		await designer.focusCanvas();
		await browser.keys(['Control', 'z']);
		await expect.poll(() => notice().isExisting()).toBe(true);
	});
});
