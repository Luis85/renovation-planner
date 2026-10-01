import { expect } from 'vitest';
import { PLUGIN_ID, type NativeBrowser } from './session';

/**
 * Every toast in the notice container matching `scope`, as its message alone — read from the DOM, not
 * with WebDriver's `getText`. Obsidian builds a notice at `translateX(350px)` and slides it in
 * over ~100 ms inside `.notice-container`, which clips (`overflow: hidden`), so `getText` —
 * visible text only — answers `''` for a notice read inside that slide: the empty-catalogue
 * case failed on exactly that, `[ '' ]`, three times on CI, and Notices step 25 the same way.
 * `isDisplayed` says `true` there, so waiting on it does not help either.
 */
export const noticeMessages = (browser: NativeBrowser, scope = '.notice-container .notice'): Promise<string[]> =>
	browser.execute(
		(selector: string) =>
			[...document.querySelectorAll(selector)].map(
				(notice) => (notice.querySelector('.rp-notice-message') ?? notice.querySelector('.notice-message') ?? notice).textContent ?? '',
			),
		scope,
	);

/** The renderer's own `require`, as far as the two window helpers below reach through it. */
type ElectronRequire = { require(id: '@electron/remote'): { getCurrentWindow(): { getSize(): number[]; setSize(width: number, height: number): void } } };

/**
 * The Obsidian window's outer size, through Electron: Obsidian's chromedriver refuses WebDriver's
 * own `window/rect` (`Browser.getWindowForTarget` wasn't found). The suite's one spelling of a
 * window resize: five copies had it, in two shapes (`@electron/remote` and `electron.remote`).
 */
export const windowSize = async (browser: NativeBrowser): Promise<{ width: number; height: number }> => {
	const [width = 0, height = 0] = await browser.execute(() =>
		(window as unknown as ElectronRequire).require('@electron/remote').getCurrentWindow().getSize(),
	);
	return { width, height };
};

/** Size the window (see `windowSize`). It answers once Electron has taken the size, not once the page has laid out to it. */
export const setWindowSize = async (browser: NativeBrowser, width: number, height: number): Promise<void> => {
	await browser.execute(
		(w: number, h: number) => (window as unknown as ElectronRequire).require('@electron/remote').getCurrentWindow().setSize(w, h),
		Math.round(width),
		Math.round(height),
	);
};

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

/** The plugin instance's settings-write chain, which `RenovationPlannerPlugin` keeps private. */
interface SettingsChain {
	settingsWrites: Promise<void>;
}

/**
 * Wait until every queued settings write has saved AND swapped the root (owner ruling 41).
 *
 * The folder text control saves on every keystroke, and each save runs `applySettings` — a new
 * root, a rescan and a remount of every open view. Closing the settings window does not wait for
 * that queue, so a later step can meet a view WebDriver already holds being remounted (a stale
 * element) or a swap landing in the middle of a create. Re-reads the tail after each await,
 * because a write queued while the previous tail settled is a new tail; the S21 investigation's
 * drained arm (40 of 40 clean) is this loop.
 */
export async function settleSettings(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(async ({ app }, id) => {
		const plugin = (app as unknown as { plugins: { plugins: Record<string, SettingsChain | undefined> } }).plugins.plugins[id];
		if (plugin === undefined) throw new Error(`plugin ${id} is not loaded`);
		for (let turn = 0; turn < 50; turn += 1) {
			const tail = plugin.settingsWrites;
			// A renamed or removed field would read `undefined` twice and "settle" at once.
			if (!(tail instanceof Promise)) throw new Error(`plugin ${id} has no settings-write chain to await`);
			await tail;
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			if (plugin.settingsWrites === tail) return;
		}
		throw new Error('the settings-write queue never settled');
	}, PLUGIN_ID);
}

/** The control of the settings row whose name is exactly `name`. */
export function settingControl(browser: NativeBrowser, name: string, control: string) {
	const row = '//div[contains(concat(" ",normalize-space(@class)," ")," setting-item ")]';
	return browser.$(`${row}[.//div[@class="setting-item-name" and normalize-space(.)="${name}"]]//${control}`);
}

