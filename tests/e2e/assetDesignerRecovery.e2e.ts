import { chmodSync, existsSync } from 'node:fs';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { closePluginSettings, openPluginSettings, settingControl } from './helpers';
import { BOWL, createDesignerPage, DESIGNER, type Sidecar } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Recover an asset design rather than lose it.md` (AD15 scenario U05,
 * contract C08), driven in a real vault with a real file system: the read-only bit, an edit
 * made outside Obsidian, a restart, a settings save, and a note moved and deleted from under
 * the leaf. The `.rpgeo` on disk is the instrument for every "did it write" clause, exactly as
 * that case's step 12c asks.
 *
 * Everything here needs a designer, which mounts nothing on mobile.
 */
const desktop = mobileEmulation ? test.skip : test;

const STALE = 'This asset could not be re-read after the last change; what you see may be out of date.';
const VALIDATION = 'This data is not in the expected form.';

/** A foreign edit of one footprint coordinate, keeping the document valid. */
const nudged = (data: Sidecar): Sidecar => {
	const first = data.shape?.footprint.points[0];
	if (first) first[0] = (first[0] ?? 0) - 5;
	return data;
};

const setSchema = (version: number) => (text: string) => text.replace(/"schemaVersion": \d+/, `"schemaVersion": ${version}`);

describe('Recover an asset design rather than lose it, in the real Obsidian host', () => {
	// Steps 2, 3, 4, 5 and 6 — fault 1, then the schema variant of fault 2, then the one event
	// that clears a save error.
	desktop('refuses a write the OS forbids without a toast, and clears the error only on a write that lands', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Read-only toilet');

		chmodSync(designer.sidecarPath(assetId), 0o444);
		await browser.pause(1000);
		// Setting the attribute writes no bytes, so nothing may react to it (step 2).
		expect(await designer.header()).toBe('Saved just now');
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);

		await designer.nudge();
		await expect.poll(designer.header).toBe('Save error');
		expect(designer.readSidecar(assetId).revision).toBe(1);
		// The bowl sprang back: the store never accepted what the vault refused.
		expect(await designer.inspectorField('centre-x').getValue()).toBe('0');
		expect(await designer.notices()).toEqual([]);
		chmodSync(designer.sidecarPath(assetId), 0o644);

		// Step 5: a refusal from the read that OPENS the write toasts, and reverts the word to
		// what the batch opened on — still `Save error`, neither cleared nor re-raised.
		designer.editSidecar(assetId, setSchema(99));
		await designer.nudge();
		await expect.poll(designer.notices).toContain(VALIDATION);
		expect(await designer.header()).toBe('Save error');
		expect(designer.readSidecar(assetId).revision).toBe(1);

		// Step 6: the first thing in this walk to clear it.
		designer.editSidecar(assetId, setSchema(4));
		await designer.nudge();
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(2);
		await expect.poll(designer.header).toBe('Saved just now');
		expect(await designer.inspectorField('centre-x').getValue()).toBe('10');
	});

	// Steps 7, 8, 9, 10, 12, 33, 35, 37 and 38 — fault 2 proper, and the notice's way out.
	desktop('shows the stale notice once the host reconciles an edited sidecar, retries it, and heals it unprompted', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Stale toilet');
		await designer.applyPreset('toilet');
		const vaultPath = `Renovation/Library/Geometry/${assetId}.rpgeo`;
		const notice = () => designer.designer().$('.rp-designer-notice');
		const retry = () => designer.designer().$('.rp-designer-retry');

		// Step 8's first link, MEASURED: a driven Obsidian 1.13 raises `raw` for a file written
		// outside it and reconciles nothing, so the leaf that made no command hears nothing.
		designer.editSidecar(assetId, setSchema(99));
		await browser.pause(5000);
		expect(await notice().isExisting()).toBe(false);
		expect(await designer.header()).toBe('Saved just now');

		// The same reconcile Obsidian's watcher performs when it does act — every link after it
		// is the plugin's, and this is what drives them.
		await designer.reconcile(vaultPath);
		await expect.poll(() => notice().getText()).toBe(STALE);
		expect(await designer.header()).toBe('Saved · refresh needed');
		// The design is still drawn — no failure panel, nothing dimmed, and a sibling Try again.
		expect(await designer.designer().$('.rp-view-failure').isExisting()).toBe(false);
		expect(await designer.designer().$('.rp-designer-part-row[name="detail:detail-2"]').isExisting()).toBe(true);
		expect(await designer.designer().$$('.rp-designer-tools .rp-designer-tool-button[disabled]:not(.rp-designer-history *)').length).toBe(0);
		expect(await retry().isExisting()).toBe(true);
		expect(await notice().$('.rp-designer-retry').isExisting()).toBe(false);

		// Step 35: a retry over a fault keeps the canvas and changes only the sentence.
		await retry().click();
		await expect.poll(() => notice().getText()).toContain('again');
		expect(await designer.designer().$('.rp-view-failure').isExisting()).toBe(false);
		expect(await designer.header()).toBe('Saved · refresh needed');

		// Step 12 and 37: the repair is itself a sidecar change, so it heals with no press.
		designer.editSidecar(assetId, setSchema(4));
		await designer.reconcile(vaultPath);
		await expect.poll(() => notice().isExisting()).toBe(false);
		expect(await retry().isExisting()).toBe(false);
		expect(await designer.header()).not.toContain('refresh needed');

		// Step 38: a fresh failure announces itself as a first one, not as one already retried.
		designer.editSidecar(assetId, setSchema(99));
		await designer.reconcile(vaultPath);
		await expect.poll(() => notice().getText()).toBe(STALE);
	});

	// Step 17 — C08's "do not blindly restore old snapshots over a newer external edit".
	desktop('refuses to undo past a foreign edit, with the one refusal here that explains itself', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Sandwiched toilet');
		await designer.nudgeTo(assetId, 2);

		designer.editSidecar(assetId, (text) => JSON.stringify(nudged(JSON.parse(text) as Sidecar), null, '\t'));
		await designer.reconcile(`Renovation/Library/Geometry/${assetId}.rpgeo`);
		await browser.pause(1500);

		await designer.nudgeTo(assetId, 3);
		await designer.undoUntilSuperseded(assetId, 4);
		expect(designer.readSidecar(assetId).shape?.footprint.points[0]?.[0]).toBe(-195);
	});

	// Steps 21 to 24 — what a leaf keeps and what it loses across a close, a restart and a
	// settings save. Only the subject survives; the history lives in the leaf's own Pinia.
	desktop('restores the same asset across a close, a restart and a settings save, keeping the work and losing the history', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Restored toilet');
		await designer.nudgeTo(assetId, 2);
		expect(await designer.undoDisabled()).toBe(false);

		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		await designer.openDesignerFor('Restored toilet');
		expect(await designer.openAssetId()).toBe(assetId);
		expect(await designer.undoDisabled()).toBe(true);
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');

		// Step 23: a restart restores the leaf BEFORE the index scan; no failure panel may flash.
		await browser.reloadObsidian();
		await expect.poll(() => designer.leafStates(DESIGNER), { timeout: 20_000 }).toEqual([{ assetId }]);
		await ui.activate(DESIGNER);
		await expect.poll(() => designer.designer().$('.rp-designer-asset-name').getText()).toBe('Restored toilet');
		expect(await designer.designer().$('.rp-view-failure').isExisting()).toBe(false);
		expect(await designer.undoDisabled()).toBe(true);

		// Step 24: `rebind` on any settings save remounts the tree with a fresh Pinia.
		await designer.selectPart(BOWL);
		await designer.nudge();
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
		expect(await designer.undoDisabled()).toBe(false);
		const windows = await openPluginSettings(browser);
		await settingControl(browser, 'Verbose logging', 'input').click();
		await closePluginSettings(browser, windows);
		await ui.activate(DESIGNER);
		await expect.poll(() => designer.designer().$('.rp-designer-asset-name').getText()).toBe('Restored toilet');
		expect(await designer.openAssetId()).toBe(assetId);
		await expect.poll(designer.undoDisabled).toBe(true);
		expect(designer.readSidecar(assetId)).toMatchObject({ assetId, revision: 3 });
	});

	// Steps 26, 27, 29, 30 and 31 — the note moved, then deleted, from under the leaf.
	desktop('ignores its note moving, and offers only Close this tab once the note is gone, leaving the sidecar orphaned', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Doomed toilet');
		await designer.applyPreset('toilet');

		await browser.executeObsidian(async ({ app }) => {
			const file = app.vault.getFileByPath('Renovation/Library/Assets/Doomed toilet.md');
			if (!file) throw new Error('The asset note is missing.');
			await app.fileManager.renameFile(file, 'Doomed toilet.md');
		});
		await browser.pause(2500);
		expect(await designer.designer().$('.rp-designer-asset-name').getText()).toBe('Doomed toilet');
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
		expect(await designer.designer().$('.rp-view-failure').isExisting()).toBe(false);
		expect(await designer.notices()).toEqual([]);

		await browser.executeObsidian(async ({ app }) => {
			const file = app.vault.getFileByPath('Doomed toilet.md');
			if (!file) throw new Error('The moved note is missing.');
			await app.fileManager.trashFile(file);
		});
		const failure = () => designer.designer().$('.rp-view-failure');
		await expect.poll(() => failure().isExisting()).toBe(true);
		expect(await failure().$('.rp-view-failure__headline').getText()).toBe('This asset no longer exists');
		expect(await failure().$('.rp-view-failure__body').getText()).toBe('This tab points at an asset that is not in the vault any more.');
		expect(await failure().$$('button').map((button) => button.getText())).toEqual(['Close this tab']);
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);

		await failure().$('.rp-view-failure__action').click();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		// Step 30: nothing removed the sidecar, and nothing said so.
		expect(existsSync(designer.sidecarPath(assetId))).toBe(true);
		expect(designer.readSidecar(assetId).assetId).toBe(assetId);
	});
});
