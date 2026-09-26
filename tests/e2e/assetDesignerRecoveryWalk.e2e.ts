import { chmodSync, statSync } from 'node:fs';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, DESIGNER } from './designer';
import { writeEvidence } from './diagnostics';
import {
	allLeaves,
	designerPicture,
	fileExplorer,
	holdHostWatcher,
	interruptionsSeen,
	recordInterruptions,
	recordStaleTriple,
	retryButton,
	setSchema,
	STALE,
	staleNotice,
	staleTriples,
	withDetailShifted,
} from './recovery';
import { mobileEmulation } from './session';

/**
 * The clauses of `docs/tests/cases/Recover an asset design rather than lose it.md` that the first
 * two passes left to a person because they are about the HOST: an attribute change that must
 * change nothing, a notice raised and retired by Obsidian's own file watcher with no call from the
 * test, a press that has to be the thing that heals, and a note moved and deleted with a second
 * designer open beside it.
 *
 * Measured 2026-09-26 on Windows 11 with 1.13.7: the host raised `modify` for an out-of-band
 * `.rpgeo` write within 5 ms in four probes of four, and over six writes and six repairs the notice
 * arrived 375–680 ms after the write and left 530–589 ms after the repair; every run records its
 * own figure in its evidence directory. A `chmod` raised `raw` and no `modify`, and the sidecar was
 * not read. Linux is NOT measured here, and W23-A once saw `raw` and no `modify` for 15 s under load.
 */
const desktop = mobileEmulation ? test.skip : test;

/**
 * "Within about a second" (step 8) and "wait about two seconds" (step 6), as one bound: the 500 ms
 * debounce plus the watcher and the read, with room for a slower CI host.
 */
const UNPROMPTED_MS = 2000;

describe('Recover an asset design rather than lose it, the host clauses', () => {
	// Steps 2 and 6 — an attribute change that changes nothing, and the early notice retired by the
	// host's own watcher before the next drag.
	desktop('draws the same canvas and selection through a read-only bit, and retires the early notice with no press', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Watched toilet');
		await browser.pause(500);
		const before = await designerPicture(browser);
		expect(before.pressed).toEqual([BOWL]);

		chmodSync(designer.sidecarPath(assetId), 0o444);
		try {
			await browser.pause(2000);
			expect(await designerPicture(browser)).toEqual(before);
			await designer.nudge();
			await expect.poll(designer.header).toBe('Save error');
		} finally {
			chmodSync(designer.sidecarPath(assetId), 0o644);
		}

		// Step 5's early notice: the host's watcher, and nothing the test calls.
		designer.editSidecar(assetId, setSchema(99));
		await expect.poll(() => staleNotice(designer).getText()).toBe(STALE);
		const repaired = Date.now();
		designer.editSidecar(assetId, setSchema(4));
		await staleNotice(designer).waitForExist({ reverse: true, timeout: UNPROMPTED_MS });
		await writeEvidence(directory, 'unprompted-heal', { milliseconds: Date.now() - repaired });
		await designer.nudgeTo(assetId, 2);
		await expect.poll(designer.header).toBe('Saved just now');
	});

	// Steps 8 and 37 — the notice arrives unprompted; and a press after a repair the host has NOT yet
	// reconciled clears the notice, its Try again and the header's qualifier in one change.
	desktop('raises the notice unprompted, and a press after the repair retires all three widgets at once', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Pressed toilet');

		const broken = Date.now();
		designer.editSidecar(assetId, setSchema(99));
		await staleNotice(designer).waitForExist({ timeout: UNPROMPTED_MS });
		await writeEvidence(directory, 'unprompted-notice', { milliseconds: Date.now() - broken });
		expect(await staleNotice(designer).getText()).toBe(STALE);

		// On this host a repair reconciles by itself in about half a second (step 12), so the press is
		// reachable only while the watcher has not acted: hold it, and the press is the one door left.
		const release = await holdHostWatcher(browser);
		try {
			designer.editSidecar(assetId, (text) => withDetailShifted('detail-2', 50)(setSchema(4)(text)));
			await browser.pause(1000);
			expect(await staleNotice(designer).getText()).toBe(STALE);
			await recordStaleTriple(browser);
			await retryButton(designer).click();
			await expect.poll(() => staleNotice(designer).isExisting()).toBe(false);
			expect(await staleTriples(browser)).toEqual(['true,true,true', 'false,false,false']);
			// The canvas shows the repaired file, not the design it held while stale.
			await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('50');
		} finally {
			await release();
		}
	});

	// Steps 26, 29 and 30 — a move that changes nothing, a close that touches nothing else, and an
	// orphan nobody mentions.
	desktop('keeps the picture through a move, closes only its own tab once the note is gone, and leaves the orphan unspoken', async ({
		native: { browser, page, ui, directory },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const keptId = await designer.createToilet('Kept toilet');
		const assetId = await designer.createAsset('Doomed toilet');
		await designer.applyPreset('toilet');
		await designer.selectPart(BOWL);
		await browser.pause(500);
		const before = await designerPicture(browser);
		expect(before.pressed).toEqual([BOWL]);

		await fileExplorer(browser, 'Renovation/Library/Assets/Doomed toilet.md', 'Doomed toilet.md');
		await browser.pause(2500);
		expect(await designerPicture(browser)).toEqual(before);

		const bytes = statSync(designer.sidecarPath(assetId)).size;
		await recordInterruptions(browser);
		await fileExplorer(browser, 'Doomed toilet.md', 'trash');
		// The panel's one button, Close this tab.
		const closeThisTab = designer.designer().$('.rp-view-failure .rp-view-failure__action');
		await closeThisTab.waitForDisplayed();
		// Step 30's first half, read here because an offer raised by the delete would be modal and
		// stand between the user and the panel's own button.
		expect(await interruptionsSeen(browser)).toEqual([]);
		const open = await allLeaves(browser);
		await closeThisTab.click();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([{ assetId: keptId }]);

		// Step 29: every other leaf, of every type, exactly as it was — no new tab, the peer untouched.
		expect(await allLeaves(browser)).toEqual(open.filter((leaf) => (leaf.state as { assetId?: string }).assetId !== assetId));
		await ui.activate(DESIGNER);
		expect(await designer.designer().$('.rp-designer-asset-name').getText()).toBe('Kept toilet');
		expect(await designer.designer().$('.rp-view-failure').isExisting()).toBe(false);

		// Step 30: nothing said, nothing offered, and the sidecar exactly as the delete left it.
		expect(await interruptionsSeen(browser)).toEqual([]);
		expect(statSync(designer.sidecarPath(assetId)).size).toBe(bytes);
		await writeEvidence(directory, 'orphan', { assetId, bytes });
	});
});
