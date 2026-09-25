import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, PLAN_EDITOR } from './designer';
import { createCanvasPage } from './designerCanvas';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Design an Asset.md` steps 44, 45 and 49: the two that start from a plain
 * item on a plan and end in the designer, and the one that asks whether the designer's View
 * choices stay out of the Plan Editor's. The designer draws nothing on mobile.
 */
const desktop = mobileEmulation ? test.skip : test;

interface PlanElement {
	kind: string;
	assetId?: string;
	points: { x: number; y: number }[];
}

describe('Design an Asset, between a plan and the designer in the real Obsidian host', () => {
	// Steps 44 and 45: a plain rectangle item promoted, then opened in the designer.
	desktop('promotes a Cabinet item into a placement with its exact outline and opens it measured in the designer', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await ui.createProjectWithPlan('Flat', 'Ground floor');
		const plan = () => ui.leaf(PLAN_EDITOR);
		const elements = () =>
			browser.executeObsidian(async ({ app }) => {
				const file = app.vault.getFiles().find((candidate) => candidate.path.startsWith('Renovation/Flat/Geometry/') && candidate.extension === 'rpgeo');
				if (!file) return [];
				// A plan's sidecar carries no `structure` until its first structural write.
				return (JSON.parse(await app.vault.read(file)) as { structure?: { elements?: PlanElement[] } }).structure?.elements ?? [];
			});

		// Add an item to the asset library, steps 1 to 8: a typed rectangle — the plan reads metres.
		await plan().$('button[aria-label="Add"]').click();
		await plan().$('.rp-add-menu__item[data-rp-entry="item"]').click();
		await plan().$('input[name="element-name"]').setValue('Cabinet');
		for (const [field, value] of [['object-x', '0'], ['object-y', '0'], ['object-width', '0.6'], ['object-depth', '0.4']]) {
			await plan().$(`input[name="${field}"]`).setValue(value);
		}
		await browser.pause(250);
		await plan().$('button=Apply rectangle').click();
		// The drawer's own Finish: the task banner's sits under the drawer at this leaf width.
		const finish = (await plan().$$('button=Finish').getElements()).at(-1);
		if (!finish) throw new Error('No Finish button.');
		await finish.click();
		await expect.poll(async () => (await elements()).map((element) => element.kind)).toEqual(['object']);
		const [item] = await elements();

		const target = await plan().$('.rp-plan-canvas');
		const size = await target.getSize();
		const at = await target.getLocation();
		await browser.action('pointer').move({ x: Math.round(at.x + size.width / 2), y: Math.round(at.y + size.height / 2), origin: 'viewport' }).down({ button: 2 }).up({ button: 2 }).perform();
		await browser.$('[role="menuitem"]*=Add to asset library').click();
		await expect.poll(() => browser.$('.rp-dialog').isDisplayed()).toBe(true);
		expect(await browser.$('.rp-dialog [data-field="name"]').getValue()).toBe('Cabinet');
		expect(await browser.$('.rp-new-asset__outline').getText()).toContain('600 × 400 mm');
		expect(await browser.$('.rp-dialog [data-field="width"]').isExisting()).toBe(false);
		await browser.$('.rp-dialog [data-field="unitCostAmount"]').setValue('120');
		await browser.pause(250);
		await browser.$('.rp-dialog button[type="submit"]').click();
		await expect.poll(() => browser.$('.rp-dialog').isExisting()).toBe(false);

		// Step 44: the item is a placement now, whose asset outline, put at its centre, is the item's.
		await expect.poll(async () => (await elements()).map((element) => element.kind)).toEqual(['asset']);
		const [placement] = await elements();
		const assetId = placement.assetId ?? '';
		const footprint = designer.readSidecar(assetId).shape?.footprint.points ?? [];
		const centre = placement.points[0];
		expect(footprint.map(([x, y]) => ({ x: x + centre.x, y: y + centre.y }))).toEqual(item.points);
		// Facing 0: the second point sits straight along +x from the first.
		expect(placement.points[1].y).toBe(centre.y);
		expect(placement.points[1].x).toBeGreaterThan(centre.x);
		const open = plan().$('button=Open in designer');
		expect(await open.isDisplayed()).toBe(true);

		// Step 45: the designer on Cabinet, footprint drawn and measured, no details, no warning.
		await open.click();
		await expect.poll(() => designer.designer().isDisplayed()).toBe(true);
		expect(await designer.openAssetId()).toBe(assetId);
		expect(await designer.designer().$('.rp-designer-asset-name').getText()).toBe('Cabinet');
		await expect.poll(() => canvas.shapeBoxes('asset-footprint-outline')).toHaveLength(1);
		expect(designer.readSidecar(assetId).shape?.details).toEqual([]);
		await expect.poll(async () => (await canvas.labels()).map((label) => label.text)).toEqual(['600 mm', '400 mm']);
		expect(await designer.designer().$('.rp-designer-inspector').getText()).not.toContain('before a scale existed');
	});

	// Step 49: the designer's View choices live in their own device slot.
	desktop("remembers the designer's grid and snap choice for the next asset and leaves the Plan Editor's alone", async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const canvas = createCanvasPage(browser, designer);
		await designer.createToilet('First toilet');
		expect(await canvas.viewTicked('snap')).toBe(true);
		await canvas.viewToggle('grid');
		await canvas.viewToggle('snap');
		expect(await canvas.viewTicked('snap')).toBe(false);
		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);

		await designer.createToilet('Second toilet');
		expect(await canvas.viewTicked('grid')).toBe(true);
		expect(await canvas.viewTicked('snap')).toBe(false);

		await ui.createProjectWithPlan('Flat', 'Ground floor');
		const menu = ui.leaf(PLAN_EDITOR).$('.rp-view-menu');
		await menu.$('summary').click();
		expect(await menu.$('input[data-rp-view="snap"]').isSelected()).toBe(true);
		expect(await menu.$('input[data-rp-view="grid"]').isSelected()).toBe(false);
	});
});
