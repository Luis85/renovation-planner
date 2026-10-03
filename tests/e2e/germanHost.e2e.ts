import { describe, expect } from 'vitest';
import { de } from '../../src/presentation/i18n/locales/de';
import { en, type StringKey } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { setWindowSize } from './helpers';
import { recordSaveStates, saveLabel, saveTexts } from './canvas';
import { EDITOR, expectGuide, openDetails, seedSampleProject, selectRoom, textOf, type GuideLocale, type Pane } from './planner';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * The manual steps that say "set Obsidian's language to German", driven in the real host switched
 * to German: the getting-started guide (BP-10) and its "Befehlspalette" / "Werkzeugleiste" against
 * Obsidian's own German, `Notices and save state.md` step 19, `Edit a zone corner by typing its
 * position.md` step 17, `Empty States Walkthrough.md` step 12 with `Navigate into a project and
 * back.md` step 16, and `Read projects on mobile.md` step 9 on the mobile-emulation leg.
 *
 * **The switch is the whole risk, so every case starts by proving it** (`switchToGerman`): the
 * service has no language option, so `localStorage.language` is set and Obsidian restarted over
 * the same profile, and then BOTH `getLanguage()` and a string Obsidian owns must have changed
 * before anything of this plugin's is read. A host that stayed English fails there, loudly, rather
 * than passing every later check against English copy that happens to match.
 *
 * Copy is read from the `de` locale module, never re-typed, and every key a check discriminates
 * on is refused when its German equals its English (`german`): such a check could not tell the
 * two languages apart. Obsidian's own words are read from the host, never from this plugin's locale.
 *
 * Written from source and not yet run when committed: CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;
const mobile = mobileEmulation ? test : test.skip;

/** `de`'s own value. Refused when absent: `t` would fall back to English and the host would draw that. */
const say = (key: StringKey): string => {
	const value = de[key];
	if (value === undefined) throw new Error(`de.ts answers no ${key}, so the host draws English there`);
	return value;
};
const fill = (template: string, params: Readonly<Record<string, string>>): string =>
	template.replace(/\{(\w+)\}/gu, (hole, name: string) => params[name] ?? hole);
/** `say`, refused when the German equals the English: such a check could not tell the languages apart. */
const german = (key: StringKey, params: Readonly<Record<string, string>> = {}): string => {
	if (say(key) === en[key]) throw new Error(`${key} reads "${en[key]}" in both locales and cannot show which one the host drew`);
	return fill(say(key), params);
};

const GERMAN_GUIDE: GuideLocale = { say, quotes: /„([^“]*)“/gu, search: 'Einstiegshilfe' };
/** The two host surfaces the guide's step 1 names. Obsidian has to use them too: "Werkzeugleiste" is its own word for the ribbon (ruling 71, replacing ruling 49's "Menüband"). */
const HOST_WORDS = ['Befehlspalette', 'Werkzeugleiste'] as const;
/** The i18next keys that name the ribbon in Obsidian's own German (CI run 37060108804's evidence line). */
const RIBBON_KEYS = ['interface.menu.ribbon', 'commands.toggle-ribbon', 'setting.appearance.option-show-ribbon'] as const;

/** The core palette command's display name: a string Obsidian owns and translates, never this plugin. */
const paletteCommandName = (browser: NativeBrowser): Promise<string | null> =>
	browser.executeObsidian(
		({ app }) => (app as unknown as { commands: { commands: Record<string, { name: string } | undefined> } }).commands.commands['command-palette:open']?.name ?? null,
	);

/**
 * The language switch every case stands on, and its vacuity guard. `reloadObsidian()` with no
 * vault keeps the session's `--user-data-dir` (wdio-obsidian-service 3.2.1, `createReloadObsidian`),
 * so the key set here is read by the next boot. If it is not — Obsidian reading its language from
 * somewhere else — this fails at the first `expect`, and the fallback is to seed the key before the
 * first boot through `obsidian-launcher`'s `setupConfigDir({ localStorage: { language: 'de' } })`.
 */
async function switchToGerman(browser: NativeBrowser, directory: string): Promise<void> {
	const english = await paletteCommandName(browser);
	expect(english, 'the core command palette is not loaded, so no Obsidian string can show the switch').toEqual(expect.any(String));
	await browser.execute(() => {
		window.localStorage.setItem('language', 'de');
	});
	await browser.reloadObsidian();
	const language = await browser.executeObsidian(({ obsidian }) => obsidian.getLanguage());
	const host = await paletteCommandName(browser);
	await logEvidence(directory, 'language', { english, language, host });
	expect(language, 'Obsidian came back from localStorage.language=de and a restart NOT in German').toBe('de');
	// A null host name would satisfy the `not.toBe` below without proving anything.
	expect(host, 'after the restart the core palette command has no name to compare').toEqual(expect.any(String));
	expect(host, "getLanguage() says de, but Obsidian's own palette command still reads as it did in English").not.toBe(english);
	// The plugin names its commands through `tr` when it loads, so this is the plugin loaded under German.
	await expect
		.poll(() => browser.executeObsidian(({ app }, id) => (app as unknown as { commands: { commands: Record<string, { name: string } | undefined> } }).commands.commands[`${id}:open-help`]?.name ?? '', PLUGIN_ID))
		.toContain(german('command.open-help'));
}

/**
 * What Obsidian's own German says, read from the host and never from this plugin's locale: every core
 * command's name (what the palette lists, this plugin's own left out so a hit is Obsidian's word and never
 * this plugin's echo) and i18next's loaded German table (`window.i18next`, reachable in 1.13.7; the
 * evidence line carries the count). The ribbon is named by the three i18next keys of RIBBON_KEYS, found by
 * the end of their path so the case does not depend on how the table nests them. The Appearance settings
 * tab is NOT read: its rows drew none on the first CI run, and the table above already holds its strings.
 */
const hostWords = (browser: NativeBrowser) =>
	browser.executeObsidian(
		({ app }, keys, plugin) => {
			const host = app as unknown as { commands: { listCommands(): { id: string; name: string }[] } };
			const commands = host.commands.listCommands().filter((command) => !command.id.startsWith(`${plugin}:`)).map((command) => command.name);
			const table: [string, string][] = [];
			const walk = (node: unknown, path: string): void => {
				if (typeof node === 'string') table.push([path, node]);
				else if (node !== null && typeof node === 'object') for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
			};
			const i18n = (window as unknown as { i18next?: { language?: string; store?: { data?: Record<string, unknown> } } }).i18next;
			walk(i18n?.store?.data?.[i18n.language ?? ''] ?? null, i18n?.language ?? '');
			return {
				commands: commands.length,
				i18next: table.length,
				i18nLanguage: i18n?.language ?? null,
				palette: commands.filter((name) => name.includes('Befehlspalette')).slice(0, 8),
				ribbon: Object.fromEntries(keys.map((key) => [key, table.filter(([path]) => path.endsWith(`.${key}`)).map(([, text]) => text)])),
			};
		},
		[...RIBBON_KEYS],
		PLUGIN_ID,
	);

describe('the getting-started guide in a German Obsidian (BP-10, ruling 49)', () => {
	// Every leg, as the English case: the guide reads the same on a phone.
	test('the host switches to German, and the guide opens from the palette with every quoted control in German', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		await expectGuide(browser, ui, directory, GERMAN_GUIDE);
	});

	desktop('"Befehlspalette" and "Werkzeugleiste" are Obsidian\'s own German words, and the guide\'s step 1 uses both', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		const found = await hostWords(browser);
		await logEvidence(directory, 'host-words', found);
		// The instrument reached something: an empty table would find no word and say nothing about Obsidian.
		expect(found.commands).toBeGreaterThan(0);
		expect(found.i18next, 'window.i18next exposes no German table, so the ribbon word was not read').toBeGreaterThan(0);
		expect(found.palette, 'Obsidian\'s German names no command with "Befehlspalette"').not.toEqual([]);
		for (const key of RIBBON_KEYS) {
			expect(found.ribbon[key], `Obsidian's German has no ${key}`).not.toEqual([]);
			for (const text of found.ribbon[key]) expect(text, `Obsidian's German calls the ribbon something else in ${key}`).toContain('Werkzeugleiste');
		}

		await ui.command('open-help');
		const modal = browser.$('.modal-container .modal');
		await expect.poll(() => textOf(modal.$('.modal-title'))).toBe(german('help.guide.title'));
		const first = await textOf(modal.$('.modal-content > ol > li'));
		for (const word of HOST_WORDS) expect(first).toContain(word);
	});
});

/** Every toast this plugin raised: its severity word, its sentence, and its dismiss control's accessible name. */
const noticeParts = (browser: NativeBrowser): Promise<{ severity: string; message: string; dismiss: string }[]> =>
	browser.execute(() =>
		[...document.querySelectorAll('.notice-container .notice:has(.rp-notice-message)')].map((notice) => ({
			severity: notice.querySelector('.rp-notice-severity')?.textContent?.trim() ?? '',
			message: notice.querySelector('.rp-notice-message')?.textContent ?? '',
			dismiss: notice.querySelector('.rp-notice-dismiss')?.getAttribute('aria-label') ?? '',
		})),
	);

/**
 * Step 2 asks for a vault with no PNG, JPEG or PDF, and the e2e vault ships two (the reference
 * fixtures). This removes them from the case's own COPY of the vault, never from `tests/e2e/vault/`.
 */
async function removeBackgroundFiles(browser: NativeBrowser): Promise<void> {
	const left = await browser.executeObsidian(async ({ app }) => {
		const kinds = new Set(['png', 'jpg', 'jpeg', 'pdf']);
		for (const file of app.vault.getFiles().filter((candidate) => kinds.has(candidate.extension.toLowerCase()))) await app.vault.delete(file);
		return app.vault.getFiles().filter((candidate) => kinds.has(candidate.extension.toLowerCase())).map((file) => file.path);
	});
	expect(left).toEqual([]);
}

describe('Notices and save state step 19, in German', () => {
	desktop('the severity words, the dismiss control\'s name and the save states read in German', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		// Step 1: `Open plan editor` in a vault with no plans. `Information` is spelled alike in both
		// locales, so it is read as itself; the sentence and the dismiss name are what tell them apart.
		await ui.command('open-plan-editor');
		await expect
			.poll(() => noticeParts(browser))
			.toContainEqual({ severity: say('notice.severity.info'), message: german('plan.none'), dismiss: german('notice.dismiss') });

		// Step 2: `Set plan background` with nothing that can be one.
		await removeBackgroundFiles(browser);
		await seedSampleProject(browser, ui);
		await ui.activate('renovation-plan-editor');
		await ui.command('set-plan-background');
		await expect
			.poll(() => noticeParts(browser))
			.toContainEqual({ severity: german('notice.severity.warning'), message: german('background.unsupported'), dismiss: german('notice.dismiss') });
		await logEvidence(directory, 'notices', await noticeParts(browser));

		// Step 13, and the two more states one write shows: Saved at rest, then Saving, then "just now".
		const saved = { state: 'rp-save-state-saved', text: german('save-state.saved') };
		await expect.poll(() => saveLabel(browser)).toEqual(saved);
		await openDetails(browser);
		const lock = browser.$(EDITOR).$('[data-rp-region="inspector"] [data-rp-lock]');
		await expect.poll(() => lock.isDisplayed()).toBe(true);
		await recordSaveStates(browser);
		// A script click: the warning from step 2 stays up (it never times out) and may sit over the drawer.
		await browser.execute((button: HTMLElement) => button.click(), await lock.getElement());
		await expect.poll(() => saveTexts(browser)).toContainEqual(expect.stringContaining(german('save-state.saving')));
		await expect.poll(() => saveLabel(browser)).toEqual(saved);
		await logEvidence(directory, 'save-texts', await saveTexts(browser));
		expect(await textOf(browser.$(EDITOR).$('.rp-save-state-label'))).toContain(german('save-state.saved-just-now'));
	});
});

/** The window `nextActionWalk.e2e.ts`'s `widenWindow` documents: the Inspector beside the stage, not a drawer over it. */
async function widenWindow(browser: NativeBrowser): Promise<void> {
	await setWindowSize(browser, 1280, 1024);
	await expect.poll(() => browser.execute(() => window.innerWidth)).toBeGreaterThanOrEqual(1270);
}

/** Steps 2 and 5 of the corner case: the open dialog, its hint, its corner list, and corner 3 chosen. */
async function expectCornerDialog(browser: NativeBrowser, name: string): Promise<void> {
	const dialog = browser.$('.rp-dialog');
	await expect.poll(() => textOf(dialog.$('.rp-dialog-title'))).toBe(german('editor.element.edit', { name }));
	const form = dialog.$('[data-rp-form="outline-points"]');
	const status = form.$('[data-rp-corner-status]');
	expect({
		hint: await textOf(form.$('p')),
		status: await textOf(status),
		list: await form.$('[data-rp-corner-list]').getAttribute('aria-label'),
		firstCorner: (await textOf(form.$('[data-rp-corner-list] li span'))).startsWith(german('editor.area.corner-position', { n: '1' }).split('{x}')[0]),
		legend: await textOf(form.$('fieldset legend')),
		field: await textOf(form.$('fieldset .rp-dialog-field')),
	}).toEqual({
		hint: german('editor.area.coordinates-hint'),
		status: german('editor.area.coordinates'),
		list: german('editor.area.coordinates'),
		firstCorner: true,
		legend: german('editor.area.corner', { n: '1' }),
		field: german('editor.area.x'),
	});
	const choose = await form.$$('[data-rp-corner="choose"]');
	expect(choose.length).toBeGreaterThanOrEqual(3);
	expect({ text: await textOf(choose[2]), name: await choose[2].getAttribute('aria-label') }).toEqual({
		text: german('editor.area.edit'),
		name: german('editor.area.edit-corner', { n: '3' }),
	});
	await choose[2].click();
	await expect.poll(() => textOf(status)).toBe(german('editor.area.corner', { n: '3' }));
	expect(await browser.execute(() => (document.activeElement as HTMLInputElement | null)?.name ?? null)).toBe('2.x');
	await browser.keys('Escape');
	await expect.poll(() => dialog.isExisting()).toBe(false);
}

describe('Edit a zone corner step 17, in German', () => {
	desktop('both doors read "Eckpunkte bearbeiten", and the dialog, its corner list and its fields are German', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		await widenWindow(browser);
		await seedSampleProject(browser, ui);
		const kitchen = say('sample.zone.kitchen');
		const pane = browser.$(EDITOR);
		// Step 3's door first: selecting from the Floor inspector's list replaces that list, so a
		// second room cannot be picked from it after.
		await selectRoom(browser, kitchen);
		const button = pane.$('.rp-room-inspector [data-rp-action="edit-outline"]');
		expect(await textOf(button)).toBe(german('editor.area.outline'));
		await button.click();
		await expectCornerDialog(browser, kitchen);

		// Step 1's door: the same menu a right-click opens (`CanvasContextMenu.vue`), opened from the
		// keyboard on the canvas, over the room still selected.
		const canvas = await pane.$('.rp-plan-canvas').getElement();
		await browser.execute((element: HTMLElement) => element.focus(), canvas);
		await browser.keys(['Shift', 'F10']);
		const entry = pane.$('.rp-canvas-context-menu [data-rp-context-action="edit-outline"]');
		await expect.poll(() => entry.isExisting()).toBe(true);
		expect(await textOf(entry)).toBe(german('editor.area.outline'));
		await entry.click();
		await expectCornerDialog(browser, kitchen);
	});
});

const panelOf = async (view: Pane) => ({
	headline: await textOf(view.$('.rp-empty-state__headline')),
	body: await textOf(view.$('.rp-empty-state__body')),
	action: await textOf(view.$('.rp-empty-state__action')),
});

/** The label text of a dialog field, without the control's own options. */
const fieldLabel = (browser: NativeBrowser, field: string): Promise<string> =>
	browser.execute((selector: string) => document.querySelector(selector)?.closest('label')?.firstChild?.textContent?.trim() ?? '', `.rp-dialog [data-field="${field}"]`);

describe('the Renovation project view, in German', () => {
	desktop('Empty States step 12 and Navigate step 16: the panel, the detail and the New plan dialog read in German', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		await ui.openProjectView();
		const view = ui.projectView();
		expect(await panelOf(view)).toEqual({
			headline: german('empty.project.no-projects.headline'),
			body: german('empty.project.no-projects.body'),
			action: german('empty.project.no-projects.action'),
		});

		await view.$('.rp-empty-state__action').click();
		await expect.poll(() => textOf(browser.$('.rp-dialog .rp-dialog-title'))).toBe(german('form.new-project.title'));
		await ui.submitForm('Wohnung');
		// Navigate step 2's detail: its header, the Plans region and that region's empty state.
		await expect.poll(() => textOf(view.$('.rp-project-detail__name'))).toBe('Wohnung');
		expect({
			back: await textOf(view.$('.rp-project-detail__back')),
			status: await textOf(view.$('.rp-project-detail__status')),
			openNote: await textOf(view.$('.rp-project-detail__open-note')),
			plans: await textOf(view.$('.rp-plan-list__title')),
			empty: await textOf(view.$('.rp-plan-list__empty')),
			newPlan: await textOf(view.$('.rp-plan-list__create')),
		}).toEqual({
			back: german('view.project.back'),
			status: german('form.new-project.status.idea'),
			openNote: german('view.project.open-note'),
			plans: german('view.project.plans-title'),
			empty: german('empty.project.no-plans.body'),
			newPlan: german('view.project.create-plan'),
		});

		// Step 9: the New plan dialog, then the plan in the list without reopening the pane.
		await view.$('.rp-plan-list__create').click();
		await expect.poll(() => textOf(browser.$('.rp-dialog .rp-dialog-title'))).toBe(german('form.new-plan.title'));
		expect({ kind: await fieldLabel(browser, 'kind'), submit: await textOf(ui.dialog().$('button[type="submit"]')) }).toEqual({
			kind: german('form.new-plan.kind'),
			submit: german('dialog.form.submit'),
		});
		await ui.submitForm('Erdgeschoss');
		await expect.poll(() => textOf(view.$('.rp-plan-list__title'))).toBe(german('view.project.plans-count', { count: '1' }));

		// Step 5: the detail's own way back, to a list whose header is German too.
		await view.$('.rp-project-detail__back').click();
		await expect.poll(() => textOf(view.$('.rp-project-list__create'))).toBe(german('view.project.create'));
		await logEvidence(directory, 'project-view', { done: true });
	});
});

/** Whether a sentence is drawn (a box with size) and stays inside its pane: its box within the leaf's, nothing clipped inside it. */
const fitsPane = (browser: NativeBrowser, element: WebdriverIO.Element) =>
	browser.execute((sentence: HTMLElement) => {
		const pane = sentence.closest('.workspace-leaf-content')?.getBoundingClientRect();
		const box = sentence.getBoundingClientRect();
		return {
			paneWidth: Math.round(pane?.width ?? 0),
			inside: pane !== undefined && box.left >= pane.left - 0.5 && box.right <= pane.right + 0.5,
			clipped: sentence.scrollWidth > sentence.clientWidth,
			shown: box.width > 0 && box.height > 0,
		};
	}, element);

describe('Read projects on mobile step 9, in German', () => {
	mobile('both read-only sentences read in German and neither runs off the pane', async ({ native: { browser, ui, directory } }) => {
		await switchToGerman(browser, directory);
		await ui.openProjectView();
		const readOnly = ui.projectView().$('.rp-mobile-notice');
		await expect.poll(() => textOf(readOnly)).toBe(german('view.mobile.read-only'));
		const listFit = await fitsPane(browser, await readOnly.getElement());

		// The editor refuses in `sync()` whatever plan it is handed, which is the restore path step 7 names.
		await browser.executeObsidian(async ({ app }, type) => {
			await app.workspace.getLeaf('tab').setViewState({ type, active: true, state: { planId: 'plan-from-a-desktop-session' } });
		}, 'renovation-plan-editor');
		await ui.activate('renovation-plan-editor');
		const refusal = ui.leaf('renovation-plan-editor').$('.rp-view-message');
		await expect.poll(() => textOf(refusal)).toBe(german('view.mobile.desktop-only'));
		const editorFit = await fitsPane(browser, await refusal.getElement());
		await logEvidence(directory, 'mobile-fit', { listFit, editorFit });
		for (const fit of [listFit, editorFit]) expect(fit).toEqual({ paneWidth: expect.any(Number), inside: true, clipped: false, shown: true });
		expect(Math.min(listFit.paneWidth, editorFit.paneWidth)).toBeGreaterThan(0);
	});
});
