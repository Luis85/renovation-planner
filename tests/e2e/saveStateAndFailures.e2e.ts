import type Konva from 'konva';
import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { closePluginSettings, noticeMessages, openPluginSettings, settleSettings } from './helpers';
import { recordSaveStates, saveLabel, saveStates } from './canvas';
import {
	EDITOR,
	addRoom,
	corruptSettings,
	openPlan,
	removeBackgroundFiles,
	saveLayout,
	seedProjectWithPlan,
	seedSampleProject,
	textOf,
	tryNewPlan,
	widen,
	type Ui,
} from './planner';
import { PLUGIN_ID, mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Notices and save state.md`'s save-state and failure-surface steps no other e2e
 * file drives, in the real host: 3a (the two live regions), 13–15 (Saved, then Saving → "Saved just
 * now" through Add ▸ Room, Undo and Redo), 18 (one indicator per leaf), 20 (a plugin toggle with a
 * notice showing), 22 (Set scale clicked twice in one place), 23 (the project list's Try again
 * re-reads) and 24 (a `data.json` that will not parse: failure panels with no action). Steps 15a,
 * 16–17d, 19 and 25 are `nextActionWalk`'s, `incidentPanes`'s and `germanHost`'s.
 *
 * **Step 23's own fault setup does not produce a failure at HEAD, and that is a finding.** It says to
 * rename the projects folder from outside Obsidian; `ObsidianProjectRepository.listAll` reads the
 * project ids from the index, which follows a note wherever it moves (ADR-0013), and counts a note it
 * cannot parse rather than failing. The case pins that first — the rename leaves the list drawn — and
 * then makes the read FAIL the only way left: a project note's metadata read throwing, injected at
 * Obsidian's `metadataCache.getFileCache` for the project notes alone, which `guardQuery` maps to the
 * failure panel. What the row says a vault adds — that the retry really re-reads — is what it asserts,
 * counted by the injected read itself.
 *
 * Desktop legs: every case writes, and mobile is view-only by design.
 *
 * Written from source and not yet run when committed: CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;

const PLAN_EDITOR = 'renovation-plan-editor';
const PROJECT_VIEW = 'renovation-project';
const SAVED = { state: 'rp-save-state-saved', text: en['save-state.saved'] };
const SAVING = 'rp-save-state-saving';
const BACKGROUND = en['background.unsupported'];
const NO_ASSETS = en['asset.none'];

const zoneNames = async (ui: Ui): Promise<string[]> => Object.values(await ui.notesOfType('renovation-zone')).map((zone) => String(zone.name));

/** The plugin's two live regions, in document order, as a screen reader's tree holds them. */
const liveRegions = (browser: NativeBrowser) =>
	browser.execute(() =>
		[...document.querySelectorAll('.rp-notice-live-region')].map((region) => ({
			onBody: region.parentElement === document.body,
			role: region.getAttribute('role'),
			live: region.getAttribute('aria-live'),
			text: region.textContent ?? '',
		})),
	);
const regionsReading = (status: string, alert: string) => [
	{ onBody: true, role: 'status', live: 'polite', text: status },
	{ onBody: true, role: 'alert', live: 'assertive', text: alert },
];
const pluginNotices = (browser: NativeBrowser): Promise<number> => browser.execute(() => document.querySelectorAll('.rp-notice').length);

describe('Notices and save state, the live regions and the save indicator (steps 3a, 13–15, 18 and 20)', () => {
	desktop('steps 3a and 20: two empty regions at rest, a warning written into the alert one, and a toggle that takes both and the notice away', async ({ native: { browser, page, ui, directory } }) => {
		// 3a: present with the plugin loaded and nothing raised, both empty.
		expect(await pluginNotices(browser)).toBe(0);
		expect(await liveRegions(browser)).toEqual(regionsReading('', ''));

		await removeBackgroundFiles(browser);
		await seedSampleProject(browser, ui);
		await ui.activate(PLAN_EDITOR);
		await ui.command('set-plan-background');
		await expect.poll(() => liveRegions(browser)).toEqual(regionsReading('', `${en['notice.severity.warning']} ${BACKGROUND}`));
		expect(await noticeMessages(browser)).toContain(BACKGROUND);
		expect(await pluginNotices(browser)).toBe(1);

		// 20: the showing warning — which has no timer of its own — goes with the unload, and so do both regions.
		await page.disablePlugin(PLUGIN_ID);
		await expect.poll(() => pluginNotices(browser)).toBe(0);
		expect(await liveRegions(browser)).toEqual([]);

		await page.enablePlugin(PLUGIN_ID);
		expect(await liveRegions(browser)).toEqual(regionsReading('', ''));
		await ui.command('open-asset-designer');
		await expect.poll(() => noticeMessages(browser)).toContain(NO_ASSETS);
		await expect.poll(() => liveRegions(browser)).toEqual(regionsReading(`${en['notice.severity.info']} ${NO_ASSETS}`, ''));
		await logEvidence(directory, 'step-20-after-reenable', await noticeMessages(browser));
	});

	desktop('steps 13, 14 and 15: Saved at rest, then Saving and "Saved just now" through Add room, Undo and Redo', async ({ native: { browser, ui, directory } }) => {
		await widen(browser);
		await seedSampleProject(browser, ui);
		const label = browser.$(EDITOR).$('.rp-save-state-label');
		// 13: the plain word, with no relative phrase — this editor has written nothing yet.
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		expect(await textOf(label)).toBe(SAVED.text);

		// 14, then 15's Undo and Redo: each passes through Saving and settles on Saved.
		const steps: [string, () => Promise<void>, boolean][] = [
			['add room', () => addRoom(browser, 'Pantry'), true],
			['undo', () => browser.$(EDITOR).$('[data-rp-action="undo"]').click(), false],
			['redo', () => browser.$(EDITOR).$('[data-rp-action="redo"]').click(), true],
		];
		const seen: Record<string, string[]> = {};
		for (const [name, act, pantry] of steps) {
			await recordSaveStates(browser);
			await act();
			// The write itself landed, so the indicator is reporting a real one.
			await expect.poll(async () => (await zoneNames(ui)).includes('Pantry')).toBe(pantry);
			await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
			seen[name] = await saveStates(browser);
			expect({ name, saving: seen[name].includes(SAVING) }).toEqual({ name, saving: true });
			expect(await textOf(label)).toContain(en['save-state.saved-just-now']);
		}
		await logEvidence(directory, 'steps-14-15-save-states', seen);
	});

	desktop('step 18: two plans in two leaves, and a room added in one moves that leaf\'s indicator alone', async ({ native: { browser, ui, directory } }) => {
		await widen(browser);
		await seedSampleProject(browser, ui);
		expect(await tryNewPlan(browser, ui, 'Attic')).toBe('');
		await openPlan(browser, ui, 'Attic');
		await expect.poll(() => ui.leafCount(PLAN_EDITOR)).toBe(2);
		const plans = Object.values(await ui.notesOfType('renovation-plan'));
		const idOf = (name: string): string => String(plans.find((plan) => plan.name === name)?.id);
		const [attic, sample] = [idOf('Attic'), idOf(en['sample.plan.name'])];

		// Every state each leaf's indicator takes from here, keyed by the plan the leaf shows.
		const indicators = () =>
			browser.executeObsidian(({ app }, type) => {
				const logs = (window as unknown as { __rpLeafLogs?: Record<string, string[]> }).__rpLeafLogs ?? {};
				return app.workspace.getLeavesOfType(type).map((leaf) => {
					const plan = String(leaf.view.getState().planId);
					const label = leaf.view.containerEl.querySelector('.rp-save-state-label');
					const state = label ? ([...label.classList].find((name) => name !== 'rp-save-state-label') ?? '') : 'absent';
					return { plan, state, text: label?.textContent?.trim() ?? '', log: logs[plan] ?? [] };
				});
			}, PLAN_EDITOR);
		await browser.executeObsidian(({ app }, type, active) => {
			const logs: Record<string, string[]> = {};
			(window as unknown as { __rpLeafLogs: Record<string, string[]> }).__rpLeafLogs = logs;
			for (const leaf of app.workspace.getLeavesOfType(type)) {
				const root = leaf.view.containerEl;
				const log: string[] = (logs[String(leaf.view.getState().planId)] = []);
				const read = (): void => {
					const label = root.querySelector('.rp-save-state-label');
					log.push(label ? ([...label.classList].find((name) => name !== 'rp-save-state-label') ?? '') : 'absent');
				};
				read();
				new MutationObserver(read).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
				if (leaf.view.getState().planId === active) app.workspace.setActiveLeaf(leaf, { focus: true });
			}
		}, PLAN_EDITOR, attic);
		await expect.poll(async () => (await indicators()).map(({ plan, state, text }) => [plan, state, text]).toSorted()).toEqual(
			[[attic, SAVED.state, SAVED.text], [sample, SAVED.state, SAVED.text]].toSorted(),
		);

		const pane = ui.leaf(PLAN_EDITOR);
		await expect.poll(() => pane.$('.rp-plan-canvas canvas').isExisting()).toBe(true);
		await addRoom(browser, 'Pantry', pane);
		await expect.poll(async () => (await zoneNames(ui)).includes('Pantry')).toBe(true);
		const byPlan = async () => Object.fromEntries((await indicators()).map((leaf) => [leaf.plan, leaf]));
		await expect.poll(async () => (await byPlan())[attic]?.text).toContain(en['save-state.saved-just-now']);
		const after = await byPlan();
		await logEvidence(directory, 'step-18-indicators', after);
		expect(after[attic]?.log).toContain(SAVING);
		expect(after[attic]?.state).toBe(SAVED.state);
		// The other leaf: never Saving, and still the plain word with no relative phrase.
		expect({ state: after[sample]?.state, text: after[sample]?.text, saving: after[sample]?.log.includes(SAVING) }).toEqual({
			state: SAVED.state,
			text: SAVED.text,
			saving: false,
		});
	});
});

/** Every rendered failure panel of the leaf type, and whether any carries an action. */
const failurePanel = (browser: NativeBrowser, type: string) =>
	browser.execute((selector: string) => {
		const panels = [...document.querySelectorAll(`${selector} .rp-view-failure`)];
		return panels.map((panel) => ({
			headline: panel.querySelector('.rp-view-failure__headline')?.textContent?.trim() ?? '',
			body: panel.querySelector('.rp-view-failure__body')?.textContent?.trim() ?? '',
			actions: [...panel.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? ''),
		}));
	}, `.workspace-leaf-content[data-type="${type}"]`);

/** A screen point on the editor stage's own canvas at fractions of its box, refused when anything else is drawn there. */
const stagePoint = (browser: NativeBrowser, fx: number, fy: number) =>
	browser.execute(
		(editor: string, ax: number, ay: number) => {
			const container = document.querySelector(`${editor} .konvajs-content`);
			const rect = container?.getBoundingClientRect();
			if (!container || !rect) return null;
			const x = Math.round(rect.left + rect.width * ax);
			const y = Math.round(rect.top + rect.height * ay);
			const hit = document.elementFromPoint(x, y);
			return hit instanceof HTMLCanvasElement && container.contains(hit) ? { x, y } : null;
		},
		EDITOR,
		fx,
		fy,
	);

/** The calibration tape's marks (`GestureSketch.vue`'s `measurement-marks`) drawn on the editor's stage. */
const tapeDrawn = (browser: NativeBrowser): Promise<boolean> =>
	browser.execute((editor: string) => {
		const stage = ((window as unknown as { Konva?: typeof Konva }).Konva?.stages ?? []).find((candidate) => candidate.container().closest(editor) !== null);
		return stage?.findOne('.measurement-marks') !== undefined;
	}, EDITOR);

/**
 * One primary click, press and release in ONE chain. The move is a single jump (`duration: 0`): an
 * interpolated one from (0, 0) would cross the stage's edge-scroll band with the tape armed and could
 * pan the camera under the second click.
 */
const click = (browser: NativeBrowser, { x, y }: { x: number; y: number }) =>
	browser.action('pointer', { parameters: { pointerType: 'mouse' } }).move({ x, y, duration: 0, origin: 'viewport' }).down({ button: 0 }).up({ button: 0 }).perform();

describe('Notices and save state, the failure surfaces (steps 22, 23 and 24)', () => {
	desktop('step 22: Set scale clicked twice in one place takes the anchor off and says why, and asks for no distance', async ({ native: { browser, ui, directory } }) => {
		await widen(browser);
		await seedSampleProject(browser, ui);
		await ui.command('set-plan-background');
		const prompt = browser.$('.prompt-input');
		await expect.poll(() => prompt.isDisplayed()).toBe(true);
		await prompt.setValue('editor-background-png-test');
		await browser.keys('Enter');
		const rail = browser.$(EDITOR).$('[data-rp-rail="layers"]');
		if (await rail.isDisplayed()) await rail.click();
		const setScale = browser.$(EDITOR).$('[data-rp-action="set-scale"]');
		await expect.poll(async () => (await setScale.isDisplayed()) && (await setScale.getAttribute('aria-disabled')) === null).toBe(true);

		const points: { x: number; y: number }[] = [];
		for (const [fx, fy] of [[0.3, 0.35], [0.7, 0.65], [0.35, 0.7], [0.65, 0.3], [0.5, 0.5]]) {
			const point = await stagePoint(browser, fx, fy);
			if (point) points.push(point);
		}
		expect(points.length).toBeGreaterThanOrEqual(2);
		const [a, b] = points;
		const dialog = browser.$('.rp-dialog');

		// The control: two DIFFERENT points reach the prompts (the recalibration confirm first, since
		// the plan has rooms), so a gesture that never armed the tool cannot pass below as a refusal.
		await setScale.click();
		await click(browser, a);
		await expect.poll(() => tapeDrawn(browser)).toBe(true);
		await click(browser, b);
		await expect.poll(() => dialog.isDisplayed()).toBe(true);
		const controlPrompt = await textOf(dialog);
		await browser.keys('Escape');
		await expect.poll(() => dialog.isExisting()).toBe(false);
		await expect.poll(() => tapeDrawn(browser)).toBe(false);

		await setScale.click();
		await click(browser, a);
		await expect.poll(() => tapeDrawn(browser)).toBe(true);
		await click(browser, a);
		const refused = () => browser.execute(() => [...document.querySelectorAll('.rp-notice-error .rp-notice-message')].map((node) => node.textContent ?? ''));
		await expect.poll(refused).toEqual([en['calibration.coincident-points']]);
		await expect.poll(() => tapeDrawn(browser)).toBe(false);
		await browser.pause(1000);
		await logEvidence(directory, 'step-22', { points, controlPrompt, notices: await noticeMessages(browser) });
		expect(await dialog.isExisting()).toBe(false);
	});

	desktop('step 23: the project list\'s Try again re-reads, failing while the read fails and drawing the list once it does not', async ({ native: { browser, ui, directory } }) => {
		await seedProjectWithPlan(ui);
		const view = ui.leaf(PROJECT_VIEW);
		const reopen = async (): Promise<void> => {
			await browser.executeObsidian(({ app }, type) => {
				for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach();
			}, PROJECT_VIEW);
			await ui.openProjectView();
		};

		// The row's own setup, pinned as the finding: a renamed projects folder leaves the list drawn.
		const [projectNote] = Object.keys(await ui.notesOfType('renovation-project'));
		const root = String(projectNote).split('/')[0];
		await browser.executeObsidian(async ({ app }, from) => {
			const folder = app.vault.getAbstractFileByPath(from);
			if (folder === null) throw new Error(`no folder ${from}`);
			await app.fileManager.renameFile(folder, `${from} renamed`);
		}, root);
		await expect.poll(async () => Object.keys(await ui.notesOfType('renovation-project'))).toEqual([projectNote.replace(root, `${root} renamed`)]);
		await reopen();
		await expect.poll(() => view.$('.rp-project-row').isDisplayed()).toBe(true);
		expect(await failurePanel(browser, PROJECT_VIEW)).toEqual([]);

		// The read made to fail, at the metadata read of a project note and nowhere else.
		await browser.executeObsidian(({ app }) => {
			const cache = app.metadataCache;
			const original = cache.getFileCache.bind(cache);
			const fault = { thrown: 0, restore: () => void (cache.getFileCache = original) };
			(window as unknown as { __rpReadFault: typeof fault }).__rpReadFault = fault;
			cache.getFileCache = (file) => {
				const found = original(file);
				if (found?.frontmatter?.type !== 'renovation-project') return found;
				fault.thrown += 1;
				throw new Error('e2e: the project read refused');
			};
		});
		const thrown = (): Promise<number> => browser.execute(() => (window as unknown as { __rpReadFault?: { thrown: number } }).__rpReadFault?.thrown ?? -1);
		const failed = [{ headline: en['view.project.failed.headline'], body: expect.any(String), actions: [en['view.failure.retry']] }];
		try {
			await reopen();
			await expect.poll(() => failurePanel(browser, PROJECT_VIEW)).toEqual(failed);
			// Not the onboarding a successful empty read would draw.
			expect(await view.$('.rp-empty-state').isExisting()).toBe(false);
			expect(await view.$('.rp-project-row').isExisting()).toBe(false);
			const first = await thrown();
			expect(first).toBeGreaterThan(0);

			await view.$('.rp-view-failure__action').click();
			await expect.poll(thrown).toBeGreaterThan(first);
			// Polled: the re-read passes through the loading line before the panel draws again.
			await expect.poll(() => failurePanel(browser, PROJECT_VIEW)).toEqual(failed);
			await logEvidence(directory, 'step-23', { panel: await failurePanel(browser, PROJECT_VIEW), readsRefused: await thrown() });
		} finally {
			await browser.execute(() => (window as unknown as { __rpReadFault?: { restore(): void } }).__rpReadFault?.restore());
		}
		await view.$('.rp-view-failure__action').click();
		await expect.poll(() => view.$('.rp-project-row').isDisplayed()).toBe(true);
		expect(await failurePanel(browser, PROJECT_VIEW)).toEqual([]);
	});

	desktop('step 24: with data.json unreadable, both views draw a failure panel with no action, and the settings tab says what to fix', async ({ native: { browser, ui, directory } }) => {
		await seedSampleProject(browser, ui);
		await ui.openProjectView();
		await saveLayout(browser);
		await corruptSettings(browser);
		await browser.reloadObsidian();

		const panels: Record<string, unknown> = {};
		for (const type of [PROJECT_VIEW, PLAN_EDITOR]) {
			await expect.poll(() => ui.leafCount(type)).toBe(1);
			await ui.activate(type);
			await expect.poll(() => ui.leaf(type).$('.rp-view-failure').isDisplayed()).toBe(true);
			const panel = await failurePanel(browser, type);
			panels[type] = panel;
			expect(panel).toEqual([{ headline: en['view.session-failure.headline'], body: expect.any(String), actions: [] }]);
		}

		const windows = await openPluginSettings(browser);
		const tab = await browser.execute(() => ({
			names: [...document.querySelectorAll('.vertical-tab-content .setting-item-name')].map((name) => name.textContent?.trim() ?? ''),
			controls: document.querySelectorAll('.vertical-tab-content .setting-item-control :is(input, select, textarea, button)').length,
		}));
		await closePluginSettings(browser, windows);
		await settleSettings(browser);
		await logEvidence(directory, 'step-24', { panels, tab });
		expect(tab.names).toContain(en['settings.unrecovered']);
		expect(tab.controls).toBe(0);
	});
});
