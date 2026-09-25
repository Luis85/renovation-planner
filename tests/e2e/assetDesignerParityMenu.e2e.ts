import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, type DesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';
import { createParityPage, type ParityPage } from './designerParity';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the parity round's part menu and its chords (steps 89 to
 * 97): the menu a right-click, a Parts row and Shift+F10 open; the parts it is withheld over; and
 * Ctrl+G / Ctrl+Shift+G from the canvas and from a Parts row — including what the HOST does with a
 * Ctrl+G, read three ways: which of two listeners on `window` (capture and bubble phase) the chord
 * reaches, whether it arrives default-prevented, and whether Obsidian's own graph view (bound to
 * Ctrl+G by default) opens. Measured: the host's keymap takes Ctrl+G at `window` capture BEFORE the
 * designer, so with that binding in place no Ctrl+G groups anything; the cases pin that, then take
 * the binding away in the copied vault to reach the designer's own handling.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The menu as a user reads it, on Windows: each item and its shortcut, and one separator. */
const MENU = ['Group | Ctrl+G', 'Ungroup | Ctrl+Shift+G', '---', 'Duplicate | Ctrl+D', 'Delete | Del'];
const TANK = 'detail:detail-1';
const BOWL_ROW = 'detail:detail-2';

interface Fixture { designer: DesignerPage; parity: ParityPage; assetId: string; rect: string }

/** Asset Y as the section builds it: the toilet preset, then one drawn rectangle — three graphics. */
async function assetY(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string): Promise<Fixture> {
	const designer = createDesignerPage(browser, page, ui);
	const parity = createParityPage(browser, designer);
	const assetId = await designer.createAsset(name);
	await designer.applyPreset('toilet');
	await parity.drawBox('Draw rectangle', [0.2, 0.2], [0.3, 0.3]);
	const sidecar = await parity.settle(assetId, 2);
	const rect = sidecar.shape?.details.at(-1)?.id;
	if (!rect) throw new Error('No drawn rectangle.');
	await parity.watchChords();
	return { designer, parity, assetId, rect };
}

const row = (designer: DesignerPage, key: string) => designer.designer().$(`.rp-designer-part-row[name="${key}"]`);
const groups = (designer: DesignerPage, assetId: string) => (designer.readSidecar(assetId).shape as { groups?: unknown[] } | null)?.groups?.length ?? 0;

async function rowCentre(designer: DesignerPage, key: string): Promise<{ x: number; y: number }> {
	const at = await row(designer, key).getLocation();
	const size = await row(designer, key).getSize();
	return { x: at.x + size.width / 2, y: at.y + size.height / 2 };
}

/**
 * Select several parts: the first by a plain row click, which replaces whatever was selected, the
 * rest through the Parts panel's sticky multi-select checkbox. Focus ends on the last row clicked.
 */
async function selectRows(designer: DesignerPage, keys: string[]): Promise<void> {
	const toggle = designer.designer().$('input[data-rp-action="multiple-selection"]');
	if (await toggle.isSelected()) await toggle.click();
	const [first, ...rest] = keys;
	await row(designer, first ?? '').click();
	await toggle.click();
	for (const key of rest) await row(designer, key).click();
	await expect.poll(() => designer.designer().$('.rp-designer-selection-count').getText()).toBe(`${keys.length} parts selected`);
}

async function closeMenu(browser: NativeBrowser, parity: ParityPage): Promise<void> {
	await browser.keys('Escape');
	await expect.poll(() => parity.menu().isExisting()).toBe(false);
}

describe('Design an Asset, the parity round part menu, in the real Obsidian host', () => {
	// Steps 89, 90, 92, 93 and 97.
	desktop('opens one menu from the canvas, a Parts row and Shift+F10, and withholds it over every non-graphic', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, parity } = await assetY(browser, page, ui, 'Menu toilet');
		await designer.selectPart(TANK);

		// Step 89: the canvas's right-click on the selected tank.
		const tank = await designer.partCentre('detail-1');
		if (!tank) throw new Error('No drawn tank.');
		await parity.rightClick(tank);
		await expect.poll(parity.menuLines).toEqual(MENU);
		await closeMenu(browser, parity);

		// Step 90: the same part's Parts row.
		await parity.rightClick(await rowCentre(designer, TANK));
		await expect.poll(parity.menuLines).toEqual(MENU);
		await closeMenu(browser, parity);

		// Step 97: Shift+F10 with the canvas focused and the part selected.
		await designer.focusCanvas();
		await browser.keys(['Shift', 'F10']);
		await expect.poll(parity.menuLines).toEqual(MENU);
		await closeMenu(browser, parity);

		// Step 92: the footprint, the anchor dot and the facing arrow open nothing of the designer's.
		const [footprint] = await parity.marks('asset-footprint-outline');
		const [anchor] = await parity.marks('asset-anchor-mark');
		const [facing] = await parity.marks('asset-facing-head');
		if (!footprint || !anchor || !facing) throw new Error('A non-graphic part is not drawn.');
		for (const point of [
			{ x: footprint.x + 3, y: footprint.y + footprint.height * 0.6 },
			{ x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 },
			{ x: facing.x + facing.width / 2, y: facing.y + facing.height / 2 },
		]) {
			await parity.rightClick(point);
			await browser.pause(400);
			expect(await parity.menu().isExisting()).toBe(false);
			await browser.keys('Escape');
		}

		// Step 93: a dimension number, and its open field.
		await designer.selectPart(TANK);
		const figure = designer.designer().$('.rp-designer-dimension__value');
		const figureAt = await figure.getLocation();
		await parity.rightClick({ x: figureAt.x + 4, y: figureAt.y + 4 });
		await browser.pause(400);
		expect(await parity.menu().isExisting()).toBe(false);
		await browser.keys('Escape');
		await figure.click();
		const field = designer.designer().$('.rp-designer-dimension__form input');
		await expect.poll(() => field.isFocused()).toBe(true);
		const fieldAt = await field.getLocation();
		await parity.rightClick({ x: fieldAt.x + 4, y: fieldAt.y + 4 });
		await browser.pause(400);
		expect(await parity.menu().isExisting()).toBe(false);
	});

	// Steps 91, 95, 95a and 96.
	desktop("loses a canvas Ctrl+G to Obsidian's graph hotkey, groups once that is unbound, and deletes the right-clicked part alone", async ({
		native: { browser, page, ui },
	}) => {
		const { designer, parity, assetId, rect } = await assetY(browser, page, ui, 'Chorded toilet');
		// Obsidian's own binding in this vault, read rather than assumed.
		expect(await parity.hotkeysOf('graph:open')).toEqual(['Mod+G']);

		// Steps 95 and 95a, AS MEASURED: two graphics selected, the canvas focused, Ctrl+G. The host's
		// keymap takes the chord on `window` in the CAPTURE phase, before the designer's listener is
		// ever reached: it arrives there already default-prevented, never bubbles back, the graph
		// view opens, and nothing groups. Not "also fires alongside" — fires INSTEAD.
		await selectRows(designer, [TANK, BOWL_ROW]);
		await designer.focusCanvas();
		await parity.pressCtrlG();
		expect(await parity.chords()).toEqual(['capture:Ctrl+G:prevented']);
		await expect.poll(parity.graphLeaves).toBe(1);
		expect(groups(designer, assetId)).toBe(0);
		await ui.activate(DESIGNER);

		// Step 96: one part, Ctrl+G — nothing in the designer, and the host answers, as the row predicts.
		await designer.designer().$('input[data-rp-action="multiple-selection"]').click();
		await designer.selectPart(TANK);
		const revision = designer.readSidecar(assetId).revision;
		await designer.focusCanvas();
		await parity.pressCtrlG();
		expect(await parity.chords()).toEqual(['capture:Ctrl+G:prevented']);
		await expect.poll(parity.graphLeaves).toBe(2);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
		await ui.activate(DESIGNER);

		// Step 95's second half: grouped through the menu, Ctrl+Shift+G — which the host binds to
		// nothing — ungroups from the canvas, and is stopped there.
		await selectRows(designer, [TANK, BOWL_ROW]);
		const tank = await designer.partCentre('detail-1');
		if (!tank) throw new Error('No drawn tank.');
		await parity.rightClick(tank);
		await parity.menu().$('[data-rp-context-action="group"]').click();
		await expect.poll(() => groups(designer, assetId)).toBe(1);
		await designer.focusCanvas();
		await parity.pressCtrlG(true);
		await expect.poll(() => groups(designer, assetId)).toBe(0);
		expect(await parity.chords()).toEqual(['capture:Ctrl+Shift+G']);

		// Step 95's first half, with the host's binding taken away: the designer's own Ctrl+G groups.
		await parity.unbindHotkey('graph:open');
		await selectRows(designer, [TANK, BOWL_ROW]);
		await designer.focusCanvas();
		await parity.pressCtrlG();
		await expect.poll(() => groups(designer, assetId)).toBe(1);
		// Consumed by the designer this time: seen at capture, never bubbling, no third graph view.
		expect(await parity.chords()).toEqual(['capture:Ctrl+G']);
		expect(await parity.graphLeaves()).toBe(2);

		// Step 91: two selected, the third right-clicked and deleted — only the third goes.
		await designer.focusCanvas();
		await parity.pressCtrlG(true);
		await expect.poll(() => groups(designer, assetId)).toBe(0);
		const drawn = await designer.partCentre(rect);
		if (!drawn) throw new Error('No drawn rectangle.');
		await parity.rightClick(drawn);
		await expect.poll(parity.menuLines).toEqual(MENU);
		await parity.menu().$('[data-rp-context-action="delete"]').click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2']);
	});

	// Steps 90a, 90b, 94 and 96a.
	desktop('binds the chords on a Parts row, never inside its Label field, and refocuses the canvas after a row Delete', async ({
		native: { browser, page, ui },
	}) => {
		const { designer, parity, assetId, rect } = await assetY(browser, page, ui, 'Rowed toilet');

		// Step 96a: a row's menu by Shift+F10, closed by Escape — focus stays on the row, and the
		// Ctrl+G after it acts on nothing in the designer and is the host's: the graph view opens.
		await row(designer, TANK).click();
		await browser.keys(['Shift', 'F10']);
		await expect.poll(parity.menuLines).toEqual(MENU);
		await closeMenu(browser, parity);
		expect(await parity.focused()).toBe(`row:${TANK}`);
		const revision = designer.readSidecar(assetId).revision;
		await parity.pressCtrlG();
		expect(await parity.chords()).toEqual(['capture:Ctrl+G:prevented']);
		await expect.poll(parity.graphLeaves).toBe(1);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
		await ui.activate(DESIGNER);

		// Step 90b, AS MEASURED with the host's binding in place: nothing groups, but the graph view
		// opens and takes focus, so the field does NOT go on accepting text.
		await selectRows(designer, [TANK, BOWL_ROW]);
		const label = () => designer.designer().$(`.rp-designer-part[data-key="${BOWL_ROW}"] input[name="part-label"]`);
		await label().doubleClick();
		await browser.keys(['L', 'i', 'd']);
		await parity.pressCtrlG();
		await browser.keys(['X']);
		await expect.poll(parity.graphLeaves).toBe(2);
		expect(groups(designer, assetId)).toBe(0);
		await ui.activate(DESIGNER);
		expect(await label().getValue()).toBe('Lid');
		expect(await parity.chords()).toEqual(['capture:Ctrl+G:prevented']);

		// Step 90b as the row means it, the host's binding taken away: still nothing groups, and
		// the field keeps its focus and its typing.
		await parity.unbindHotkey('graph:open');
		await label().click();
		await browser.keys(['End']);
		await parity.pressCtrlG();
		await browser.keys(['X']);
		expect(await label().getValue()).toBe('LidX');
		expect(await label().isFocused()).toBe(true);
		expect(groups(designer, assetId)).toBe(0);
		// Left alone by the designer: the chord bubbles all the way back to `window`, not prevented.
		expect(await parity.chords()).toEqual(['capture:Ctrl+G', 'bubble:Ctrl+G']);

		// Step 90a: the same two, Ctrl+G and then Ctrl+Shift+G with focus on a Parts row.
		await selectRows(designer, [TANK, BOWL_ROW]);
		expect(await parity.focused()).toBe(`row:${BOWL_ROW}`);
		await parity.pressCtrlG();
		await expect.poll(() => groups(designer, assetId)).toBe(1);
		expect(await parity.focused()).toBe(`row:${BOWL_ROW}`);
		await parity.pressCtrlG(true);
		await expect.poll(() => groups(designer, assetId)).toBe(0);

		// Step 94: Delete from a row's own menu, and focus lands on the canvas.
		await parity.rightClick(await rowCentre(designer, `detail:${rect}`));
		await expect.poll(parity.menuLines).toEqual(MENU);
		await parity.menu().$('[data-rp-context-action="delete"]').click();
		await expect.poll(() => designer.readSidecar(assetId).shape?.details.length).toBe(2);
		expect(await parity.focused()).toBe('canvas');
	});
});

