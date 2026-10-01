import { describe, expect } from 'vitest';
import { test } from './fixture';
import { BOWL, createDesignerPage, DESIGNER, type Sidecar } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Two designers on one asset.md`, the rows `twoDesigners.e2e.ts` left: step 1's
 * other gestures, reached through the tab's REAL context menu rather than `duplicateLeaf`, and step
 * 15's count taken once over the whole walk in one vault rather than per refusal.
 */
const desktop = mobileEmulation ? test.skip : test;

const NAME = 'Counted toilet';

/** The bowl's centre on disk, in the millimetres the Inspector's Centre X shows. */
const bowlCentreX = (sidecar: Sidecar): number => {
	const xs = sidecar.shape?.details.find((detail) => detail.name === 'bowl')?.outline.points.map((point) => point[0] ?? 0) ?? [];
	return (Math.min(...xs) + Math.max(...xs)) / 2;
};

describe('Two designers on one asset, the rest of it in the real Obsidian host', () => {
	// Step 1: every gesture Obsidian's tab menu offers, recorded.
	desktop("duplicates a designer through the tab menu's Split right and Split down, and only moves it with Move to new window", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Menu toilet');
		await designer.applyPreset('toilet');
		const tabMenu = async (item: string): Promise<void> => {
			await designer.activate(DESIGNER, 0);
			await browser.$('.workspace-tab-header.is-active[data-type="renovation-asset-designer"]').click({ button: 'right' });
			const entry = browser.$(`//div[contains(@class,"menu-item-title") and normalize-space(.)="${item}"]`);
			await expect.poll(() => entry.isDisplayed()).toBe(true);
			await entry.click();
		};
		/** Each leaf's asset name, read from its own container — a popout's lives in another document. */
		const drawn = () =>
			browser.executeObsidian(({ app }) =>
				app.workspace.getLeavesOfType('renovation-asset-designer').map((leaf) => ({
					name: leaf.view.containerEl.querySelector('.rp-designer-asset-name')?.textContent ?? null,
					popout: leaf.view.containerEl.ownerDocument !== document,
				})),
			);

		for (const split of ['Split right', 'Split down']) {
			await tabMenu(split);
			await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([{ assetId }, { assetId }]);
			await expect.poll(drawn).toEqual([{ name: 'Menu toilet', popout: false }, { name: 'Menu toilet', popout: false }]);
			await designer.closeDesigner(1);
			await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(1);
		}

		// Move to new window MOVES the leaf: still one designer, now drawing in a popout.
		await tabMenu('Move to new window');
		await expect.poll(drawn, { timeout: 15_000 }).toEqual([{ name: 'Menu toilet', popout: true }]);
		expect(await designer.leafStates(DESIGNER)).toEqual([{ assetId }]);
	});

	// Step 15, with 5, 8, 11, 12, 13 and 14 walked in order in ONE vault.
	desktop('counts on disk exactly the writes that landed across the whole walk, and both leaves draw what is stored', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet(NAME);
		await designer.split();
		await expect.poll(() => designer.leafStates(DESIGNER)).toHaveLength(2);
		let landed = 1; // the preset
		const onDisk = () => designer.readSidecar(assetId);
		/** Leaf `index` in front, with the bowl selected in it. */
		const bowlIn = async (index: number) => {
			await designer.activate(DESIGNER, index);
			await designer.selectPart(BOWL);
		};
		/** One nudge in leaf `index` that LANDS — counted, and waited for on disk. */
		const land = async (index: number) => {
			await bowlIn(index);
			await designer.nudge();
			landed += 1;
			await expect.poll(() => onDisk().revision).toBe(landed);
			// The peer's refresh settles before the next leaf reads its design.
			await browser.pause(800);
		};

		// Step 5: A writes.
		await land(0);
		// Step 8: a drag held in B across A's write — A's lands, B's is dropped.
		await bowlIn(1);
		await designer.armPeerNudge(0, 900);
		await designer.holdDrag('detail-2', 40, 1);
		landed += 1;
		await expect.poll(() => onDisk().revision).toBe(landed);
		// Step 11: A, B, A, then an Undo that lands and one that is refused.
		for (const index of [0, 1, 0]) await land(index);
		landed += 1;
		await designer.undoUntilSuperseded(assetId, landed);
		// Step 12: B retypes the dimensions it shows — no write.
		await designer.activate(DESIGNER, 1);
		await designer.editDimensions(380, 700);
		await browser.pause(800);
		expect(onDisk().revision).toBe(landed);
		// Step 13: a real edit in B; both leaves then draw what is stored.
		await land(1);
		const stored = String(bowlCentreX(onDisk()));
		const drawn: string[] = [];
		for (const index of [0, 1]) {
			await bowlIn(index);
			drawn.push(await designer.inspectorField('centre-x').getValue());
		}
		expect(drawn).toEqual([stored, stored]);

		// Step 14: a drag held in B across an external same-revision rewrite — refused, nothing written.
		await designer.holdDrag('detail-2', 40, 1, () => {
			designer.editSidecar(assetId, (text) => {
				const data = JSON.parse(text) as Sidecar;
				const first = data.shape?.footprint.points[0];
				if (first) first[1] = (first[1] ?? 0) - 5;
				return JSON.stringify(data, null, '\t');
			});
			return Promise.resolve();
		});
		await expect.poll(designer.header).toBe('Save error');
		expect([onDisk().revision, landed]).toEqual([8, 8]);
		expect(String(bowlCentreX(onDisk()))).toBe(stored);
	});
});
