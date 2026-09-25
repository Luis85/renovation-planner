import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, DESIGNER, type Sidecar } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Two designers on one asset.md` (matrix row T12, contract C08): two Asset
 * Designer leaves on ONE asset, which no control this plugin owns can produce and no fake leaf
 * has ever behaved as. The pair comes from Obsidian's own `duplicateLeaf`, the same thing the
 * tab menu's Split does, and the held-gesture window is a real pointer press left down while
 * the other leaf writes — the peer's keystroke fired by a timer inside the page, since the
 * driver cannot interleave anything of its own with an action chain.
 */
const desktop = mobileEmulation ? test.skip : test;


const shiftedFootprint = (text: string): string => {
	const data = JSON.parse(text) as Sidecar;
	const first = data.shape?.footprint.points[0];
	if (first) first[0] = (first[0] ?? 0) - 5;
	return JSON.stringify(data, null, '\t');
};

describe('Two designers on one asset, in the real Obsidian host', () => {
	// Step 1, and step 2: a pair is obtainable, and a pair persists.
	desktop("splits a designer into a second leaf on the same asset with Obsidian's own Split, and restores both", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Shared toilet');
		await designer.applyPreset('toilet');
		await designer.split();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([{ assetId }, { assetId }]);
		const names = () => browser.$$('.workspace-leaf-content[data-type="renovation-asset-designer"] .rp-designer-asset-name').map((el) => el.getText());
		await expect.poll(names).toEqual(['Shared toilet', 'Shared toilet']);

		await browser.reloadObsidian();
		await expect.poll(() => designer.leafStates(DESIGNER), { timeout: 20_000 }).toEqual([{ assetId }, { assetId }]);
		await expect.poll(names).toEqual(['Shared toilet', 'Shared toilet']);
		expect(await browser.$$('.rp-view-failure').length).toBe(0);
	});

	// Steps 5, 8, 9 and 13.
	desktop("redraws the peer on a write, and DROPS a drag held across one — no write, no badge, no toast", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Raced toilet');
		await designer.applyPreset('toilet');
		await designer.split();
		await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(2);
		const bowlX = () => designer.inspectorField('centre-x').getValue();
		const revision = () => designer.readSidecar(assetId).revision;

		// Step 5: leaf A writes; leaf B, untouched, redraws it and says nothing.
		await ui.activate(DESIGNER, 0);
		await designer.selectPart(BOWL);
		await designer.nudge();
		await expect.poll(revision).toBe(2);
		await ui.activate(DESIGNER, 1);
		await designer.selectPart(BOWL);
		await expect.poll(bowlX).toBe('10');
		expect(await designer.header()).toBe('Saved');
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
		expect(await designer.notices()).toEqual([]);

		// Step 8, AS MEASURED rather than as the case expects. The case says B's header reads
		// `Save error` and its canvas shows A's change; what a real host does is the second half
		// only: A's write lands, B redraws it, and B's held drag is abandoned with NO account at
		// all — nothing written, no badge, no history entry, no toast. That is one step quieter
		// than the silent badge step 9 records as the hole. Pinned so the day it changes is a red
		// case, whichever way the ruling goes.
		await designer.armPeerNudge(0, 900);
		await designer.holdDrag('detail-2', 40, 1);
		await expect.poll(revision).toBe(3);
		await ui.activate(DESIGNER, 1);
		await expect.poll(bowlX).toBe('20');
		expect(await designer.header()).toBe('Saved');
		expect(await designer.undoDisabled()).toBe(true);
		expect(designer.readSidecar(assetId).shape?.details.find((detail) => detail.name === 'bowl')?.outline.points[0]?.[0]).toBe(-132);
		// Step 9: nothing explains it — no toast, no retry, no notice, no qualifier.
		expect(await designer.notices()).toEqual([]);
		expect(await designer.designer().$('.rp-designer-retry').isExisting()).toBe(false);
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
		await ui.activate(DESIGNER, 0);
		expect(await designer.header()).toBe('Saved just now');

		// Step 13: a real edit in B lands on the version it now shows, and A redraws it.
		await ui.activate(DESIGNER, 1);
		await designer.nudge();
		await expect.poll(revision).toBe(4);
		await expect.poll(designer.header).toBe('Saved just now');
		await ui.activate(DESIGNER, 0);
		await expect.poll(bowlX).toBe('30');
	});

	// Step 11: the sandwiched undo, with the peer LEAF's write moving the ledger generation.
	desktop('refuses to undo a gesture the other leaf has written past, with a real notice', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Sandwiched pair');
		await designer.applyPreset('toilet');
		await designer.split();
		await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(2);
		const revision = () => designer.readSidecar(assetId).revision;
		const nudgeIn = async (index: number, expected: number) => {
			await ui.activate(DESIGNER, index);
			await designer.selectPart(BOWL);
			await designer.nudge();
			await expect.poll(revision).toBe(expected);
			await browser.pause(800);
		};

		await nudgeIn(0, 2);
		await nudgeIn(1, 3);
		await nudgeIn(0, 4);

		await designer.undoUntilSuperseded(assetId, 5);
	});

	// Steps 14 and 15: the OTHER refusal code, indistinguishable to the user, and the count on disk.
	desktop('refuses a drag held across an external rewrite with the badge alone, and writes nothing for it', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Externally edited toilet');
		await designer.nudgeTo(assetId, 2);

		await designer.holdDrag('detail-2', 40, 0, () => {
			designer.editSidecar(assetId, shiftedFootprint);
			return Promise.resolve();
		});

		await expect.poll(designer.header).toBe('Save error');
		expect(await designer.notices()).toEqual([]);
		expect(await designer.designer().$('.rp-designer-notice').isExisting()).toBe(false);
		const stored = designer.readSidecar(assetId);
		expect(stored.revision).toBe(2);
		expect(stored.shape?.footprint.points[0]?.[0]).toBe(-195);
		expect(stored.shape?.details.find((detail) => detail.name === 'bowl')?.outline.points[0]?.[0]).toBe(-142);
	});

	// Step 16: a closed leaf leaves no subscription behind, and a new one draws what is current.
	desktop('draws the current shape in a leaf reopened after edits made while it was closed', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Reopened pair');
		await designer.applyPreset('toilet');
		await designer.split();
		await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(2);
		await designer.closeDesigner(1);
		await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(1);

		await ui.activate(DESIGNER, 0);
		await designer.selectPart(BOWL);
		for (const expected of [2, 3, 4]) {
			await designer.nudge();
			await expect.poll(() => designer.readSidecar(assetId).revision).toBe(expected);
		}
		expect(await designer.notices()).toEqual([]);
		expect(await designer.header()).toBe('Saved just now');

		await designer.split();
		await ui.activate(DESIGNER, 1);
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('30');
		await ui.activate(DESIGNER, 0);
		await designer.nudge();
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(5);
		await ui.activate(DESIGNER, 1);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe('40');
	});
});
