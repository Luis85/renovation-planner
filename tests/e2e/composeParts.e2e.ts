import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createComposer } from './compose';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Compose an asset from parts.md`, the `obsidian` rows about a Parts-hidden
 * graphic (7b to 7f, 39) and what hiding, locking and grouping leave behind across a closed tab
 * and a plugin reload (8, 38). The fixture is the case's own asset A — Set dimensions 800 by 400
 * and three rectangles drawn by hand — and the `.rpgeo` on disk is the instrument for every "does
 * nothing" clause, Konva's stage for every "is drawn" one.
 *
 * The designer draws nothing on mobile (`AssetDesignerView.sync`), so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

type Composer = ReturnType<typeof createComposer>;

/** Asset A with its middle rectangle selected through its row and then hidden: step 7a's state. */
async function hiddenAndSelected(c: Composer, name: string): Promise<{ assetId: string; ids: string[]; middle: string }> {
	const { assetId, ids } = await c.createAssetA(name);
	const middle = ids[1] as string;
	await c.row(middle).click();
	await c.control(middle, 'toggle-hidden').click();
	await expect.poll(c.drawn).toEqual(ids.filter((id) => id !== middle).toSorted());
	expect(await c.pressedRows()).toEqual([`detail:${middle}`]);
	expect(await c.marks()).toBe(0);
	return { assetId, ids, middle };
}

describe('Compose an asset from parts: a hidden part, in the real Obsidian host', () => {
	// Steps 7b and 7d.
	desktop('lets no key and no menu act on a hidden selected rectangle, and leaves the chords to the host', async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, middle } = await hiddenAndSelected(c, 'Hidden doors');
		const before = c.readSidecar(assetId);
		await c.recordKeys();
		await c.recordCommands();

		await c.focusCanvas();
		await c.keyPress('ArrowRight');
		await c.onCanvas('Delete');
		await c.rightClick(c.row(middle));
		expect(await c.menu().isExisting()).toBe(false);
		await c.onCanvas(['Shift', 'F10']);
		expect(await c.menu().isExisting()).toBe(false);
		await c.onCanvas(['Control', 'd']);
		await c.onCanvas(['Control', 'Shift', 'g']);
		await browser.pause(750);
		expect(c.readSidecar(assetId)).toEqual(before);
		expect(await c.menu().isExisting()).toBe(false);
		expect(await c.pressedRows()).toEqual([`detail:${middle}`]);

		// Step 7d, recorded: the designer claims neither chord, and the host's own Mod+D binding
		// (`editor:delete-paragraph`) fires on Ctrl+D; nothing fires on Ctrl+Shift+G. The arrow's
		// default IS taken, by `EditorSurface`'s nudge door, even though the nudge writes nothing.
		const keys = (await c.keyLog()).filter((each) => !['Shift', 'Control'].includes(each.key));
		expect(keys).toEqual([
			{ key: 'ArrowRight', prevented: true },
			{ key: 'Delete', prevented: false },
			{ key: 'F10', prevented: false },
			{ key: 'd', prevented: true },
			{ key: 'G', prevented: false },
		]);
		expect(await c.commandLog()).toEqual(['editor:delete-paragraph']);
		// And it runs FIRST: a Ctrl+D dispatched at the canvas never reaches the canvas's own listener,
		// so the designer is not the one declining it. Ctrl+Shift+G, bound to nothing, does reach it.
		expect(await c.reachesCanvas({ key: 'd', code: 'KeyD', ctrlKey: true })).toBe(false);
		expect(await c.reachesCanvas({ key: 'G', code: 'KeyG', ctrlKey: true, shiftKey: true })).toBe(true);
		expect(c.readSidecar(assetId)).toEqual(before);
	});

	// Steps 7c and 39 — the delete half below IS step 39's walk: hidden, selected, Inspector Delete, Undo.
	desktop("lets the Inspector's own Duplicate and Delete act on a hidden selected rectangle, which an Undo brings back shown", async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, ids, middle } = await hiddenAndSelected(c, 'Hidden inspector');
		const inspector = (name: string) => c.designer().$(`.rp-designer-inspector button[name="${name}"]`);

		await inspector('duplicate').click();
		await expect.poll(() => c.details(assetId).length).toBe(4);
		const copy = c.details(assetId).map((d) => d.id).find((id) => !ids.includes(id)) as string;
		// A finding, pinned: the copy is a NEW id, which no hidden set names, so it is DRAWN and
		// selected — not "itself hidden" as the row expects. The original stays hidden.
		expect(await c.drawn()).toEqual([...ids.filter((id) => id !== middle), copy].toSorted());
		expect(await c.pressedRows()).toEqual([`detail:${copy}`]);
		expect(await c.marksOf(middle)).toEqual(['Hidden']);
		expect(await c.marksOf(copy)).toEqual([]);
		await c.undoTo(assetId, ids);

		await c.row(middle).click();
		expect(await c.marksOf(middle)).toEqual(['Hidden']);
		await inspector('delete').click();
		await expect.poll(() => c.details(assetId).map((d) => d.id)).toEqual(ids.filter((id) => id !== middle));
		await c.undoTo(assetId, ids);
		// Step 39's outcome, and a finding against 7c: the undone delete brings it back SHOWN (the
		// pruned leaf-local set has no way back), not "still hidden" as row 7c expects.
		await expect.poll(c.drawn).toEqual(ids.toSorted());
		expect(await c.marksOf(middle)).toEqual([]);
	});

	// Steps 7e and 7f.
	desktop('restores every door once the rectangle is shown, and bands and frames only a drawn one', async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, middle } = await hiddenAndSelected(c, 'Hidden restored');
		const outline = () => c.details(assetId).find((d) => d.id === middle)?.outline.points;

		// Step 7f, hidden: no band on either ruler, and Shift+2 leaves the camera where it was.
		expect(await c.rulerBands()).toBe(0);
		const framed = await c.camera();
		await c.onCanvas(['Shift', '2']);
		await browser.pause(500);
		expect(await c.camera()).toBe(framed);

		// Step 7e: shown again, the arrow moves it (one write, undone) and its row opens the menu.
		await c.control(middle, 'toggle-hidden').click();
		await expect.poll(c.drawn).toContain(middle);
		const before = outline();
		const revision = c.readSidecar(assetId).revision;
		await c.focusCanvas();
		await c.keyPress('ArrowRight');
		await expect.poll(() => c.readSidecar(assetId).revision).toBe(revision + 1);
		expect(outline()).not.toEqual(before);
		await c.undoButton().click();
		await expect.poll(outline).toEqual(before);
		await c.rightClick(c.row(middle));
		await expect.poll(() => c.menu().isDisplayed()).toBe(true);
		expect(await c.menuItems()).toContainEqual({ id: 'delete', disabled: false });
		await browser.keys('Escape');
		await expect.poll(() => c.menu().isExisting()).toBe(false);

		// Step 7f, shown: both rulers band it, and Shift+2 moves the camera onto it.
		await expect.poll(c.rulerBands).toBe(2);
		await c.onCanvas(['Shift', '2']);
		await expect.poll(c.camera).not.toBe(framed);
	});
});

describe('Compose an asset from parts: what the Parts panel leaves behind, in the real Obsidian host', () => {
	// Step 8.
	desktop('forgets every hide and lock once the tab is closed, having written nothing', async ({ native: { browser, page, ui } }) => {
		const c = createComposer(browser, page, ui);
		const { assetId, ids } = await c.createAssetA('Leaf-local aids');
		const [first, second] = ids as [string, string];
		const before = c.readSidecar(assetId);
		await c.row(first).click();
		await c.control(first, 'toggle-hidden').click();
		await c.row(second).click();
		await c.control(second, 'toggle-locked').click();
		await expect.poll(() => c.marksOf(first)).toEqual(['Hidden']);
		expect(await c.marksOf(second)).toEqual(['Locked']);
		await expect.poll(c.drawn).toEqual(ids.filter((id) => id !== first).toSorted());

		await c.closeDesigner();
		await c.openDesignerFor('Leaf-local aids');
		await expect.poll(c.drawn).toEqual(ids.toSorted());
		expect(await c.allMarks()).toEqual([]);
		expect(c.readSidecar(assetId)).toEqual(before);
	});

	// Step 38.
	desktop('keeps the group, the label and every repeated copy across a plugin reload', async ({ native: { browser, page, ui } }) => {
		const c = createComposer(browser, page, ui);
		const { assetId, ids } = await c.createAssetA('Reloaded composition');
		const [first, second, third] = ids as [string, string, string];
		await c.row(first).click();
		await c.designer().$(`li[data-key="detail:${first}"] input[name="part-label"]`).setValue('Left leg');
		await browser.keys('Tab');
		await expect.poll(() => c.details(assetId).find((d) => d.id === first)).toMatchObject({ label: 'Left leg' });
		await c.row(first).click();
		await c.shiftClick(c.row(second));
		await c.shiftClick(c.row(third));
		// The Arrange block's Group, not Ctrl+G: the host takes that chord (composeGroupDoors.e2e.ts).
		await c.arrangeGroup().click();
		await expect.poll(() => c.groups(assetId).length).toBe(1);
		await c.designer().$('.rp-designer-arrange details:has(input[name="repeat-count"]) > summary').click();
		await c.designer().$('input[name="repeat-count"]').setValue('3');
		await c.designer().$('input[name="repeat-spacing"]').setValue('100');
		await browser.pause(250);
		await c.designer().$('button[name="repeat-run"]').click();
		await expect.poll(() => c.details(assetId).length).toBeGreaterThan(3);
		const saved = c.readSidecar(assetId);

		await page.disablePlugin('renovation-planner');
		await page.enablePlugin('renovation-planner');
		await c.openDesignerFor('Reloaded composition');
		expect(c.readSidecar(assetId)).toEqual(saved);
		// Repeat copies the group with its members, so there is one group row per group written.
		expect(c.groups(assetId).length).toBeGreaterThan(1);
		await expect.poll(() => c.designer().$$('.rp-designer-part[data-kind="group"]').length).toBe(c.groups(assetId).length);
		expect(await c.row(first).getText()).toContain('Left leg');
		expect(await c.drawn()).toEqual(saved.shape?.details.map((d) => d.id).toSorted());
		const messages = await c.consoleMessages();
		expect(messages.filter((message) => message.includes('Several Konva instances'))).toEqual([]);
	});
});
