import { chmodSync } from 'node:fs';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage } from './designer';
import {
	drawnImages,
	FIXTURE_PNG,
	NEEDLE,
	noteBackground,
	healedAfter,
	referenceSheet,
	removeReference,
	retryButton,
	setSchema,
	STALE,
	staleAfter,
	staleNotice,
	VALIDATION,
	vaultSidecar,
	withClearance,
} from './recovery';
import { mobileEmulation } from './session';

/**
 * The second pass over `docs/tests/cases/Recover an asset design rather than lose it.md`: the
 * rows `assetDesignerRecovery.e2e.ts` left — one fault read by three widgets at once (step 11),
 * the revision counted against the gestures that landed (step 32), the overflow needle whose
 * write lands over a read-back that cannot (steps 12a to 12d), the half-undone compensation
 * (step 19) and a burst of retries (step 36). The `.rpgeo` on disk is the instrument throughout,
 * and an edit made outside Obsidian reaches the plugin through `reconcileFile`, because a driven
 * 1.13.7 never reconciles one on its own (W23-A's first finding).
 */
const desktop = mobileEmulation ? test.skip : test;

describe('Recover an asset design rather than lose it, the rows the first pass left', () => {
	// Steps 11 and 32 — one fault, three accounts; and one revision per landed write and undo,
	// none per refusal.
	desktop('counts one revision per landed write and undo and none per refusal, and draws one fault three ways', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Counted toilet');
		const revision = () => designer.readSidecar(assetId).revision;
		// The preset is the first landed write.
		expect(revision()).toBe(1);
		await designer.nudgeTo(assetId, 2);
		await designer.undoButton().click();
		await expect.poll(revision).toBe(3);
		await designer.designer().$('.rp-designer-history [aria-label="Redo"]').click();
		await expect.poll(revision).toBe(4);

		// Refused by the OS: no revision (step 3's half of step 32).
		chmodSync(designer.sidecarPath(assetId), 0o444);
		await designer.nudge();
		await expect.poll(designer.header).toBe('Save error');
		expect(revision()).toBe(4);
		chmodSync(designer.sidecarPath(assetId), 0o644);
		await designer.nudgeTo(assetId, 5);
		await expect.poll(designer.header).toBe('Saved just now');
		const x = await designer.inspectorField('centre-x').getValue();

		// Step 11: the notice first, then a drag into the same fault, read together.
		await staleAfter(designer, assetId, setSchema(99));
		await designer.selectPart(BOWL);
		await designer.nudge();
		await expect.poll(designer.notices).toContain(VALIDATION);
		expect(await designer.designer().$$('.rp-designer-notice').map((notice) => notice.getText())).toEqual([STALE]);
		expect(await designer.header()).toBe('Saved · refresh needed');
		expect(await designer.inspectorField('centre-x').getValue()).toBe(x);
		expect(revision()).toBe(5);

		// The repair heals, and the next write lands exactly once.
		await healedAfter(designer, assetId, setSchema(4));
		await designer.nudgeTo(assetId, 6);
		await browser.pause(1000);
		expect(designer.readSidecar(assetId)).toMatchObject({ assetId, revision: 6 });
	});

	// Steps 12a, 12b, 12c and 12d — fault 2b: a write that lands over a read-back that cannot.
	desktop('lands a Remove reference and its undo over a clearance the read-back cannot measure, and stays stale until repaired', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Needle toilet');
		// A sheet first: once a shape exists the designer offers no door to one.
		await referenceSheet(designer, assetId);
		await designer.applyPreset('toilet');
		const calibrated = designer.readSidecar(assetId).revision;
		const original = designer.readSidecar(assetId);
		expect(original.calibration).not.toBeNull();
		const clearance = original.shape?.clearance?.points ?? [];
		// A measured shape draws no Reference rows, so the sheet on the stage is the instrument.
		await expect.poll(() => drawnImages(browser)).toBeGreaterThan(0);

		// Step 12a: schema-valid, and the read's own derivation refuses it.
		await staleAfter(designer, assetId, withClearance(NEEDLE));
		// Same picture as step 7, from a different cause: qualified, no panel, the parts still drawn.
		const picture = {
			header: await designer.header(),
			panel: await designer.designer().$('.rp-view-failure').isExisting(),
			bowl: await designer.designer().$(`.rp-designer-part-row[name="${BOWL}"]`).isExisting(),
		};
		expect(picture).toEqual({ header: 'Saved · refresh needed', panel: false, bowl: true });

		// Step 12b: the gesture that writes the note AND the sidecar.
		await removeReference(designer, assetId, calibrated + 1);
		// Step 12c, the disk check that settles 12b: the write landed and kept the needle.
		expect(designer.readSidecar(assetId).shape?.clearance?.points).toEqual(NEEDLE);
		expect(designer.readSidecar(assetId).calibration).toBeNull();
		await expect.poll(() => noteBackground(browser, 'Needle toilet')).toBeNull();
		// ... and the canvas never saw it: still stale, still qualified, the sheet still drawn.
		expect(await staleNotice(designer).getText()).toBe(STALE);
		await expect.poll(designer.header).toBe('Saved · refresh needed');
		expect(await drawnImages(browser)).toBeGreaterThan(0);
		expect(await designer.notices()).toEqual([]);

		// Step 12d: the undo lands too, and the canvas still does not redraw.
		await designer.undoButton().click();
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(calibrated + 2);
		expect(designer.readSidecar(assetId).calibration).toEqual(original.calibration);
		await expect.poll(() => noteBackground(browser, 'Needle toilet')).toBe(FIXTURE_PNG);
		expect(await staleNotice(designer).getText()).toBe(STALE);
		// Only the hand repair clears it, and the canvas then agrees with the vault.
		await healedAfter(designer, assetId, withClearance(clearance));
		expect(await designer.header()).not.toContain('refresh needed');
		expect(await drawnImages(browser)).toBeGreaterThan(0);
		expect(designer.readSidecar(assetId)).toMatchObject({ revision: calibrated + 2, calibration: original.calibration });
	});

	// Step 19 — fault 3: the note restore lands and the sidecar restore refuses.
	desktop('restores the sheet but not its scale when the undo cannot write the sidecar, and names neither', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Half-undone hob');
		const calibrated = await referenceSheet(designer, assetId);
		await removeReference(designer, assetId, calibrated + 1);
		await expect.poll(() => designer.designer().$('.rp-designer-reference-fields').isExisting()).toBe(false);

		chmodSync(designer.sidecarPath(assetId), 0o444);
		try {
			await designer.undoButton().click();
			// The background comes back — the note restore landed and was announced.
			await expect.poll(() => noteBackground(browser, 'Half-undone hob')).toBe(FIXTURE_PNG);
			await expect.poll(() => designer.referenceRow('Sheet').getText()).toBe(FIXTURE_PNG);
			await expect.poll(designer.header).toBe('Save error');
			// The calibration does not, on screen or on disk; the sidecar half wrote nothing.
			expect(await designer.referenceRow('Scale').getText()).toBe('Not calibrated');
			expect(designer.readSidecar(assetId)).toMatchObject({ revision: calibrated + 1, calibration: null });
			// And nothing names the half-restored state: no toast, no notice, no alert.
			await browser.pause(1000);
			expect(await designer.notices()).toEqual([]);
			expect(await staleNotice(designer).isExisting()).toBe(false);
			expect(await designer.designer().$$('[role="alert"]').length).toBe(0);
		} finally {
			chmodSync(designer.sidecarPath(assetId), 0o644);
		}
	});

	// Step 36 — a burst of Try again: one read in flight, the button never dead.
	desktop('answers a burst of Try again with one read, keeping the button focused and live', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Retried toilet');
		await staleAfter(designer, assetId, setSchema(99));

		// Count the vault's reads of this sidecar, and watch for anything flickering in or out.
		await browser.executeObsidian(({ app }, target) => {
			const probe = window as unknown as { rpReads: number; rpFlicker: string[] };
			probe.rpReads = 0;
			probe.rpFlicker = [];
			const read = app.vault.read.bind(app.vault);
			app.vault.read = (file) => {
				if (file.path === target) probe.rpReads += 1;
				return read(file);
			};
			const leaf = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
			new MutationObserver((records) => {
				for (const record of records) {
					for (const node of [...record.addedNodes, ...record.removedNodes]) {
						if (node instanceof HTMLElement && node.matches('.rp-designer-notice, .rp-designer-retry, .rp-view-failure')) probe.rpFlicker.push(node.className);
					}
				}
			}).observe(leaf as Node, { childList: true, subtree: true });
		}, vaultSidecar(assetId));
		const probe = () => browser.execute(() => {
			const p = window as unknown as { rpReads: number; rpFlicker: string[] };
			return { reads: p.rpReads, flicker: p.rpFlicker };
		});

		await browser.execute((el: HTMLElement) => {
			el.focus();
			for (let press = 0; press < 5; press += 1) el.click();
		}, await retryButton(designer).getElement());
		await expect.poll(() => staleNotice(designer).getText()).toContain('again');
		await expect.poll(() => retryButton(designer).getAttribute('aria-disabled')).toBeNull();
		expect(await probe()).toEqual({ reads: 1, flicker: [] });
		expect(await browser.execute(() => document.activeElement?.classList.contains('rp-designer-retry'))).toBe(true);

		// Still answered afterwards: one more press is one more read.
		await retryButton(designer).click();
		await expect.poll(async () => (await probe()).reads).toBe(2);
		expect((await probe()).flicker).toEqual([]);
		designer.editSidecar(assetId, setSchema(4));
		await retryButton(designer).click();
		await expect.poll(() => staleNotice(designer).isExisting()).toBe(false);
	});
});
