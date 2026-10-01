import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, LIBRARY, PLAN_EDITOR, type DesignerPage } from './designer';
import type { PlannerPage } from './helpers';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Take an asset from the library into a plan.md`: the three doors between the
 * library, the designer and the plan, walked in a real host — the hand-off's picker, banner and
 * Continue context, the duplicate that touches no plan, and the mobile gate that keeps both
 * commands out of the palette while a leaf restored there still refuses.
 */
const desktop = mobileEmulation ? test.skip : test;
const mobile = mobileEmulation ? test : test.skip;

const BANNER = 'Click the plan to place a copy; near a wall it turns to face the room. Esc stops placing.';

/** A project with one plan and its editor open, then a toilet asset pressing Use in plan. */
const handOff = async (ui: PlannerPage, designer: DesignerPage): Promise<string> => {
	await ui.createProjectWithPlan('Flat', 'Ground floor');
	const assetId = await designer.createToilet('Oven');
	await designer.designer().$('.rp-designer-use-plan').click();
	await expect.poll(() => ui.leaf(PLAN_EDITOR).$('.rp-task-banner').isExisting()).toBe(true);
	return assetId;
};

describe('Take an asset from the library into a plan, in the real Obsidian host', () => {
	// Step 18: no plans anywhere.
	desktop('says so rather than opening an empty picker, in a vault with assets and no plans', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		await designer.createAsset('Oven');
		await designer.applyPreset('toilet');
		await designer.designer().$('.rp-designer-use-plan').click();
		await expect.poll(designer.notices).toContain('This vault has no renovation plans yet.');
		expect(await browser.$('.prompt').isExisting()).toBe(false);
		expect(await designer.leafStates(PLAN_EDITOR)).toEqual([]);
	});

	// Steps 14, 19, 15, 16 and 17: one plan, then two, then a dismissed pick, then a double press.
	desktop('arms the one open plan without asking, asks between two, and records where it went', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await handOff(ui, designer);
		// Step 14: no picker; the Plan Editor comes forward, armed, and a click places THIS asset.
		expect(await browser.$('.prompt').isExisting()).toBe(false);
		expect(await ui.leaf(PLAN_EDITOR).isDisplayed()).toBe(true);
		expect(await ui.leaf(PLAN_EDITOR).$('.rp-task-banner').getText()).toContain(BANNER);
		await designer.clickPlanCentre();
		const planGeometry = () => {
			const dir = path.join(page.getVaultPath(), 'Renovation/Flat/Geometry');
			return readdirSync(dir).map((file) => readFileSync(path.join(dir, file), 'utf8')).join('\n');
		};
		await expect.poll(planGeometry).toContain(assetId);

		// Step 19: the hand-off fed the launcher.
		await ui.openProjectView();
		await expect.poll(() => ui.projectView().$('.rp-continue__plan').getText()).toBe('Ground floor');
		expect(await ui.projectView().$('.rp-continue__project').getText()).toBe('Flat');

		// Step 15: a second plan makes the question real.
		await ui.projectView().$('.rp-project-row').click();
		await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Flat');
		await ui.projectView().$('.rp-plan-list__create').click();
		await ui.submitForm('First floor');
		await expect.poll(() => ui.projectView().$$('.rp-plan-list__row').length).toBe(2);
		// By name: the list sorts, and "First floor" lands ahead of the plan already open.
		await ui.projectView().$('.rp-plan-list__row*=First floor').click();
		await expect.poll(() => designer.leafStates(PLAN_EDITOR)).toHaveLength(2);
		await ui.activate(DESIGNER);
		await designer.designer().$('.rp-designer-use-plan').click();
		await expect.poll(() => browser.$('.prompt').isDisplayed()).toBe(true);
		expect(await browser.$$('.prompt .suggestion-item').map((item) => item.getText())).toEqual(expect.arrayContaining([expect.stringContaining('Ground floor'), expect.stringContaining('First floor')]));

		// Step 16: a dismissed pick arms nothing, and the next press asks again.
		await browser.keys('Escape');
		await expect.poll(() => browser.$('.prompt').isExisting()).toBe(false);
		expect(await designer.leafStates(PLAN_EDITOR)).toHaveLength(2);
		await designer.designer().$('.rp-designer-use-plan').click();
		await expect.poll(() => browser.$('.prompt').isDisplayed()).toBe(true);
		await browser.keys('Escape');
		await expect.poll(() => browser.$('.prompt').isExisting()).toBe(false);

		// Step 17: two presses in one tick open exactly one picker.
		const button = designer.designer().$('.rp-designer-use-plan');
		await browser.execute((el: HTMLElement) => {
			el.click();
			el.click();
		}, await button.getElement());
		await expect.poll(() => browser.$$('.prompt').length).toBe(1);
		await browser.pause(500);
		expect(await browser.$$('.prompt').length).toBe(1);
		await browser.keys('Escape');
	});

	// Steps 9 and 10: a duplicate is a new definition, and the original moved nowhere.
	desktop('duplicates an asset into a new note without touching the original or its placements', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Oven');
		await designer.applyPreset('toilet');
		const original = designer.readSidecar(assetId);

		await ui.command('open-asset-library');
		await ui.activate(LIBRARY);
		const library = () => ui.leaf(LIBRARY);
		await library().$('.rp-al-shelf__head[aria-expanded="false"]').click();
		await library().$('.rp-al-row').click();
		await expect.poll(() => library().$('.rp-al-inspector__name').getText()).toBe('Oven');
		await library().$('[data-action="duplicate-open"]').click();
		// The inspector's own edit form shares the class; the panel is the one under its heading.
		const panel = () => library().$('//form[contains(@class, "rp-al-definition")][.//h4[normalize-space(.) = "Duplicate as new asset"]]');
		await expect.poll(() => panel().$('.rp-al-fields__input').getValue()).toBe('Oven (copy)');
		expect(await panel().$('.rp-al-note').getText()).toContain('Plans that place this asset keep the original.');
		await panel().$('button[type="submit"]').click();

		await expect.poll(() => ui.notesOfType('renovation-asset')).toEqual({
			'Renovation/Library/Assets/Oven.md': expect.objectContaining({ id: assetId }),
			'Renovation/Library/Assets/Oven (copy).md': expect.objectContaining({ name: 'Oven (copy)' }),
		});
		expect(await library().$('.rp-al-inspector__name').getText()).toBe('Oven');
		expect(designer.readSidecar(assetId)).toEqual(original);
		const copyId = Object.values(await ui.notesOfType('renovation-asset')).find((note) => note.name === 'Oven (copy)')?.id as string;
		expect(designer.readSidecar(copyId).shape).toEqual(original.shape);
		expect(designer.readSidecar(copyId).assetId).toBe(copyId);
	});

	// Steps 20, 21 and 22: the door back from a placed asset, one leaf for two presses.
	desktop('opens the designer from a placed asset, and gives two fast presses one leaf', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await handOff(ui, designer);
		const centre = await designer.clickPlanCentre();
		await browser.pause(800);
		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);

		// Select the placement: Escape the placing task, then click where it landed.
		await browser.keys('Escape');
		await browser.action('pointer').move({ ...centre, origin: 'viewport' }).down().up().perform();
		const door = ui.leaf(PLAN_EDITOR).$('[data-rp-action="open-asset-designer"]');
		await expect.poll(() => door.isExisting()).toBe(true);
		await browser.execute((el: HTMLElement) => {
			el.click();
			el.click();
		}, await door.getElement());
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([{ assetId }]);
		await browser.pause(800);
		expect(await designer.leafStates(DESIGNER)).toEqual([{ assetId }]);
	});

	// Steps 24 and 27: the palette gate, both sides.
	mobile('keeps both commands out of the palette on mobile', async ({ native: { browser } }) => {
		const gate = () =>
			browser.executeObsidian(({ app }) => {
				const commands = (app as unknown as { commands: { commands: Record<string, { checkCallback?: (checking: boolean) => boolean }> } }).commands.commands;
				return ['renovation-planner:open-asset-library', 'renovation-planner:open-asset-designer'].map((id) => commands[id]?.checkCallback?.(true) ?? 'no checkCallback');
			});
		expect(await gate()).toEqual([false, false]);
	});
	desktop('lists both commands in the palette on the desktop', async ({ native: { browser } }) => {
		const names = await browser.executeObsidian(({ app }) => {
			const commands = (app as unknown as { commands: { commands: Record<string, { name: string; checkCallback?: (checking: boolean) => boolean }> } }).commands.commands;
			return ['renovation-planner:open-asset-library', 'renovation-planner:open-asset-designer'].map((id) => [commands[id]?.name, commands[id]?.checkCallback?.(true)]);
		});
		expect(names).toEqual([
			['Renovation Planner: Open asset library', true],
			['Renovation Planner: Open asset designer', true],
		]);
	});

	// Step 25: the deliberately ungated button, and the view's own refusal behind it.
	mobile('opens a library leaf that refuses, from the project view button, rather than nothing', async ({ native: { ui } }) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-view-aside__open-library').click();
		await ui.activate(LIBRARY);
		const library = ui.leaf(LIBRARY);
		await expect.poll(() => library.getText()).toContain('desktop');
		expect(await library.$('.rp-al-shelf').isExisting()).toBe(false);
	});
});
