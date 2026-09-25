import { expect } from 'vitest';
import type { NativeBrowser } from './session';

const PLUGIN = 'renovation-planner';

/** The plugin's surfaces as a user reaches them: commands, the ribbon, the view's own controls. */
export function createPlannerPage(browser: NativeBrowser) {
	const projectView = () => browser.$('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-project"]');
	const dialog = () => browser.$('.rp-dialog-form');
	return {
		projectView,
		dialog,
		command: (id: string) => browser.executeObsidianCommand(`${PLUGIN}:${id}`),
		leafCount: (type: string) =>
			browser.executeObsidian(({ app }, viewType) => app.workspace.getLeavesOfType(viewType).length, type),
		async openProjectView(): Promise<void> {
			await browser.executeObsidianCommand(`${PLUGIN}:open-project`);
			await expect.poll(() => projectView().isDisplayed()).toBe(true);
		},
		/** Fill and submit whichever create form is open, and wait for its dialog to close. */
		async submitForm(name: string): Promise<void> {
			await expect.poll(() => dialog().isDisplayed()).toBe(true);
			await dialog().$('[data-field="name"]').setValue(name);
			await dialog().$('button[type="submit"]').click();
			await expect.poll(() => dialog().isExisting()).toBe(false);
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

