import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect } from 'vitest';
import type { ChainablePromiseElement } from 'webdriverio';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, LIBRARY, PLAN_EDITOR, type DesignerPage } from './designer';
import type { PlannerPage } from './helpers';
import { mobileEmulation, PLUGIN_ID, type NativeBrowser } from './session';

/**
 * The second pass over `docs/tests/cases/Take an asset from the library into a plan.md`: the
 * rows `assetHandoff.e2e.ts` left. The library's scope before and after a plan note breaks
 * (steps 1 and 5), the placements a duplicate must not touch (step 10's other clause), the
 * pre-scan window (step 6), the canvas menu's door (step 22), and a restored leaf on mobile
 * (step 26). Every placement here is made through the real hand-off, and the plans' own
 * sidecars on disk are the instrument for "nothing downstream moved".
 */
const desktop = mobileEmulation ? test.skip : test;
const mobile = mobileEmulation ? test : test.skip;

const DESKTOP_ONLY = 'This surface is not available on mobile. Open it on a desktop.';

/** Every plan sidecar under the project, by file name — the bytes a duplicate must not move. */
const planSidecars = (vault: string): Record<string, string> => {
	const dir = path.join(vault, 'Renovation/Flat/Geometry');
	return Object.fromEntries(readdirSync(dir).map((file) => [file, readFileSync(path.join(dir, file), 'utf8')]));
};

/** The asset elements a plan sidecar places, over its structure and its proposal. */
const placements = (text: string): { id: string; assetId: string }[] => {
	const doc = JSON.parse(text) as { structure?: { elements?: { id: string; kind: string; assetId?: string }[] }; intended?: { elements?: { id: string; kind: string; assetId?: string }[] } };
	const all = [...(doc.structure?.elements ?? []), ...(doc.intended?.elements ?? [])];
	return all.filter((element) => element.kind === 'asset').map((element) => ({ id: element.id, assetId: element.assetId ?? '' }));
};

/** A click on the active Plan Editor's canvas, `dx` pixels right of its centre. */
const clickPlan = async (browser: NativeBrowser, ui: PlannerPage, dx = 0): Promise<{ x: number; y: number }> => {
	const canvas = ui.leaf(PLAN_EDITOR).$('.rp-plan-canvas');
	const size = await canvas.getSize();
	const at = await canvas.getLocation();
	const point = { x: Math.round(at.x + size.width / 2) + dx, y: Math.round(at.y + size.height / 2) };
	await browser.action('pointer').move({ ...point, origin: 'viewport' }).down().up().perform();
	return point;
};

/** Use in plan from the designer, taking `plan` from the picker when one opens. */
const useInPlan = async (browser: NativeBrowser, ui: PlannerPage, designer: DesignerPage, plan?: string): Promise<void> => {
	await ui.activate(DESIGNER);
	await designer.designer().$('.rp-designer-use-plan').click();
	if (plan) {
		await expect.poll(() => browser.$('.prompt').isDisplayed()).toBe(true);
		await browser.$('.prompt-input').setValue(plan);
		await expect.poll(() => browser.$('.prompt .suggestion-item').getText()).toContain(plan);
		await browser.keys('Enter');
	}
	await expect.poll(() => ui.leaf(PLAN_EDITOR).$('.rp-task-banner').isExisting()).toBe(true);
};

/**
 * The case's preconditions through the real doors: `Oven` placed twice on `Ground floor` and
 * once on `First floor`, one project, both plan editors open.
 */
const placeOvens = async (browser: NativeBrowser, vault: string, ui: PlannerPage, designer: DesignerPage): Promise<string> => {
	const count = () => Object.values(planSidecars(vault)).reduce((sum, text) => sum + placements(text).length, 0);
	await ui.createProjectWithPlan('Flat', 'Ground floor');
	const assetId = await designer.createToilet('Oven');
	for (const [index, dx] of [0, 220].entries()) {
		await useInPlan(browser, ui, designer);
		await clickPlan(browser, ui, dx);
		await expect.poll(count).toBe(index + 1);
		await browser.keys('Escape');
	}
	await ui.openProjectView();
	await ui.projectView().$('.rp-project-row').click();
	await ui.projectView().$('.rp-plan-list__create').click();
	await ui.submitForm('First floor');
	await ui.projectView().$('.rp-plan-list__row*=First floor').click();
	await expect.poll(() => designer.leafStates(PLAN_EDITOR)).toHaveLength(2);
	await useInPlan(browser, ui, designer, 'First floor');
	await clickPlan(browser, ui);
	await expect.poll(count).toBe(3);
	await browser.keys('Escape');
	return assetId;
};

/** Open asset library from the palette, open its one shelf, and select the named row. */
const selectInLibrary = async (ui: PlannerPage, name: string): Promise<void> => {
	await ui.command('open-asset-library');
	await ui.activate(LIBRARY);
	const shelf = ui.leaf(LIBRARY).$('.rp-al-shelf__head[aria-expanded="false"]');
	await shelf.click();
	await ui.leaf(LIBRARY).$(`.rp-al-row*=${name}`).click();
	await expect.poll(() => ui.leaf(LIBRARY).$('.rp-al-inspector__name').getText()).toBe(name);
};

/** One project, one plan, `Oven` placed once on it through the hand-off, the placing task ended. */
const placeOne = async (browser: NativeBrowser, ui: PlannerPage, designer: DesignerPage): Promise<{ assetId: string; at: { x: number; y: number } }> => {
	await ui.createProjectWithPlan('Flat', 'Ground floor');
	const assetId = await designer.createToilet('Oven');
	await useInPlan(browser, ui, designer);
	const at = await clickPlan(browser, ui);
	await browser.pause(800);
	await browser.keys('Escape');
	return { assetId, at };
};

/** Two activations of one control inside one tick of the page. */
const pressTwice = async (browser: NativeBrowser, control: ChainablePromiseElement): Promise<void> => {
	const element = await control.getElement();
	await browser.execute((el: HTMLElement) => {
		for (let press = 0; press < 2; press += 1) el.click();
	}, element);
};

/** Exactly one designer leaf, on `assetId`, and still one once anything late has had time to land. */
const settlesOnOneDesigner = async (browser: NativeBrowser, designer: DesignerPage, assetId: string): Promise<void> => {
	const one = [{ assetId }];
	await expect.poll(() => designer.leafStates(DESIGNER)).toEqual(one);
	await browser.pause(800);
	expect(await designer.leafStates(DESIGNER)).toEqual(one);
};

describe('Take an asset from the library into a plan, the rows the first pass left', () => {
	// Steps 1, 10 and 5: the scope is Duplicate's, a duplicate moves no placement, and a broken
	// plan note is counted rather than dropped.
	desktop('shows no plan scope until Duplicate, moves no placement by duplicating, and counts a plan it cannot read', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const vault = page.getVaultPath();
		const assetId = await placeOvens(browser, vault, ui, designer);
		const before = planSidecars(vault);

		// Step 1: selecting draws the name, Used in and the actions — and no Used in plans yet.
		const library = () => ui.leaf(LIBRARY);
		await selectInLibrary(ui, 'Oven');
		expect(await library().$$('.rp-al-inspector__title').map((title) => title.getText())).toEqual(['Used in', 'Shape']);
		expect(await library().$('.rp-al-inspector .rp-al-fields__input').isExisting()).toBe(true);
		expect(await library().$('[data-action="duplicate-open"]').isExisting()).toBe(true);
		expect(await library().$('h4=Used in plans').isExisting()).toBe(false);

		// Step 10: the copy, and every placement exactly where and what it was.
		const rows = () => library().$$('.rp-al-used__row[data-plan-id]').map((row) => row.getText()).then((texts) => texts.toSorted());
		await library().$('[data-action="duplicate-open"]').click();
		await expect.poll(rows).toEqual(['First floor (Flat) — 1 placement(s)', 'Ground floor (Flat) — 2 placement(s)']);
		await library().$('//form[.//h4[normalize-space(.) = "Duplicate as new asset"]]//button[@type="submit"]').click();
		await expect.poll(async () => Object.keys(await ui.notesOfType('renovation-asset'))).toHaveLength(2);
		await browser.pause(1500);
		expect(planSidecars(vault)).toEqual(before);
		expect(Object.values(before).flatMap((text) => placements(text)).map((placed) => placed.assetId)).toEqual([assetId, assetId, assetId]);
		expect(await library().$('.rp-al-inspector__name').getText()).toBe('Oven');
		const notes = Object.values(await ui.notesOfType('renovation-asset'));
		expect(notes.find((note) => note.name === 'Oven')?.id).toBe(assetId);
		expect(notes.find((note) => note.name === 'Oven (copy)')?.id).not.toBe(assetId);

		// Step 5: break First floor's note in a way that keeps it a plan, and ask again.
		await browser.executeObsidian(async ({ app }) => {
			const note = app.vault.getMarkdownFiles().find((file) => app.metadataCache.getFileCache(file)?.frontmatter?.name === 'First floor');
			if (!note) throw new Error('No First floor note.');
			await app.fileManager.processFrontMatter(note, (frontmatter: Record<string, unknown>) => {
				frontmatter.layers = 'broken';
			});
		});
		await browser.pause(1500);
		await ui.activate(LIBRARY);
		await library().$('[data-action="duplicate-open"]').click();
		await expect.poll(rows).toEqual(['Ground floor (Flat) — 2 placement(s)']);
		expect(await library().$('[data-usage-incomplete="true"]').getText()).toBe('1 note(s) could not be read, so this list may be incomplete');
	});

	// Step 6: Duplicate pressed on the first frame the page offers it, right after the plugin
	// loads. A FINDING, pinned: the button draws only once the catalogue lists the asset, which is
	// after the index scan, so the unknown-scope arm is unreachable here and the list is right.
	desktop('offers Duplicate only once the scan has landed after a load, so the scope is never a confident empty', async ({
		native: { browser, page, ui },
	}) => {
		const { assetId } = await placeOne(browser, ui, createDesignerPage(browser, page, ui));
		const seen = await browser.executeObsidian(
			async ({ app }, id, libraryType, subject) => {
				const plugins = (app as unknown as { plugins: { disablePlugin(i: string): Promise<void>; enablePlugin(i: string): Promise<void> } }).plugins;
				await plugins.disablePlugin(id);
				await plugins.enablePlugin(id);
				const started = performance.now();
				await app.workspace.getLeaf('tab').setViewState({ type: libraryType, state: { assetId: subject, expanded: [] }, active: true });
				const texts: string[] = [];
				let pressed = false;
				while (performance.now() - started < 5000) {
					const root = document.querySelector(`.workspace-leaf-content[data-type="${libraryType}"]`);
					const button = root?.querySelector<HTMLElement>('[data-action="duplicate-open"]');
					if (!pressed && button) {
						button.click();
						pressed = true;
					}
					const section = [...(root?.querySelectorAll('h4') ?? [])].find((h) => h.textContent?.trim() === 'Used in plans')?.parentElement;
					const text = section?.textContent?.replace(/\s+/g, ' ').trim();
					if (text && texts.at(-1) !== text) texts.push(text);
					await new Promise((resolve) => {
						requestAnimationFrame(resolve);
					});
				}
				return { pressed, texts };
			},
			PLUGIN_ID,
			LIBRARY,
			assetId,
		);
		expect(seen.pressed).toBe(true);
		expect(seen.texts.at(-1)).toBe('Used in plansGround floor (Flat) — 1 placement(s)');
		// Neither the confident empty (the defect) nor the unknown arm (unreachable here) was ever drawn.
		expect(seen.texts.filter((text) => text.includes('No plan places') || text.includes('could not be read'))).toEqual([]);
	});

	// Step 22: the canvas menu's door reaches the same one leaf the Inspector's does.
	desktop('opens the designer from the canvas menu into the one leaf the Inspector opened, and one leaf for two presses', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const { assetId, at } = await placeOne(browser, ui, designer);
		// Select the placement, then take the Inspector's door — script-clicked, as the first pass
		// does, because the Inspector's row is laid out under the fold.
		await browser.action('pointer').move({ ...at, origin: 'viewport' }).down().up().perform();
		const inspectorDoor = ui.leaf(PLAN_EDITOR).$('[data-rp-action="open-asset-designer"]');
		await inspectorDoor.waitForExist();
		await browser.execute((el: HTMLElement) => el.click(), await inspectorDoor.getElement());
		await settlesOnOneDesigner(browser, designer, assetId);

		const designerShown = () =>
			browser.execute(() => [...document.querySelectorAll('.workspace-leaf-content[data-type="renovation-asset-designer"]')].map((el) => (el as HTMLElement).offsetParent !== null));
		const menuItem = () => browser.$('[role="menu"] [data-rp-context-action="open-asset-designer"]');
		const openMenu = async (): Promise<void> => {
			await ui.activate(PLAN_EDITOR);
			await browser.action('pointer').move({ ...at, origin: 'viewport' }).down({ button: 2 }).up({ button: 2 }).perform();
			await expect.poll(() => menuItem().isDisplayed()).toBe(true);
		};
		await openMenu();
		expect(await menuItem().getText()).toBe('Open in designer');
		// The designer's tab sits behind the plan's in one tab group; the menu brings THAT leaf forward.
		expect(await designerShown()).toEqual([false]);
		await menuItem().click();
		await expect.poll(designerShown).toEqual([true]);
		expect(await designer.leafStates(DESIGNER)).toEqual([{ assetId }]);

		// Two presses in one tick, with no designer open: still exactly one leaf.
		await designer.closeDesigner();
		await expect.poll(() => designer.leafStates(DESIGNER)).toEqual([]);
		await openMenu();
		await pressTwice(browser, menuItem());
		await settlesOnOneDesigner(browser, designer, assetId);
	});

	// Step 26: leaves restored from this device's own layout, where no command runs at all.
	mobile('refuses both restored leaves on mobile rather than mounting either', async ({ native: { browser } }) => {
		const refusals = () =>
			browser.execute((types: string[]) => types.map((type) => {
				const content = document.querySelector(`.workspace-leaf-content[data-type="${type}"]`);
				return content ? [content.querySelector('.rp-view-message')?.textContent ?? '', content.querySelectorAll('canvas, .rp-al-shelf').length] : null;
			}), [DESIGNER, LIBRARY]);
		await browser.executeObsidian(async ({ app }, designerType, libraryType) => {
			await app.workspace.getLeaf('tab').setViewState({ type: designerType, state: { assetId: 'asset-restored' } });
			await app.workspace.getLeaf('tab').setViewState({ type: libraryType, state: { assetId: '', expanded: [] } });
			app.workspace.requestSaveLayout();
		}, DESIGNER, LIBRARY);
		await browser.pause(2500);

		await browser.reloadObsidian();
		await expect.poll(() => browser.executeObsidian(({ app }, types) => types.map((type) => app.workspace.getLeavesOfType(type).length), [DESIGNER, LIBRARY]), { timeout: 20_000 }).toEqual([1, 1]);
		// A deferred leaf mounts nothing until it is shown; show each, as the user opening the tab would.
		for (const type of [DESIGNER, LIBRARY]) {
			await browser.executeObsidian(async ({ app }, viewType) => {
				const leaf = app.workspace.getLeavesOfType(viewType)[0];
				if (leaf) await app.workspace.revealLeaf(leaf);
			}, type);
		}
		await expect.poll(refusals).toEqual([[DESKTOP_ONLY, 0], [DESKTOP_ONLY, 0]]);
	});
});
