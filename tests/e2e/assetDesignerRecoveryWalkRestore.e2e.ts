import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, DESIGNER } from './designer';
import { closeTabByHand, failureSample, interruptionsSeen, recordInterruptions, reloadWatchingForFailure } from './recovery';
import { mobileEmulation } from './session';

/**
 * The close, restart and unload clauses of `docs/tests/cases/Recover an asset design rather than
 * lose it.md` that `assetDesignerRecovery.e2e.ts` reached without settling: both of two gestures,
 * Redo as well as Undo, a tab closed the way a person closes one, a failure panel that might exist
 * for a single frame while a restored leaf waits for the index scan, and the console across an
 * unload.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The toilet preset's tank, the second part the close-and-reopen case moves. */
const TANK = 'detail:detail-1';

describe('Recover an asset design rather than lose it, across a close, a restart and an unload', () => {
	// Steps 21 and 23.
	desktop('keeps both gestures across a tab closed by hand with no warning, and restores without ever drawing a failure panel', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Twice-moved toilet');
		await designer.nudgeTo(assetId, 2);
		await designer.selectPart(TANK);
		const tankX = Number(await designer.inspectorField('centre-x').getValue());

		// Step 21: the second gesture, and the tab closed straight after it by its own close button.
		await recordInterruptions(browser);
		await designer.nudge();
		await closeTabByHand(browser);
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		expect(await interruptionsSeen(browser)).toEqual([]);

		await designer.openDesignerFor('Twice-moved toilet');
		expect(await designer.undoDisabled()).toBe(true);
		expect(await designer.designer().$('.rp-designer-history [aria-label="Redo"]').getAttribute('disabled')).not.toBeNull();
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('10');
		await designer.selectPart(TANK);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe(String(tankX + 10));

		// Step 23: the renderer restarted with a sampler watching from its first script, so a panel
		// drawn for one frame before the index scan lands is counted rather than missed.
		await reloadWatchingForFailure(browser);
		await expect.poll(() => designer.leafStates(DESIGNER), { timeout: 20_000 }).toEqual([{ assetId }]);
		await ui.activate(DESIGNER);
		await expect.poll(() => designer.designer().$('.rp-designer-asset-name').getText()).toBe('Twice-moved toilet');
		// Past the scan's own re-read, which is where a retracted panel would have been drawn.
		await browser.pause(1500);
		const sample = await failureSample(browser);
		expect(sample).toMatchObject({ atStart: false, panelFrames: 0, panelMutations: 0 });
		expect(sample.drawnFrames).toBeGreaterThan(0);
	});

	// Step 25.
	desktop('logs no error to the console while the plugin unloads with a designer open', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createToilet('Unloaded toilet');
		await designer.consoleMessages();
		// The instrument first: an error logged now must come back, or an empty list proves nothing.
		await browser.execute(() => {
			console.error('rp-e2e: the console reaches this case');
		});
		await page.disablePlugin('renovation-planner');
		const logged = (await browser.getLogs('browser')) as { level: string; message: string }[];
		await page.enablePlugin('renovation-planner');
		const errors = logged.filter((entry) => entry.level === 'SEVERE').map((entry) => entry.message);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('rp-e2e: the console reaches this case');
	});
});
