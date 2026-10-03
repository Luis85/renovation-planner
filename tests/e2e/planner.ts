import { expect } from 'vitest';
import type { ChainablePromiseElement } from 'webdriverio';
import { en, type StringKey } from '../../src/presentation/i18n/locales/en';
import { logEvidence } from './diagnostics';
import { setWindowSize, type createPlannerPage } from './helpers';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * Helpers shared across the PR 231 e2e cases, moved out of `writeIncident.e2e.ts` so later cases
 * (measurements, corner editing, smoke, accessibility, mobile) can reuse them rather than
 * re-declare them.
 */

export type Ui = ReturnType<typeof createPlannerPage>;
export type Pane = ChainablePromiseElement | WebdriverIO.Element;

export const EDITOR = '.workspace-leaf-content[data-type="renovation-plan-editor"]';
/** The editor in the ACTIVE leaf: `browser.$(EDITOR)` is the first in the DOM, which is a hidden one once a second plan is open. */
const ACTIVE_EDITOR = `.workspace-leaf.mod-active ${EDITOR}`;
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

/**
 * Notices step 24's fault: a `data.json` that will not parse — `{`, the content the unit suite's own
 * Obsidian walk used (`tests/plugin/settings/unrecovered.test.ts`). Obsidian's `loadData()` resolves
 * EMPTY for it and the file is on disk, which `loadSettings` reads as unrecovered at the next load.
 */
export async function corruptSettings(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }, id) => app.vault.adapter.write(`${app.vault.configDir}/plugins/${id}/data.json`, '{'), PLUGIN_ID);
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

/**
 * 1280 x 1024, the CI display's own size: main's window-manager rule leaves Obsidian at 1024 x 800,
 * where a split pane falls under the editor's 400 px minimum and draws no canvas. Both sidebars
 * collapsed too, so two panes side by side are ~640 px each.
 */
export async function widen(browser: NativeBrowser): Promise<void> {
	await setWindowSize(browser, 1280, 1024);
	await expect.poll(() => browser.execute(() => window.innerWidth)).toBeGreaterThanOrEqual(1270);
	await browser.executeObsidian(({ app }) => {
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
	});
}

/**
 * The layout written NOW, through Obsidian's own debouncer (scheduled, then `run()` flushes it),
 * so a restart restores what was just arranged rather than whatever the last debounced save caught.
 */
export async function saveLayout(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(async ({ app }) => {
		app.workspace.requestSaveLayout();
		await app.workspace.requestSaveLayout.run();
	});
}

/** Add ▸ Room in `pane` (the first editor by default), typed rather than dragged: a name, 2 m by 2 m at the stage's centre, Create room. */
export async function addRoom(browser: NativeBrowser, name: string, pane: Pane = browser.$(EDITOR)): Promise<void> {
	// A JS click, as `writeIncident.e2e.ts` takes it: something may float over the Add button.
	await browser.execute((button: HTMLElement) => button.click(), await pane.$('[data-rp-action="add"]'));
	await pane.$('.rp-add-menu__item[data-rp-entry="room"]').click();
	const form = pane.$('.rp-new-room');
	await expect.poll(() => form.isDisplayed()).toBe(true);
	await form.$('.rp-new-room__name').setValue(name);
	for (const axis of ['width', 'depth']) {
		await form.$(`input[name="${axis}"]`).setValue('2');
		await browser.keys('Enter');
	}
	const create = form.$('.rp-new-room__create');
	await expect.poll(() => create.getAttribute('aria-disabled')).toBe('false');
	await create.click();
}

/**
 * Notices steps 2 and 3 ask for a vault with no PNG, JPEG or PDF, and the e2e vault ships two (the
 * reference fixtures). This removes them from the case's own COPY of the vault, never from `tests/e2e/vault/`.
 */
export async function removeBackgroundFiles(browser: NativeBrowser): Promise<void> {
	const left = await browser.executeObsidian(async ({ app }) => {
		const kinds = new Set(['png', 'jpg', 'jpeg', 'pdf']);
		for (const file of app.vault.getFiles().filter((candidate) => kinds.has(candidate.extension.toLowerCase()))) await app.vault.delete(file);
		return app.vault.getFiles().filter((candidate) => kinds.has(candidate.extension.toLowerCase())).map((file) => file.path);
	});
	expect(left).toEqual([]);
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
	// The ACTIVE editor: with another plan already open in a hidden tab, the first match is that one.
	await expect.poll(() => browser.$(ACTIVE_EDITOR).$('.rp-plan-canvas canvas').isExisting()).toBe(true);
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

/**
 * The note the assign picker offers. Written as a note rather than through the Asset library's
 * create form, because the asset is a fixture and not the subject: the index finds a note by what
 * its frontmatter declares, wherever it sits.
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

/** The Room Inspector's quantity override (`RequirementRow.vue`), drawn once a requirement exists. */
export const QUANTITY = '[data-field="quantity"]';
export const requirements = async (ui: Ui) => Object.values(await ui.notesOfType('renovation-requirement'));

/** The Details panel of `pane` (the first editor by default), opened first when the pane is narrow enough to fold it behind its rail. */
export async function openDetails(browser: NativeBrowser, pane: Pane = browser.$(EDITOR)): Promise<void> {
	const rail = pane.$('[data-rp-rail="details"]');
	if (await rail.isDisplayed()) await rail.click();
}

/** Through the Floor inspector's room list of `pane` (the first editor by default), opening the Details panel first when the pane is narrow. */
export async function selectRoom(browser: NativeBrowser, name: string, pane: Pane = browser.$(EDITOR)): Promise<void> {
	await openDetails(browser, pane);
	// The room list is drawn twice from the same records (useSpatialRecords.ts): once in the
	// Layers panel's Rooms section (PropertyLayerPanel.vue) and once in the Floor inspector's
	// own list (FloorInspector.vue via FloorSpatialLists.vue). At the full-width layout
	// (ResponsiveEditorShell.vue) both panels are visible at once, so an unscoped query finds
	// two rows there. Scope to the inspector region (`data-rp-region="inspector"`,
	// EntityInspector.vue): its row is the one whose click opens `.rp-room-inspector` below,
	// and it carries exactly one row per room at any width.
	const rows = await pane.$('[data-rp-region="inspector"]').$$(`.rp-room-list__row*=${name}`);
	expect(rows).toHaveLength(1);
	await rows[0].click();
	await expect.poll(() => pane.$('.rp-room-inspector').isExisting()).toBe(true);
}

/** The sample project, one asset, and one requirement on the Kitchen whose quantity field is drawn. */
export async function seedKitchenRequirement(browser: NativeBrowser, ui: Ui): Promise<void> {
	await browser.executeObsidian(async ({ app }, text) => {
		await app.vault.create('Floor tile.md', text);
	}, ASSET_NOTE);
	await seedSampleProject(browser, ui);
	await selectRoom(browser, 'Kitchen');
	const pane = browser.$(EDITOR);
	await expect.poll(() => pane.$(`#rp-assign-asset option[value="${ASSET_ID}"]`).isExisting()).toBe(true);
	await pane.$('#rp-assign-asset').selectByAttribute('value', ASSET_ID);
	await pane.$('.rp-editor-requirement-assign button').click();
	await expect.poll(async () => (await requirements(ui)).length).toBe(1);
	await expect.poll(() => browser.$(QUANTITY).isDisplayed()).toBe(true);
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

/** What a control renders, read whether or not a narrow pane shows it right now, and from the DOM rather than `getText`. */
export const textOf = async (element: Pane): Promise<string> => String(await (await element.getElement()).getProperty('textContent')).trim();

/**
 * One language's half of the getting-started guide check: the copy the guide is read against, the
 * quotation marks that language puts round a control's label, and what is typed into the palette.
 * The English case (`nextActionWalk.e2e.ts`) and the German one (`germanHost.e2e.ts`) walk the same
 * controls through this one function, so the two cannot drift into checking different things.
 */
export interface GuideLocale {
	say: (key: StringKey) => string;
	quotes: RegExp;
	search: string;
}

export const ENGLISH_GUIDE: GuideLocale = { say: (key) => en[key], quotes: /“([^”]*)”/gu, search: 'getting-started' };

/** The plugin's commands by the name the palette shows, with the plugin's own prefix taken off. */
const commandLabels = (browser: NativeBrowser, ids: readonly string[]): Promise<{ prefix: string; labels: string[] }> =>
	browser.executeObsidian(
		({ app }, plugin, wanted) => {
			const host = app as unknown as {
				commands: { commands: Record<string, { name: string } | undefined> };
				plugins: { manifests: Record<string, { name: string } | undefined> };
			};
			const prefix = `${host.plugins.manifests[plugin]?.name ?? ''}: `;
			const labels = wanted.map((id) => {
				const shown = host.commands.commands[`${plugin}:${id}`]?.name ?? '';
				return shown.startsWith(prefix) ? shown.slice(prefix.length) : `(not prefixed) ${shown}`;
			});
			return { prefix, labels };
		},
		PLUGIN_ID,
		ids,
	);

/**
 * Every desktop control the guide quotes, walked to in the real host and read as it renders:
 * a project and an EMPTY plan made through the real forms, so the project detail, the plan list,
 * the floor start, the Add menu and the New room form all draw. Then the sample project, whose
 * name BP-10 asks after.
 */
async function walkDesktopControls(browser: NativeBrowser, ui: Ui, openProject: string, sampleName: string): Promise<Record<string, string>> {
	const view = ui.projectView();
	// The guide sends the reader to the palette OR the ribbon, so the ribbon must say the same.
	expect(await browser.$(`.side-dock-ribbon-action[aria-label="${openProject}"]`).isExisting()).toBe(true);
	await view.$('.rp-empty-state__action').click();
	await ui.submitForm('Flat');
	const firstPlan = view.$('.rp-project-detail__entry-action--secondary');
	await expect.poll(() => firstPlan.isDisplayed()).toBe(true);
	const labels: Record<string, string> = { createFirstPlan: await textOf(firstPlan) };
	await firstPlan.click();
	await ui.submitForm('Ground floor');
	await expect.poll(() => view.$('.rp-plan-list__create').isDisplayed()).toBe(true);
	labels.newPlan = await textOf(view.$('.rp-plan-list__create'));
	await view.$('.rp-project-detail__back').click();
	await expect.poll(() => view.$('.rp-project-list__create').isDisplayed()).toBe(true);
	labels.newProject = await textOf(view.$('.rp-project-list__create'));

	await openPlan(browser, ui, 'Ground floor');
	const editor = browser.$(EDITOR);
	await expect.poll(() => editor.$('.rp-floor-start').isDisplayed()).toBe(true);
	labels.addRooms = await textOf(editor.$('[data-rp-route="rooms"] .rp-floor-start__title'));
	labels.upload = await textOf(editor.$('[data-rp-route="reference"] .rp-floor-start__title'));
	const add = editor.$('[data-rp-action="add"]');
	labels.add = String(await add.getAttribute('aria-label'));
	// A JS click: the floor start floats over the Add button on a plan with no rooms.
	await browser.execute((button: HTMLElement) => button.click(), await add);
	const entry = (id: string) => browser.$(`.rp-add-menu__item[data-rp-entry="${id}"] .rp-add-menu__item-label`);
	await expect.poll(() => entry('room').isExisting()).toBe(true);
	labels.room = await textOf(entry('room'));
	labels.asset = await textOf(entry('asset'));
	await browser.keys('Escape');
	await expect.poll(() => entry('room').isExisting()).toBe(false);
	await editor.$('[data-rp-route="rooms"]').click();
	await expect.poll(() => editor.$('.rp-new-room__create').isExisting()).toBe(true);
	labels.createRoom = await textOf(editor.$('.rp-new-room__create'));
	await browser.keys('Escape');

	await seedSampleProject(browser, ui);
	await expect.poll(async () => Object.values(await ui.notesOfType('renovation-project')).map((project) => project.name)).toContain(sampleName);
	return labels;
}

const holesOf = (template: string): string[] => [...template.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]);
const STEP_KEYS = (Object.keys(en) as StringKey[]).filter((key) => key.startsWith('help.guide.step-')).toSorted();

/**
 * The guide opened from Obsidian's own palette, and every control it quotes carrying exactly the
 * label that control renders. Every leg: the guide is a plain `callback` and reads the same on a
 * phone, where only the controls a read-only view still draws can be walked to.
 */
export async function expectGuide(browser: NativeBrowser, ui: Ui, directory: string, { say, quotes, search }: GuideLocale): Promise<void> {
	const commands = ['open-project', 'create-sample-project', 'show-diagnostics-report', 'open-help'] as const;
	const { prefix, labels: names } = await commandLabels(browser, commands);
	const rendered: Record<string, string> = { openProject: names[0], sample: names[1], diagnostics: names[2], openHelp: names[3] };
	await ui.openProjectView();
	rendered.createProject = await textOf(ui.projectView().$('.rp-empty-state__action'));
	rendered.newAsset = await textOf(ui.projectView().$('.rp-view-aside__create-asset'));
	rendered.library = await textOf(ui.projectView().$('.rp-view-aside__open-library'));
	if (!mobileEmulation) Object.assign(rendered, await walkDesktopControls(browser, ui, rendered.openProject, say('sample.project.name')));
	await logEvidence(directory, 'guide-labels', rendered);

	await browser.executeObsidianCommand('command-palette:open');
	const input = browser.$('.prompt-input');
	await expect.poll(() => input.isDisplayed()).toBe(true);
	await input.setValue(search);
	// The palette splits a command's name at its first ": " into a `.suggestion-prefix` span and
	// the rest, dropping the separator (1.13.7's own renderer, read from the app bundle), so the
	// plugin's name is asserted as ITS node: another plugin's same-named command cannot pass.
	const plugin = prefix.slice(0, -': '.length);
	const title = browser.$('.suggestion-item.is-selected .suggestion-title');
	await expect
		.poll(async () => ({ plugin: await title.$('.suggestion-prefix').getText(), title: await title.getText() }))
		.toEqual({ plugin, title: `${plugin}${rendered.openHelp}` });
	await browser.keys('Enter');

	const modal = browser.$('.modal-container .modal');
	await expect.poll(() => modal.$('.modal-title').getText()).toBe(say('help.guide.title'));
	const steps = await modal.$$('.modal-content > ol > li').map((item) => item.getText());
	expect(steps).toHaveLength(STEP_KEYS.length);
	const unchecked = new Set<string>();
	STEP_KEYS.forEach((key, index) => {
		const holes = holesOf(say(key));
		const quoted = [...steps[index].matchAll(quotes)].map((match) => match[1]);
		for (const hole of holes) if (rendered[hole] === undefined) unchecked.add(hole);
		// A hole this leg could not walk to accepts what the step says; every other must match.
		expect({ key, quoted }).toEqual({ key, quoted: holes.map((hole, position) => rendered[hole] ?? quoted[position]) });
	});
	await logEvidence(directory, 'guide', { steps, unchecked: [...unchecked] });
	// On a phone the controls that write are not drawn, so only the desktop legs must have read them all.
	expect(mobileEmulation ? [] : [...unchecked]).toEqual([]);

	const reopen = say('help.guide.reopen').replace(/\{(\w+)\}/gu, (_hole, name: string) => rendered[name] ?? '');
	const paragraphs = await modal.$$('.modal-content > p').map((paragraph) => paragraph.getText());
	// Every step names a control that writes; the mobile leg's read-only paragraph says so there.
	expect(paragraphs).toEqual(mobileEmulation ? [reopen, say('view.mobile.read-only')] : [reopen]);
}
