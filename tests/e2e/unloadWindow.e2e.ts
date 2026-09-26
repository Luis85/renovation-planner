import { describe, expect } from 'vitest';
import { test } from './fixture';
import { writeEvidence } from './diagnostics';
import { EDITOR, PLANTED_INCIDENT, expectPaused, openPlan, plantIncidents, reloadPlugin, seedSampleProject, type Ui } from './planner';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * Owner question Q3 (tracker L-21), as the one vault run
 * `docs/releases/first-beta-readiness/05-owner-decisions.md` §5 asks for: "with an editor pane
 * open and a field edit pending, disable the plugin and observe whether the pane is still on
 * screen and whether the pending write reaches the note."
 *
 * The pending edit is the Room Inspector's quantity override (`RequirementRow.vue`,
 * `data-field="quantity"`), typed and not yet blurred. It commits on `@blur`, and the value it
 * commits lands in the requirement note's `quantity-override` frontmatter, which is what these
 * cases read back. The sample project carries no requirement, so each case assigns one first.
 */
const desktop = mobileEmulation ? test.skip : test;
const PLAN_EDITOR = 'renovation-plan-editor';

/**
 * The note the assign picker offers. Written as a note rather than through the Asset library's
 * create form, because the asset is this case's fixture and not its subject: the index finds a
 * note by what its frontmatter declares, wherever it sits.
 */
const ASSET_ID = 'asset-01K0000000000000000000000Z';
const ASSET_NOTE = [
	'---',
	'type: renovation-asset',
	'schema-version: 1',
	`id: ${ASSET_ID}`,
	'revision: 0',
	'name: Floor tile',
	'category: material',
	'supplier: null',
	'sku: null',
	'unit-cost: "25"',
	'currency: EUR',
	'unit: m2',
	'waste-factor-default: null',
	'notes: null',
	'---',
	'',
].join('\n');

/**
 * How long a write that no pane is left to make is waited for. The unrefused case below measured
 * about 80 ms from the field's `focusout` to the end of its `vault.process`; this is 25 times that.
 */
const NO_WRITE_WINDOW_MS = 2_000;

const QUANTITY = '[data-field="quantity"]';
const requirements = async (ui: Ui) => Object.values(await ui.notesOfType('renovation-requirement'));

/** The sample project, one asset, and one requirement on the Kitchen whose quantity field is drawn. */
async function seedKitchenRequirement(browser: NativeBrowser, ui: Ui): Promise<void> {
	await browser.executeObsidian(async ({ app }, text) => {
		await app.vault.create('Floor tile.md', text);
	}, ASSET_NOTE);
	await seedSampleProject(browser, ui);
	await selectKitchen(browser);
	const pane = browser.$(EDITOR);
	await expect.poll(() => pane.$(`#rp-assign-asset option[value="${ASSET_ID}"]`).isExisting()).toBe(true);
	await pane.$('#rp-assign-asset').selectByAttribute('value', ASSET_ID);
	await pane.$('.rp-editor-requirement-assign button').click();
	await expect.poll(async () => (await requirements(ui)).length).toBe(1);
	await expect.poll(() => browser.$(QUANTITY).isDisplayed()).toBe(true);
}

/** Through the Floor inspector's room list, opening the Details panel first when the pane is narrow. */
async function selectKitchen(browser: NativeBrowser): Promise<void> {
	const pane = browser.$(EDITOR);
	const rail = pane.$('[data-rp-rail="details"]');
	if (await rail.isDisplayed()) await rail.click();
	// The room list is drawn twice from the same records (useSpatialRecords.ts): once in the
	// Layers panel's Rooms section (PropertyLayerPanel.vue) and once in the Floor inspector's
	// own list (FloorInspector.vue via FloorSpatialLists.vue). At the full-width layout
	// (ResponsiveEditorShell.vue) both panels are visible at once, so an unscoped query finds
	// two "Kitchen" rows there. Scope to the inspector region (`data-rp-region="inspector"`,
	// EntityInspector.vue): its row is the one whose click opens `.rp-room-inspector` below,
	// and it carries exactly one Kitchen row at any width.
	const rows = await pane.$('[data-rp-region="inspector"]').$$('.rp-room-list__row*=Kitchen');
	expect(rows).toHaveLength(1);
	await rows[0].click();
	await expect.poll(() => pane.$('.rp-room-inspector').isExisting()).toBe(true);
}

interface TeardownWindow {
	__rpOrder?: string[];
	__rpFocusout?: (event: FocusEvent) => void;
}
interface ProcessVault {
	process: (...args: unknown[]) => Promise<unknown>;
	__rpOriginalProcess?: (...args: unknown[]) => Promise<unknown>;
}

/**
 * Record, in order, the field losing focus, the plugin's `onunload`, each Plan Editor view's
 * `onClose`, and every `vault.process` (the requirement note's write). The plugin and view
 * instances are discarded by the disable; the vault and document are not, so `restoreHost`
 * undoes those two in a `finally`.
 */
async function recordTeardown(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }, id, type) => {
		const order: string[] = [];
		const held = window as unknown as TeardownWindow;
		held.__rpOrder = order;
		held.__rpFocusout = (event) => order.push(`focusout:${(event.target as HTMLElement).getAttribute('data-field')}`);
		document.addEventListener('focusout', held.__rpFocusout, true);
		const plugin = (app as unknown as { plugins: { plugins: Record<string, { onunload: () => void }> } }).plugins.plugins[id];
		const unload = plugin.onunload.bind(plugin);
		Object.assign(plugin, {
			onunload: () => {
				order.push('onunload');
				unload();
				order.push('onunload-end');
			},
		});
		for (const leaf of app.workspace.getLeavesOfType(type)) {
			const view = leaf.view as unknown as { onClose: () => Promise<void> };
			const close = view.onClose.bind(view);
			Object.assign(view, {
				onClose: () => {
					order.push('onClose');
					return close();
				},
			});
		}
		const vault = app.vault as unknown as ProcessVault;
		const original = vault.process.bind(vault);
		vault.__rpOriginalProcess = original;
		vault.process = async (...args: unknown[]) => {
			order.push(`process-start:${(args[0] as { path: string }).path}`);
			const result = await original(...args);
			order.push(`process-end:${(args[0] as { path: string }).path}`);
			return result;
		};
	}, PLUGIN_ID, PLAN_EDITOR);
}

async function restoreHost(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		const held = window as unknown as TeardownWindow;
		if (held.__rpFocusout) document.removeEventListener('focusout', held.__rpFocusout, true);
		const vault = app.vault as unknown as ProcessVault;
		if (vault.__rpOriginalProcess) vault.process = vault.__rpOriginalProcess;
		delete vault.__rpOriginalProcess;
	});
}

const teardownOrder = (browser: NativeBrowser): Promise<string[]> =>
	browser.execute(() => (window as unknown as TeardownWindow).__rpOrder ?? []);

/** Every leaf's type and view state, as Obsidian answers them. */
const leafStates = (browser: NativeBrowser) =>
	browser.executeObsidian(({ app }) => {
		const states: { type: string; state: unknown }[] = [];
		app.workspace.iterateAllLeaves((leaf) => states.push({ type: leaf.view.getViewType(), state: leaf.getViewState() }));
		return states;
	});

/** Type into the quantity field and stop there: no blur, so the edit is pending. */
async function typePending(browser: NativeBrowser, text: string): Promise<void> {
	await browser.$(QUANTITY).click();
	await browser.keys(text.split(''));
	expect(await browser.$(QUANTITY).getValue()).toBe(text);
	expect(await browser.execute((selector) => document.activeElement === document.querySelector(selector), QUANTITY)).toBe(true);
}

describe('Q3: a Plan Editor pane across a plugin disable (L-21)', () => {
	desktop('pins that disabling the plugin replaces the Plan Editor pane with an empty tab, closing it before onunload', async ({
		native: { browser, page, ui, directory },
	}) => {
		// NOT a ruling. L-21 is an open owner question (05-owner-decisions.md §5): this pins what Obsidian
		// 1.13.7 and this build do today, so a change to either answer turns the case red and is noticed.
		await seedKitchenRequirement(browser, ui);
		expect(await ui.leafCount(PLAN_EDITOR)).toBe(1);
		await recordTeardown(browser);
		try {
			await page.disablePlugin(PLUGIN_ID);
			const lifecycle = (await teardownOrder(browser)).filter((entry) => entry.startsWith('on'));
			const states = await leafStates(browser);
			await writeEvidence(directory, 'unload-order', { order: await teardownOrder(browser), states });
			// Obsidian closes the one view twice, and both before `onunload` is called.
			expect(lifecycle).toEqual(['onClose', 'onClose', 'onunload', 'onunload-end']);
			expect(await browser.$(EDITOR).isExisting()).toBe(false);
			expect(await ui.leafCount(PLAN_EDITOR)).toBe(0);
			// The leaf is not detached: it stays, as an empty tab carrying none of the editor's state.
			expect(states.filter((leaf) => leaf.type === 'empty')).toEqual([
				{ type: 'empty', state: { type: 'empty', state: {}, icon: 'lucide-file', title: 'New tab' } },
			]);
			// So enabling the plugin again has nothing to restore.
			await page.enablePlugin(PLUGIN_ID);
			expect(await ui.leafCount(PLAN_EDITOR)).toBe(0);
		} finally {
			await restoreHost(browser);
		}
	});

	desktop('pins that a field edit pending at disable is written to the note after onunload returns', async ({
		native: { browser, page, ui, directory },
	}) => {
		// NOT a ruling. L-21 is an open owner question (05-owner-decisions.md §5): this pins what Obsidian
		// 1.13.7 and this build do today, so a change to either answer turns the case red and is noticed.
		await seedKitchenRequirement(browser, ui);
		const [before] = await requirements(ui);
		expect(before['quantity-override']).toBeNull();
		await typePending(browser, '7.5');
		await recordTeardown(browser);
		try {
			await page.disablePlugin(PLUGIN_ID);
			// No key is pressed after the disable: the teardown itself blurs the field.
			expect(await browser.$(QUANTITY).isExisting()).toBe(false);
			await expect.poll(async () => (await requirements(ui))[0]['quantity-override']).toBe('7.5');
			const [after] = await requirements(ui);
			expect(after.revision).toBe(Number(before.revision) + 1);
			const order = await teardownOrder(browser);
			await writeEvidence(directory, 'unload-order', { order, before, after });
			const at = (prefix: string) => order.findIndex((entry) => entry.startsWith(prefix));
			expect(at('focusout:quantity')).toBeGreaterThanOrEqual(0);
			// The commit is started by a blur that fires before the view closes...
			expect(at('focusout:quantity')).toBeLessThan(at('onClose'));
			// ...and the vault write it makes starts only after `onunload` has returned.
			expect(at('onunload-end')).toBeGreaterThan(at('onClose'));
			expect(at('process-start:')).toBeGreaterThan(at('onunload-end'));
			expect(order.filter((entry) => entry.startsWith('process-end:'))).toHaveLength(1);
		} finally {
			await restoreHost(browser);
		}
	});
});

describe('Q3 under an open write incident (f5a7f219e)', () => {
	desktop('pins that no pane survives disable, so a post-unload write has no door', async ({ native: { browser, page, ui } }) => {
		// NOT a ruling. L-21 is an open owner question (05-owner-decisions.md §5): this pins what Obsidian
		// 1.13.7 and this build do today, so a change to either answer turns the case red and is noticed.
		// Seeded first: once the incident is planted, the seed's own writes are refused.
		await seedKitchenRequirement(browser, ui);
		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await reloadPlugin(page);
		await openPlan(browser, ui, 'Ground floor');
		await expectPaused(browser.$(EDITOR));
		await selectKitchen(browser);
		// The paused row offers no write: its field refuses keystrokes, so no edit can be pending.
		expect(await browser.$(QUANTITY).getAttribute('readonly')).toBe('true');
		const [before] = await requirements(ui);

		await page.disablePlugin(PLUGIN_ID);
		expect(await browser.$(EDITOR).isExisting()).toBe(false);
		expect(await ui.leafCount(PLAN_EDITOR)).toBe(0);
		// A measured window: nothing is left on screen that could write, and nothing does.
		const start = Date.now();
		while (Date.now() - start < NO_WRITE_WINDOW_MS) expect(await requirements(ui)).toEqual([before]);
	});
});
