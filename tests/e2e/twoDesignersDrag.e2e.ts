import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER } from './designer';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Two designers on one asset.md` step 1's last gesture: dragging the designer's
 * tab into a new split. WebDriver's pointer actions do not start an HTML5 drag in Chromium, so the
 * drag is the sequence of `DragEvent`s a real one produces — `dragstart` on the tab header, then
 * `dragover` and `drop` at the drop point — dispatched by script. Obsidian's tab drag reads none of
 * `isTrusted`, so its own handlers (`workspace.onDragLeaf`, read in 1.13.7) run as they do for a hand drag;
 * what is NOT exercised is the operating system's drag loop that produces those events.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The designer's tab header dragged to the right edge of the tab group it sits in, as the renderer would deliver it. */
const dragTabRight = (browser: NativeBrowser) =>
	browser.execute(() => {
		const header = document.querySelector<HTMLElement>('.workspace-tab-header[data-type="renovation-asset-designer"]');
		const group = header?.closest('.workspace-tabs')?.getBoundingClientRect();
		if (!header || !group) throw new Error('No designer tab header.');
		const from = header.getBoundingClientRect();
		const to = { x: group.right - 20, y: group.top + group.height / 2 };
		const data = new DataTransfer();
		const fire = (type: string, target: Element, x: number, y: number) =>
			target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data, clientX: x, clientY: y }));
		fire('dragstart', header, from.left + from.width / 2, from.top + from.height / 2);
		const over = document.elementFromPoint(to.x, to.y) ?? document.body;
		fire('dragenter', over, to.x, to.y);
		fire('dragover', over, to.x, to.y);
		fire('drop', over, to.x, to.y);
		fire('dragend', header, to.x, to.y);
	});

/** Every root leaf's view type, grouped by the tab group that holds it. */
const tabGroups = (browser: NativeBrowser) =>
	browser.executeObsidian(({ app }) => {
		const groups = new Map<unknown, string[]>();
		app.workspace.iterateRootLeaves((leaf) => {
			const parent = (leaf as unknown as { parent: unknown }).parent;
			groups.set(parent, [...(groups.get(parent) ?? []), leaf.view.getViewType()]);
		});
		return [...groups.values()];
	});

describe('Two designers on one asset, the tab drag in the real Obsidian host', () => {
	// Step 1, "dragging the tab into a new split".
	desktop('moves the one designer into a new split when its tab is dragged there, and never duplicates it', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Dragged toilet');
		await designer.applyPreset('toilet');
		const before = await tabGroups(browser);
		console.log(`step 1 before ${JSON.stringify(before)}`);
		expect(before).toEqual([expect.arrayContaining(['renovation-project', DESIGNER])]);

		await dragTabRight(browser);
		await expect.poll(() => tabGroups(browser)).toHaveLength(2);
		const after = await tabGroups(browser);
		console.log(`step 1 after ${JSON.stringify(after)}`);
		expect(after.at(-1)).toEqual([DESIGNER]);
		// Split to the RIGHT of the group it left, where the drop was.
		const [project, dragged] = await browser.execute(() =>
			['renovation-project', 'renovation-asset-designer'].map((type) => document.querySelector(`.workspace-tab-header[data-type="${type}"]`)?.closest('.workspace-tabs')?.getBoundingClientRect().toJSON() as DOMRect),
		);
		expect(dragged.left).toBeGreaterThanOrEqual(project.right - 1);
		expect(await designer.leafStates(DESIGNER)).toEqual([{ assetId }]);
		await expect.poll(() => designer.designer().$('.rp-designer-asset-name').getText()).toBe('Dragged toilet');
	});
});
