import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createComposer } from './compose';
import { DESIGNER } from './designer';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Compose an asset from parts.md`, steps 40 to 53: building a set from the Parts
 * rows, grouping it from every door under Select and under Pan, and what a Parts-hidden member of
 * the set refuses. The fixture is the case's asset A, three rectangles drawn by hand.
 *
 * **Ctrl+G never reaches the designer in a real Obsidian**, which reshapes steps 43, 49, 49a and 51:
 * the host's own Mod+G (`graph:open`) runs first and stops the event before its target phase, so the
 * canvas's and the rows' `@keydown` never see it (`reachesCanvas`). Those cases pin what the host does.
 *
 * The designer draws nothing on mobile (`AssetDesignerView.sync`), so the whole file is desktop.
 */
const desktop = mobileEmulation ? test.skip : test;

type Composer = ReturnType<typeof createComposer>;

/** Asset A, and its first two rectangles selected through their rows — the second one focused. */
async function twoSelected(c: Composer, name: string): Promise<{ assetId: string; ids: string[]; first: string; second: string }> {
	const { assetId, ids } = await c.createAssetA(name);
	const [first, second] = ids as [string, string];
	await c.row(first).click();
	await c.shiftClick(c.row(second));
	await expect.poll(c.pressedRows).toEqual([`detail:${second}`, `detail:${first}`]);
	return { assetId, ids, first, second };
}

/** Reselect the pair through its rows, as each door below starts from "selected, ungrouped". */
async function reselect(c: Composer, first: string, second: string): Promise<void> {
	await c.row(first).click();
	await c.shiftClick(c.row(second));
	await expect.poll(c.pressedRows).toEqual([`detail:${second}`, `detail:${first}`]);
}

describe('Compose an asset from parts: grouping from every door, in the real Obsidian host', () => {
	// Steps 40, 41 and 42.
	desktop('extends the selection from a row under Shift or the Select multiple parts toggle, and takes a member back out', async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { ids, first, second } = await twoSelected(c, 'Row selection');
		await c.shiftClick(c.row(second));
		await expect.poll(c.pressedRows).toEqual([`detail:${first}`]);

		const third = ids[2] as string;
		await c.designer().$('input[data-rp-action="multiple-selection"]').click();
		await c.row(second).click();
		await c.row(third).click();
		await expect.poll(c.pressedRows).toEqual([`detail:${third}`, `detail:${second}`, `detail:${first}`]);
	});

	// Steps 43, 49 and 49a: the keyboard doors, which the host takes.
	desktop("hands Ctrl+G to Obsidian's graph view from the canvas and from a row, at rest and under Pan", async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, first, second } = await twoSelected(c, 'Graph chord');
		// Step 43's "freshly opened": the designer reopened, resting in Select with nothing chosen.
		await c.closeDesigner();
		await c.openDesignerFor('Graph chord');
		expect(await c.tool('Select').getAttribute('aria-pressed')).toBe('true');
		await reselect(c, first, second);
		await c.recordCommands();
		const graphLeaves = () => ui.leafCount('graph');

		await c.onCanvas(['Control', 'g']);
		await expect.poll(graphLeaves).toBe(1);
		expect(c.groups(assetId)).toEqual([]);

		await c.activate(DESIGNER);
		await c.tool('Pan').click();
		await reselect(c, first, second);
		expect(await c.reachesCanvas({ key: 'g', code: 'KeyG', ctrlKey: true })).toBe(false);
		await c.onCanvas(['Control', 'g']);
		await browser.pause(500);
		expect(c.groups(assetId)).toEqual([]);

		// Step 49's row half, and 49a's record: focus on a selected row, and the chord leaves the
		// designer altogether — the graph leaf is the active one and holds focus.
		await c.activate(DESIGNER);
		await reselect(c, first, second);
		expect(await c.focusTarget()).toBe(`row detail:${second}`);
		await browser.keys(['Control', 'g']);
		await browser.pause(500);
		expect(c.groups(assetId)).toEqual([]);
		expect(await browser.executeObsidian(({ app }) => app.workspace.getMostRecentLeaf()?.view.getViewType())).toBe('graph');
		expect(await c.focusTarget()).not.toMatch(/^row |^canvas$/);
		// Three real chords and the synthetic probe: every one of them ran the host's command.
		expect(await c.commandLog()).toEqual(['graph:open', 'graph:open', 'graph:open', 'graph:open']);
	});

	// Steps 44, 45, 46, 47 and 48: the Arrange button and both menu doors under Pan.
	desktop('groups under Pan from the Arrange button, the canvas menu and the row menu, and leaves focus on the row', async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, first, second } = await twoSelected(c, 'Pan doors');
		const grouped = () => c.groups(assetId).map((group) => group.members.toSorted());
		const undoGroup = async (): Promise<void> => {
			await c.undoButton().click();
			await expect.poll(grouped).toEqual([]);
		};
		await c.tool('Pan').click();
		await reselect(c, first, second);

		await c.arrangeGroup().click();
		await expect.poll(grouped).toEqual([[first, second].toSorted()]);
		await undoGroup();

		/** One context-menu door: the pair reselected, the menu opened by `open`, Group pressed. */
		const groupFromMenu = async (open: () => Promise<void>): Promise<void> => {
			await reselect(c, first, second);
			await open();
			await expect.poll(() => c.menu().isDisplayed()).toBe(true);
			expect((await c.menuItems()).map((item) => item.id)).toEqual(['group', 'ungroup', 'duplicate', 'delete']);
			await c.menu().$('[data-rp-context-action="group"]').click();
			await expect.poll(grouped).toEqual([[first, second].toSorted()]);
		};
		// Steps 45 and 46: a right-click on a SELECTED graphic on the canvas, under Pan.
		await groupFromMenu(async () => c.rightClickAt(await c.pointOn(second)));
		await undoGroup();
		// Steps 47 and 48: a right-click on one of their own rows.
		await groupFromMenu(() => c.rightClick(c.row(first)));
		// A finding, pinned: the row that opened the menu survives being re-nested under the group,
		// so `close()` hands focus back to it and nothing is ever dropped for `runAndRefocus` to move
		// to the canvas. Step 48 expects the canvas.
		await browser.pause(500);
		expect(await c.focusTarget()).toBe(`row detail:${first}`);
		expect(await c.designer().$(`.rp-designer-part--nested .rp-designer-part-row[name="detail:${first}"]`).isExisting()).toBe(true);
	});

	// Step 50.
	desktop('opens no menu for a right-click while a pan is still dragging', async ({ native: { browser, page, ui } }) => {
		const c = createComposer(browser, page, ui);
		const { second } = await twoSelected(c, 'Held pan');
		await c.tool('Pan').click();
		const at = await c.pointOn(second);
		const camera = await c.camera();
		await browser
			.action('pointer')
			.move({ ...at, origin: 'viewport' })
			.down({ button: 0 })
			.move({ x: at.x + 60, y: at.y + 20, duration: 200, origin: 'viewport' })
			.down({ button: 2 })
			.up({ button: 2 })
			.up({ button: 0 })
			.perform();
		expect(await c.camera()).not.toBe(camera);
		await browser.pause(300);
		expect(await c.menu().isExisting()).toBe(false);
		// The control: the same right-click with no pan in flight opens it.
		await c.rightClickAt(await c.pointOn(second));
		await expect.poll(() => c.menu().isDisplayed()).toBe(true);
	});
});

describe('Compose an asset from parts: a set with a hidden member, in the real Obsidian host', () => {
	// Steps 51, 52 and 53.
	desktop('refuses Group over a hidden member, deletes only a drawn focused one, and nothing once the focused one is hidden', async ({
		native: { browser, page, ui },
	}) => {
		const c = createComposer(browser, page, ui);
		const { assetId, ids, first, second } = await twoSelected(c, 'Hidden member');
		await c.control(first, 'toggle-hidden').click();
		await expect.poll(() => c.marksOf(first)).toEqual(['Hidden']);
		const before = c.readSidecar(assetId);

		// Step 51: the chord is the host's (no group, the graph opens); the menu greys Group.
		await c.onCanvas(['Control', 'g']);
		await expect.poll(() => ui.leafCount('graph')).toBe(1);
		expect(c.readSidecar(assetId)).toEqual(before);
		await c.activate(DESIGNER);
		await expect.poll(c.pressedRows).toEqual([`detail:${second}`, `detail:${first}`]);
		await c.rightClick(c.row(second));
		await expect.poll(() => c.menu().isDisplayed()).toBe(true);
		expect(await c.menuItems()).toEqual([
			{ id: 'group', disabled: true },
			{ id: 'ungroup', disabled: true },
			{ id: 'duplicate', disabled: false },
			{ id: 'delete', disabled: false },
		]);
		await browser.keys('Escape');
		await expect.poll(() => c.menu().isExisting()).toBe(false);

		// Step 52: Delete takes the drawn, focused member alone.
		await c.onCanvas('Delete');
		await expect.poll(() => c.details(assetId).map((d) => d.id)).toEqual(ids.filter((id) => id !== second));
		expect(await c.marksOf(first)).toEqual(['Hidden']);
		await c.undoTo(assetId, ids);

		// Step 53: the focused member hidden instead, its partner shown — Delete does nothing.
		await reselect(c, first, second);
		await c.control(first, 'toggle-hidden').click();
		await c.control(second, 'toggle-hidden').click();
		await expect.poll(() => c.marksOf(second)).toEqual(['Hidden']);
		expect(await c.marksOf(first)).toEqual([]);
		const shown = c.readSidecar(assetId);
		await c.onCanvas('Delete');
		await browser.pause(750);
		expect(c.readSidecar(assetId)).toEqual(shown);
	});
});
