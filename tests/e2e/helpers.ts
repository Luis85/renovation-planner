import { expect } from 'vitest';
import { PLUGIN_ID, type NativeBrowser } from './session';

export type PlannerPage = ReturnType<typeof createPlannerPage>;

/** The plugin's surfaces as a user reaches them: commands, the ribbon, the view's own controls. */
export function createPlannerPage(browser: NativeBrowser) {
	/** The ACTIVE leaf of a view type — a hidden tab's controls exist and are not interactable. */
	const leaf = (type: string) => browser.$(`.workspace-leaf.mod-active .workspace-leaf-content[data-type="${type}"]`);
	const projectView = () => leaf('renovation-project');
	/** Bring the n-th leaf of a type to the front and make it active, so `leaf()` resolves to it. */
	const activate = async (type: string, index = 0): Promise<void> => {
		await browser.executeObsidian(
			({ app }, viewType, which) => {
				const target = app.workspace.getLeavesOfType(viewType)[which];
				if (!target) throw new Error(`No ${viewType} leaf to activate.`);
				app.workspace.revealLeaf(target);
				app.workspace.setActiveLeaf(target, { focus: true });
			},
			type,
			index,
		);
		await expect.poll(() => leaf(type).isDisplayed()).toBe(true);
	};
	const dialog = () => browser.$('.rp-dialog-form');
	const command = (id: string) => browser.executeObsidianCommand(`${PLUGIN_ID}:${id}`);
	const openProjectView = async (): Promise<void> => {
		await command('open-project');
		await activate('renovation-project');
	};
	/** Fill and submit whichever create form is open, and wait for its dialog to close. */
	const submitForm = async (name: string): Promise<void> => {
		await expect.poll(() => dialog().isDisplayed()).toBe(true);
		await dialog().$('[data-field="name"]').setValue(name);
		await dialog().$('button[type="submit"]').click();
		await expect.poll(() => dialog().isExisting()).toBe(false);
	};
	return {
		leaf,
		activate,
		projectView,
		dialog,
		command,
		openProjectView,
		submitForm,
		leafCount: (type: string) =>
			browser.executeObsidian(({ app }, viewType) => app.workspace.getLeavesOfType(viewType).length, type),
		/** A project with one plan, made through the two real forms, and that plan's editor open and active. */
		async createProjectWithPlan(project: string, plan: string): Promise<void> {
			await openProjectView();
			await projectView().$('.rp-empty-state__action').click();
			await submitForm(project);
			await expect.poll(() => projectView().$('.rp-project-detail__name').getText()).toBe(project);
			await projectView().$('.rp-project-detail__entry-action--secondary').click();
			await submitForm(plan);
			await expect.poll(() => projectView().$('.rp-plan-list__row').isExisting()).toBe(true);
			await projectView().$('.rp-plan-list__row').click();
			await activate('renovation-plan-editor');
		},
		/** Every note in the vault whose frontmatter declares `type`, keyed by path. */
		notesOfType: (type: string) =>
			browser.executeObsidian(({ app }, wanted) => {
				const found: Record<string, Record<string, unknown>> = {};
				for (const file of app.vault.getMarkdownFiles()) {
					const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
					if (frontmatter?.type === wanted) found[file.path] = frontmatter;
				}
				return found;
			}, type),
	};
}

export interface SettingsWindows {
	mainWindow: string;
	settingsWindow: string;
}

/** Obsidian 1.13 opens settings in a window of its own; find it and select this plugin's tab. */
export async function openPluginSettings(browser: NativeBrowser): Promise<SettingsWindows> {
	const tab = () => browser.$('.vertical-tab-nav-item=Renovation Planner');
	const mainWindow = await browser.getWindowHandle();
	await browser.executeObsidianCommand('app:open-settings');
	let settingsWindow = mainWindow;
	await expect
		.poll(async () => {
			for (const handle of await browser.getWindowHandles()) {
				await browser.switchToWindow(handle);
				if (await tab().isExisting()) {
					settingsWindow = handle;
					return true;
				}
			}
			return false;
		})
		.toBe(true);
	await tab().click();
	return { mainWindow, settingsWindow };
}

export async function closePluginSettings(browser: NativeBrowser, windows: SettingsWindows): Promise<void> {
	await browser.switchToWindow(windows.settingsWindow);
	if (windows.settingsWindow === windows.mainWindow) await browser.keys('Escape');
	else await browser.closeWindow();
	await browser.switchToWindow(windows.mainWindow);
}

/** The control of the settings row whose name is exactly `name`. */
export function settingControl(browser: NativeBrowser, name: string, control: string) {
	const row = '//div[contains(concat(" ",normalize-space(@class)," ")," setting-item ")]';
	return browser.$(`${row}[.//div[@class="setting-item-name" and normalize-space(.)="${name}"]]//${control}`);
}

