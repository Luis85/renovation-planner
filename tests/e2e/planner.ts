import { expect } from 'vitest';
import type { ChainablePromiseElement } from 'webdriverio';
import type { createPlannerPage } from './helpers';
import { PLUGIN_ID, type NativeBrowser } from './session';

/**
 * Helpers shared across the PR 231 e2e cases, moved out of `writeIncident.e2e.ts` so later cases
 * (measurements, corner editing, smoke, accessibility, mobile) can reuse them rather than
 * re-declare them.
 */

export type Ui = ReturnType<typeof createPlannerPage>;
export type Pane = ChainablePromiseElement | WebdriverIO.Element;

export const EDITOR = '.workspace-leaf-content[data-type="renovation-plan-editor"]';
export const UNRECOVERED = 'A change was written but could not be completed or undone.';
export const WRITES_PAUSED = 'Writing is paused.';

/** The case's primary fault setup, verbatim: a recognised, fully open stamp with nothing it can name. */
export const PLANTED_INCIDENT = {
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

export const incidentsPath = (browser: NativeBrowser): Promise<string> =>
	browser.executeObsidian(({ app }, id) => `${app.vault.configDir}/plugins/${id}/write-incidents.json`, PLUGIN_ID);

export async function plantIncidents(browser: NativeBrowser, content: string): Promise<void> {
	await browser.executeObsidian(({ app }, path, text) => app.vault.adapter.write(path, text), await incidentsPath(browser), content);
}

export async function removeIncidents(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }, path) => app.vault.adapter.remove(path), await incidentsPath(browser));
}

export async function reloadPlugin(page: ReturnType<NativeBrowser['getObsidianPage']>): Promise<void> {
	await page.disablePlugin(PLUGIN_ID);
	await page.enablePlugin(PLUGIN_ID);
}

/** A project with one plan, made through the real forms, BEFORE any incident pauses writing. */
export async function seedProjectWithPlan(ui: Ui): Promise<void> {
	await ui.openProjectView();
	await ui.projectView().$('.rp-empty-state__action').click();
	await ui.submitForm('Flat');
	await ui.projectView().$('.rp-project-detail__entry-action--secondary').click();
	await ui.submitForm('Ground floor');
	await expect.poll(async () => Object.values(await ui.notesOfType('renovation-plan')).map((plan) => plan.name)).toEqual(['Ground floor']);
}

/** The real `create-sample-project` command: one project, one plan, five zones, then the editor. */
export async function seedSampleProject(browser: NativeBrowser, ui: Ui): Promise<void> {
	await ui.command('create-sample-project');
	await expect.poll(() => browser.$(EDITOR).$('.rp-plan-canvas canvas').isExisting()).toBe(true);
	await expect.poll(async () => Object.keys(await ui.notesOfType('renovation-zone')).length).toBe(5);
}

/** From the project list: into the one project, then the plan named so, until the editor draws. */
export async function openPlan(browser: NativeBrowser, ui: Ui, name: string): Promise<void> {
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
export async function expectPaused(pane: Pane): Promise<void> {
	await expect.poll(() => pane.$('.rp-warning-strip').getText()).toContain(UNRECOVERED);
	expect(await pane.$('[data-rp-action="undo"]').getAttribute('disabled')).toBe('true');
}

/** Try the one write the project view offers, and read what the real form says about it. */
export async function tryNewPlan(browser: NativeBrowser, ui: Ui, name: string): Promise<string> {
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

export const planNames = async (ui: Ui): Promise<string[]> =>
	Object.values(await ui.notesOfType('renovation-plan')).map((plan) => String(plan.name)).toSorted();

/**
 * Renderer-side collector for A01. Installed through the host, so it sees what the plugin logs
 * after the next load. The collector survives a plugin disable and re-enable, because the
 * renderer window does.
 */
export async function collectRendererErrors(browser: NativeBrowser): Promise<void> {
	await browser.execute(() => {
		const sink: string[] = [];
		(window as unknown as { __rpErrors: string[] }).__rpErrors = sink;
		const original = console.error.bind(console);
		console.error = (...args: unknown[]) => {
			sink.push(args.map(String).join(' '));
			original(...args);
		};
		window.addEventListener('error', (event) => sink.push(`error: ${event.message}`));
		window.addEventListener('unhandledrejection', (event) => sink.push(`unhandledrejection: ${String(event.reason)}`));
	});
}

export const rendererErrors = (browser: NativeBrowser): Promise<string[]> =>
	browser.execute(() => (window as unknown as { __rpErrors?: string[] }).__rpErrors ?? []);
