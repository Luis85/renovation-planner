import { describe, expect } from 'vitest';
import { test } from './fixture';
import type { ChainablePromiseElement } from 'webdriverio';
import { closePluginSettings, type createPlannerPage, openPluginSettings, settingControl } from './helpers';
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

const EDITOR = '.workspace-leaf-content[data-type="renovation-plan-editor"]';
const UNRECOVERED = 'A change was written but could not be completed or undone.';
const WRITES_PAUSED = 'Writing is paused.';

/** The case's primary fault setup, verbatim: a recognised, fully open stamp with nothing it can name. */
const PLANTED_INCIDENT = {
	schemaVersion: 1,
	incidents: [
		{
			schemaVersion: 1,
			incidentId: 'incident-manual-1',
			raisedAt: '2026-09-17T00:00:00.000Z',
			code: 'zone.sidecar-write-uncompensated',
			category: 'Persistence',
			affected: [],
		},
	],
};

const incidentsPath = (browser: NativeBrowser) =>
	browser.executeObsidian(({ app }, id) => `${app.vault.configDir}/plugins/${id}/write-incidents.json`, PLUGIN_ID);

async function plantIncidents(browser: NativeBrowser, content: string): Promise<void> {
	await browser.executeObsidian(({ app }, path, text) => app.vault.adapter.write(path, text), await incidentsPath(browser), content);
}

async function removeIncidents(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }, path) => app.vault.adapter.remove(path), await incidentsPath(browser));
}

type Ui = ReturnType<typeof createPlannerPage>;
type Pane = ChainablePromiseElement | WebdriverIO.Element;

/** A project with one plan, made through the real forms, BEFORE any incident pauses writing. */
async function seedProjectWithPlan(ui: Ui): Promise<void> {
	await ui.openProjectView();
	await ui.projectView().$('.rp-empty-state__action').click();
	await ui.submitForm('Flat');
	await ui.projectView().$('.rp-project-detail__entry-action--secondary').click();
	await ui.submitForm('Ground floor');
	await expect.poll(async () => Object.values(await ui.notesOfType('renovation-plan')).map((plan) => plan.name)).toEqual(['Ground floor']);
}

/** From the project list: into the one project, then the plan named so, until the editor draws. */
async function openPlan(browser: NativeBrowser, ui: Ui, name: string): Promise<void> {
	await ui.openProjectView();
	const row = () => ui.projectView().$(`.rp-plan-list__row*=${name}`);
	// The view keeps its detail state across reveals, so the list is only sometimes what draws.
	if (!(await row().isExisting())) {
		await expect.poll(() => ui.projectView().$('.rp-project-row').isDisplayed()).toBe(true);
		await ui.projectView().$('.rp-project-row').click();
	}
	await expect.poll(() => row().isDisplayed()).toBe(true);
	await row().click();
	await expect.poll(() => browser.$(EDITOR).$('.rp-plan-canvas canvas').isExisting()).toBe(true);
}

/** What the case's step 1 lists for a paused pane: the strip, and Undo dimmed. */
async function expectPaused(pane: Pane): Promise<void> {
	await expect.poll(() => pane.$('.rp-warning-strip').getText()).toContain(UNRECOVERED);
	expect(await pane.$('[data-rp-action="undo"]').getAttribute('disabled')).toBe('true');
}

/** Try the one write the project view offers, and read what the real form says about it. */
async function tryNewPlan(browser: NativeBrowser, ui: Ui, name: string): Promise<string> {
	await ui.openProjectView();
	const secondary = () => ui.projectView().$('.rp-plan-list__create');
	if (!(await secondary().isExisting())) {
		await ui.projectView().$('.rp-project-row').click();
		await expect.poll(() => secondary().isExisting()).toBe(true);
	}
	await secondary().click();
	await expect.poll(() => ui.dialog().isDisplayed()).toBe(true);
	await ui.dialog().$('[data-field="name"]').setValue(name);
	await ui.dialog().$('button[type="submit"]').click();
	// Two ways out, and neither is a timeout: the dialog closes on success, or draws its banner.
	let outcome = 'pending';
	await expect
		.poll(async () => {
			if (!(await ui.dialog().isExisting())) outcome = 'closed';
			else if (await ui.dialog().$('.rp-form-banner').isExisting()) outcome = 'refused';
			return outcome;
		})
		.not.toBe('pending');
	if (outcome === 'closed') return '';
	const text = await ui.dialog().$('.rp-form-banner').getText();
	await ui.dialog().$('[data-field="name"]').click();
	await browser.keys('Escape');
	await expect.poll(() => ui.dialog().isExisting()).toBe(false);
	return text;
}

describe('a planted write incident in the real host', () => {
	desktop('pauses the editor from its first frame, a split pane with it, and both again after a settings rebind', async ({
		native: { browser, page, ui },
	}) => {
		await seedProjectWithPlan(ui);
		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);

		// Step 1: paused before any write is attempted — the seed, not the gate catching up.
		await openPlan(browser, ui, 'Ground floor');
		await expectPaused(browser.$(EDITOR));
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
		await seedProjectWithPlan(ui);
		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);

		// Step 4: the guarded door underneath, and the refusal said rather than swallowed.
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		const plans = async () => Object.values(await ui.notesOfType('renovation-plan')).map((plan) => plan.name).toSorted();
		expect(await plans()).toEqual(['Ground floor']);

		// Step 8: the retirement gesture is discoverable, and it is a path rather than a button.
		await ui.command('show-diagnostics-report');
		const report = browser.$('.rp-diagnostics');
		await expect.poll(() => report.isDisplayed()).toBe(true);
		expect(await report.$('.rp-diagnostics__incident .rp-diagnostics__code').getText()).toBe('zone.sidecar-write-uncompensated');
		const note = await report.$$('.rp-diagnostics__note').map((element) => element.getText());
		expect(note).toContain('Affected files could not be named.');
		const path = await incidentsPath(browser);
		expect(note.some((text) => text.includes(path))).toBe(true);
		expect(await report.$$('button').map((element) => element.getText())).toEqual(['Copy report']);
		await browser.keys('Escape');

		// Step 9: the file is read once at load; removing it resumes nothing until the plugin loads again.
		await removeIncidents(browser);
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		expect(await plans()).toEqual(['Ground floor']);

		// Step 10: with the file gone, a reload is live again and the write lands — that one and nothing else.
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);
		expect(await tryNewPlan(browser, ui, 'Attic')).toBe('');
		await expect.poll(plans).toEqual(['Attic', 'Ground floor']);
		await openPlan(browser, ui, 'Ground floor');
		expect(await browser.$(EDITOR).$$('.rp-warning-strip__item').map((item) => item.getText())).toEqual([]);
		expect(await browser.$(EDITOR).$('[data-rp-action="undo"]').getAttribute('disabled')).toBe('true');
	});

	// The fault setup's alternative arm, "worth one run of its own": a file this build cannot
	// read is an OPEN incident, never absence (SDD §87 rule 8).
	desktop('fails closed on an unreadable incidents file and says so in the report', async ({ native: { browser, page, ui } }) => {
		await seedProjectWithPlan(ui);
		await plantIncidents(browser, '{}');
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		await ui.command('show-diagnostics-report');
		const report = browser.$('.rp-diagnostics');
		await expect.poll(() => report.isDisplayed()).toBe(true);
		expect(await report.$('.rp-diagnostics__incident .rp-diagnostics__code').getText()).toBe('write-incident.unreadable');
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
		await seedProjectWithPlan(ui);
		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await page.disablePlugin(PLUGIN_ID);
		await page.enablePlugin(PLUGIN_ID);
		await openPlan(browser, ui, 'Ground floor');
		await expectPaused(browser.$(EDITOR));

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
