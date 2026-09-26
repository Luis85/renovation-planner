import { describe, expect } from 'vitest';
import type { ChainablePromiseElement } from 'webdriverio';
import { test } from './fixture';
import { closePluginSettings, openPluginSettings, settingControl } from './helpers';
import {
	EDITOR,
	PLANTED_INCIDENT,
	UNRECOVERED,
	WRITES_PAUSED,
	expectPaused,
	incidentsPath,
	openPlan,
	planNames,
	plantIncidents,
	reloadPlugin,
	removeIncidents,
	seedProjectWithPlan,
	tryNewPlan,
	type Ui,
} from './planner';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Two panes on one plan under an open write incident.md`, driven in the real
 * host — the rows no fake could answer: `duplicateLeaf` (BP-02 limitation L-03), the real
 * settings-window rebind, a real plugin reload over a real plugin folder, and the guarded door
 * refusing a write that the real form then reports. The incident is PLANTED, as the case's own
 * fault setup says: ADR-0034 refuses a control that raises or clears one.
 *
 * Every write here runs on the desktop legs; mobile is view-only by design.
 */
const desktop = mobileEmulation ? test.skip : test;
type Page = Parameters<typeof reloadPlugin>[0];

/** Every case's fault setup: the project and plan made first, then the file planted, then a reload that reads it. */
async function plantAndReload(browser: NativeBrowser, page: Page, ui: Ui, content: string): Promise<void> {
	await seedProjectWithPlan(ui);
	await plantIncidents(browser, content);
	await reloadPlugin(page);
}

/** Step 1's state: the primary incident planted and read, then the seeded plan opened and its editor paused. */
async function openPausedPlan(browser: NativeBrowser, page: Page, ui: Ui): Promise<void> {
	await plantAndReload(browser, page, ui, JSON.stringify(PLANTED_INCIDENT));
	await openPlan(browser, ui, 'Ground floor');
	await expectPaused(browser.$(EDITOR));
}

/** Open the diagnostics report, and read the one incident code it names. */
async function openReport(ui: Ui, report: ChainablePromiseElement, code: string): Promise<void> {
	await ui.command('show-diagnostics-report');
	await expect.poll(() => report.isDisplayed()).toBe(true);
	expect(await report.$('.rp-diagnostics__incident .rp-diagnostics__code').getText()).toBe(code);
}

describe('a planted write incident in the real host', () => {
	desktop('pauses the editor from its first frame, a split pane with it, and both again after a settings rebind', async ({
		native: { browser, page, ui },
	}) => {
		// Step 1: paused before any write is attempted — the seed, not the gate catching up.
		await openPausedPlan(browser, page, ui);
		// A JS click: the FloorStart panel floats over the Add button on a plan with no rooms.
		await browser.execute((button: HTMLElement) => button.click(), await browser.$(EDITOR).$('[data-rp-action="add"]'));
		const items = await browser.$(EDITOR).$$('.rp-add-menu__item');
		expect(items.length).toBeGreaterThan(0);
		for (const item of items) expect(await item.getAttribute('aria-disabled')).toBe('true');
		await browser.keys('Escape');

		// Steps 2 and 3: Obsidian's own duplicate, which bypasses the plugin's per-plan reveal.
		await browser.executeObsidian(async ({ app }, type) => {
			const [leaf] = app.workspace.getLeavesOfType(type);
			if (!leaf) throw new Error('No Plan Editor leaf to split.');
			await app.workspace.duplicateLeaf(leaf, 'split', 'vertical');
		}, 'renovation-plan-editor');
		await expect.poll(() => ui.leafCount('renovation-plan-editor')).toBe(2);
		const panes = await browser.$$(EDITOR);
		expect(panes).toHaveLength(2);
		for (const pane of panes) await expectPaused(pane);

		// Step 6: a settings save remounts every leaf's Vue tree with a fresh Pinia.
		const windows = await openPluginSettings(browser);
		await settingControl(browser, 'Units', 'select').selectByAttribute('value', 'imperial');
		await closePluginSettings(browser, windows);
		await expect.poll(() => ui.leafCount('renovation-plan-editor')).toBe(2);
		for (const pane of await browser.$$(EDITOR)) await expectPaused(pane);
	});

	desktop('refuses the write with its reason, names the file in the diagnostics report, and resumes only on reload', async ({
		native: { browser, page, ui },
	}) => {
		await plantAndReload(browser, page, ui, JSON.stringify(PLANTED_INCIDENT));

		// Step 4: the guarded door underneath, and the refusal said rather than swallowed.
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		expect(await planNames(ui)).toEqual(['Ground floor']);

		// Step 8: the retirement gesture is discoverable, and it is a path rather than a button.
		const report = browser.$('.rp-diagnostics');
		await openReport(ui, report, 'zone.sidecar-write-uncompensated');
		const note = await report.$$('.rp-diagnostics__note').map((element) => element.getText());
		expect(note).toContain('Affected files could not be named.');
		const path = await incidentsPath(browser);
		expect(note.some((text) => text.includes(path))).toBe(true);
		expect(await report.$$('button').map((element) => element.getText())).toEqual(['Copy report']);
		await browser.keys('Escape');

		// Step 9: the file is read once at load; removing it resumes nothing until the plugin loads again.
		await removeIncidents(browser);
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		expect(await planNames(ui)).toEqual(['Ground floor']);

		// Step 10: with the file gone, a reload is live again and the write lands — that one and nothing else.
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);
		expect(await tryNewPlan(browser, ui, 'Attic')).toBe('');
		await expect.poll(() => planNames(ui)).toEqual(['Attic', 'Ground floor']);
		await openPlan(browser, ui, 'Ground floor');
		expect(await browser.$(EDITOR).$$('.rp-warning-strip__item').map((item) => item.getText())).toEqual([]);
		expect(await browser.$(EDITOR).$('[data-rp-action="undo"]').getAttribute('disabled')).toBe('true');
	});

	// The fault setup's alternative arm, "worth one run of its own": a file this build cannot
	// read is an OPEN incident, never absence (SDD §87 rule 8).
	desktop('fails closed on an unreadable incidents file and says so in the report', async ({ native: { browser, page, ui } }) => {
		await plantAndReload(browser, page, ui, '{}');
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		const report = browser.$('.rp-diagnostics');
		await openReport(ui, report, 'write-incident.unreadable');
		expect(await report.$$('.rp-diagnostics__note').map((element) => element.getText())).toContain(
			'This build cannot read this record, so only its presence is known.',
		);
	});
});

describe('a planted write incident across a real Obsidian restart', () => {
	// The case's step 7, written to what the code supports and then MEASURED: Obsidian restores
	// its leaves before `onLayoutReady`, where the registry's read starts, so a restored pane
	// asks a registry that has read nothing yet (limitation L-14). The door underneath is not
	// so timed — it refuses once the read lands — and the file itself is untouched by a restart.
	desktop('restores the pane over the saved layout, keeps refusing the write, and leaves the file alone', async ({
		native: { browser, page, ui },
	}) => {
		await openPausedPlan(browser, page, ui);

		await browser.reloadObsidian();
		await expect.poll(() => ui.leafCount('renovation-plan-editor')).toBe(1);
		await expect.poll(() => browser.$(EDITOR).$('.rp-plan-canvas canvas').isExisting()).toBe(true);
		const firstFrame = await browser.$(EDITOR).$$('.rp-warning-strip__item').map((item) => item.getText());
		expect(firstFrame.some((text) => text.includes(UNRECOVERED))).toBe(false);

		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		const path = await incidentsPath(browser);
		expect(await browser.executeObsidian(({ app }, file) => app.vault.adapter.read(file), path)).toBe(JSON.stringify(PLANTED_INCIDENT));
	});
});
