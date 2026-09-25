import { describe, expect } from 'vitest';
import { AxeBuilder } from '@axe-core/webdriverio';
import { test } from './fixture';
import { closePluginSettings, openPluginSettings, settingControl } from './helpers';
import { writeEvidence } from './diagnostics';
import { mobileEmulation } from './session';

// On mobile the plugin is view-only by design (`mobileRefusal.ts`), and the Plan Editor draws no
// canvas there, so every case that WRITES runs on the desktop legs and the mobile leg checks the refusal.
const desktop = mobileEmulation ? test.skip : test;
const mobile = mobileEmulation ? test : test.skip;

describe('Renovation Planner in the real Obsidian host', () => {
	mobile('offers viewing only, with creation refused and saying why', async ({ native: { ui } }) => {
		await ui.openProjectView();
		expect(await ui.projectView().$('.rp-mobile-notice').getText()).toBe('Available for viewing on mobile. Changes need a desktop.');
		expect(await ui.projectView().$('.rp-empty-state__action').getAttribute('aria-disabled')).toBe('true');
	});

	desktop('opens ONE project view from the ribbon and the command, drawing the empty state', async ({
		native: { browser, ui },
	}) => {
		await browser.$('.side-dock-ribbon-action[aria-label="Open renovation project"]').click();
		await expect.poll(() => ui.projectView().isDisplayed()).toBe(true);
		await ui.command('open-project');
		expect(await ui.leafCount('renovation-project')).toBe(1);
		expect(await ui.projectView().$('.rp-empty-state__headline').getText()).toBe('No projects yet');
	});

	desktop('creates a project note through the real form and opens it', async ({ native: { ui } }) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Kitchen');
		await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Kitchen');
		const notes = await ui.notesOfType('renovation-project');
		expect(Object.keys(notes)).toEqual(['Renovation/Kitchen/Kitchen.md']);
		expect(notes['Renovation/Kitchen/Kitchen.md']).toMatchObject({ name: 'Kitchen', status: 'idea', revision: 1 });
	});

	// `docs/tests/cases/Navigate into a project and back.md`'s arrow steps, which no fake leaf can
	// answer for — and what the real host answered is a DEFECT, this suite's first finding.
	// Pinned POSITIVELY rather than held as `.fails`: a `.fails` case is also green when the row
	// selector breaks, so it could never say which of the two it was seeing. Row click and the
	// in-app back both navigate, `setState` sets `ViewStateResult.history`, and the pane's back
	// arrow stays disabled regardless — Obsidian 1.13.7 records nothing in the leaf's history.
	// This case turns red the day the arrows walk it; rewrite it to walk them then.
	desktop('pins that the pane arrows do NOT yet walk project navigation', async ({ native: { ui } }) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Bathroom');
		await ui.projectView().$('.rp-project-detail__back').click();
		const row = () => ui.projectView().$('.rp-project-row');
		await expect.poll(() => row().isDisplayed()).toBe(true);
		await row().click();
		await expect.poll(() => ui.projectView().$('.rp-project-detail__name').getText()).toBe('Bathroom');
		expect(await ui.leafCount('renovation-project')).toBe(1);
		const backArrow = ui.projectView().$('.view-header-nav-buttons button');
		expect(await backArrow.getAttribute('aria-label')).toBe('Navigate back');
		expect(await backArrow.getAttribute('aria-disabled')).toBe('true');
	});

	desktop('keeps a created project across a real plugin reload', async ({ native: { page, ui } }) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Attic');
		await page.disablePlugin('renovation-planner');
		await page.enablePlugin('renovation-planner');
		await ui.openProjectView();
		await expect.poll(() => ui.projectView().$('.rp-project-list__name').getText()).toBe('Attic');
	});

	desktop('creates a plan and opens it in the Plan Editor canvas', async ({ native: { browser, ui } }) => {
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Garage');
		await ui.projectView().$('.rp-project-detail__entry-action--secondary').click();
		await ui.submitForm('Ground floor');
		await expect.poll(async () => Object.values(await ui.notesOfType('renovation-plan')).map((plan) => plan.name)).toEqual(['Ground floor']);
		await ui.projectView().$('.rp-plan-list__row').click();
		const editor = browser.$('.workspace-leaf-content[data-type="renovation-plan-editor"]');
		await expect.poll(() => editor.$('.rp-plan-canvas canvas').isExisting()).toBe(true);
	});

	desktop('applies the folder and currency chosen in the host settings window to a new project', async ({
		native: { browser, ui },
	}) => {
		const windows = await openPluginSettings(browser);
		// Seven declarative rows — the count `tests/plugin/settings/unrecovered.test.ts` pins, drawn by the host.
		await expect.poll(() => browser.$$('.vertical-tab-content .setting-item').length).toBe(7);
		await settingControl(browser, 'Default projects folder', 'input').setValue('Jobs');
		await browser.keys('Tab');
		await settingControl(browser, 'Default currency', 'select').selectByAttribute('value', 'CHF');
		await closePluginSettings(browser, windows);
		await ui.openProjectView();
		await ui.projectView().$('.rp-empty-state__action').click();
		await ui.submitForm('Cellar');
		// Polled: the metadata cache indexes a new note a beat after the write resolves.
		await expect.poll(() => ui.notesOfType('renovation-project')).toEqual({
			'Jobs/Cellar/Cellar.md': expect.objectContaining({ name: 'Cellar', currency: 'CHF' }),
		});
	});

	// BOTH themes, because contrast is a fact about one: the mobile notice failed only in light,
	// and a machine rendering dark passed it. `changeTheme` is Obsidian's own, untyped.
	test.for(['moonstone', 'obsidian'])(
		'has no automated WCAG A/AA violations in the project view (%s theme)',
		async (theme, { native: { browser, ui, directory } }) => {
			await browser.executeObsidian(({ app }, name) => {
				(app as unknown as { changeTheme(theme: string): void }).changeTheme(name);
			}, theme);
			await ui.openProjectView();
			// Electron lacks window/new, so axe's legacy mode; there are no cross-origin frames here
			// and no rule is disabled. Unlike jsdom, a real renderer lets axe grade colour contrast.
			const result = await new AxeBuilder({ client: browser })
				.include('.workspace-leaf-content[data-type="renovation-project"] .view-content')
				.setLegacyMode()
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze();
			await writeEvidence(directory, 'accessibility', result);
			// An include that matched nothing would report no violations too.
			expect(result.passes.map((rule) => rule.id)).toContain('color-contrast');
			expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
		},
	);
});
