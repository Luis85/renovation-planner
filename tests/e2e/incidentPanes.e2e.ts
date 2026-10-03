import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { closePluginSettings, noticeMessages, openPluginSettings, settingControl, settleSettings } from './helpers';
import { readSidecar, saveLabel, sidecarPath } from './canvas';
import { BOWL, createDesignerPage, type ObsidianPage } from './designer';
import { logEvidence } from './diagnostics';
import {
	EDITOR,
	PLANTED_INCIDENT,
	UNRECOVERED,
	WRITES_PAUSED,
	addRoom,
	expectPaused,
	incidentsPath,
	openPlan,
	plantIncidents,
	reloadPlugin,
	saveLayout,
	seedSampleProject,
	selectRoom,
	tryNewPlan,
	widen,
	type Pane,
	type Ui,
} from './planner';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * The write-incident rows no other e2e file reaches, driven in the real host:
 * `docs/tests/cases/Two panes on one plan under an open write incident.md` steps 5 (the Asset
 * designer) and 7 (TWO restored panes), and `docs/tests/cases/Notices and save state.md` steps
 * 16 to 17d — a real save error, and a real in-session incident raised by a write that landed
 * half-way and could not be put back, which is G1's subject.
 *
 * **The file-system cases are LINUX cases**, and the E2E workflow runs on Linux only: a
 * directory at 0555 refuses a create and a rename into it, and a file at 0444 refuses a write,
 * for a non-root user. Windows ACLs are not exercised. Every permission taken is given back in a
 * `finally` (`withLocked`), or the teardown cannot remove the copied vault.
 *
 * Every write here runs on the desktop legs; mobile is view-only by design.
 */
const desktop = mobileEmulation ? test.skip : test;

const PLAN_EDITOR = 'renovation-plan-editor';
const PLAN = en['sample.plan.name'];
const KITCHEN = en['sample.zone.kitchen'];
const SAVED = { state: 'rp-save-state-saved', text: en['save-state.saved'] };
const SAVE_ERROR = { state: 'rp-save-state-save-error', text: en['save-state.save-error'] };
/** Long enough for a refused gesture's dispatch, refresh and notice to have landed, if any would. */
const SETTLE_MS = 1500;

/** Each editor pane's warning strip as text, in DOM order — `''` for a pane drawing none. */
const strips = (browser: NativeBrowser): Promise<string[]> =>
	browser.execute((editor: string) => [...document.querySelectorAll(editor)].map((pane) => pane.querySelector('.rp-warning-strip')?.textContent ?? ''), EDITOR);

const canvases = (browser: NativeBrowser): Promise<number> =>
	browser.execute((editor: string) => document.querySelectorAll(`${editor} .rp-plan-canvas canvas`).length, EDITOR);

/** §85's keyboard nudge of the one room selected: the pane's canvas focused by script, then one ArrowRight. */
async function nudgeRoom(browser: NativeBrowser, pane: Pane): Promise<void> {
	const canvas = await pane.$('.rp-plan-canvas').getElement();
	await browser.execute((element: HTMLElement) => element.focus(), canvas);
	await browser.keys('ArrowRight');
}

/** The plan's one sidecar on disk, and the `Geometry/` folder holding it. */
async function geometryPaths(browser: NativeBrowser, page: ObsidianPage): Promise<string[]> {
	const file = path.join(page.getVaultPath(), await sidecarPath(browser));
	return [file, path.dirname(file)];
}

/** Every path read-only for `body` (a folder 0555, a file 0444), and writable again however it ends. */
async function withLocked(paths: readonly string[], body: (unlock: () => void) => Promise<void>): Promise<void> {
	const set = (folder: number, file: number) => () => {
		for (const each of paths) chmodSync(each, statSync(each).isDirectory() ? folder : file);
	};
	const unlock = set(0o755, 0o644);
	set(0o555, 0o444)();
	try {
		await body(unlock);
	} finally {
		unlock();
	}
}

/** The incidents file's records as `[code, affected kinds]`, or `[]` while it does not exist. */
const recorded = async (browser: NativeBrowser): Promise<[string, string[]][]> => {
	const text = await browser.executeObsidian(async ({ app }, file) => ((await app.vault.adapter.exists(file)) ? app.vault.adapter.read(file) : ''), await incidentsPath(browser));
	if (text === '') return [];
	const { incidents } = JSON.parse(text) as { incidents: { code: string; affected: { entityKind: string }[] }[] };
	return incidents.map(({ code, affected }) => [code, affected.map((entity) => entity.entityKind)]);
};

/**
 * Notices 17a's fault setup, made of two permissions a non-root user CAN hold apart: the zone note
 * is created in its own writable folder, the sidecar write is refused by a locked `Geometry/`, and
 * the compensating removal — `fileManager.trashFile`, which with `trashOption: 'local'` is a rename
 * into the vault's `.trash/` — is refused by a locked `.trash/`. The case's own Linux spelling
 * (sticky bit, no write) cannot do it: one directory's write bit governs both create and unlink.
 * Answers the paths to lock; the room is added inside `withLocked`.
 */
async function prepareUncompensated(browser: NativeBrowser, page: ObsidianPage, ui: Ui): Promise<string[]> {
	await widen(browser);
	await seedSampleProject(browser, ui);
	const trash = path.join(page.getVaultPath(), '.trash');
	if (!existsSync(trash)) mkdirSync(trash);
	await browser.executeObsidian(({ app }) => (app.vault as unknown as { setConfig(key: string, value: string): void }).setConfig('trashOption', 'local'));
	return [...(await geometryPaths(browser, page)), trash];
}

/**
 * 17a's verdict: Save error, the standing warning, and the durable record. The warning is the
 * strip's `editor.unrecovered`: the refusal itself is routed to the save state
 * (`reportDispatchFailure`, `autosave-write`), so `zone.sidecar-insert-uncompensated`'s own
 * sentence is drawn nowhere — the notices are recorded rather than asserted.
 */
async function expectUncompensated(browser: NativeBrowser, directory: string): Promise<void> {
	await expect.poll(() => saveLabel(browser)).toEqual(SAVE_ERROR);
	await expect.poll(async () => (await strips(browser))[0]).toContain(UNRECOVERED);
	await expect.poll(() => recorded(browser)).toEqual([['zone.sidecar-insert-uncompensated', ['zone', 'plan']]]);
	await logEvidence(directory, 'step-17a-notices', await noticeMessages(browser));
}

describe('Two panes on one plan under a planted write incident, the rows writeIncident.e2e.ts leaves', () => {
	// Step 5, re-read at HEAD: the row says NOTHING about the designer looks paused, and that is
	// now only half true — since L-16 its Undo and Redo go disabled on the incident. With no write
	// able to land, a designer opened under an incident has no history either way, so that half
	// cannot be told apart here and is recorded, not asserted. What is pinned is the rest: the
	// tools stay live (the recorded affordance gap, positively), and no write lands through any of
	// the three gestures the row names — each one first watched WRITING before the incident.
	desktop('step 5: the Asset designer looks live and refuses every write underneath', async ({ native: { browser, page, ui, directory } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createToilet('Paused toilet');
		const height = () => designer.inspectorField('height');
		const asset = async () => Object.values(await ui.notesOfType('renovation-asset')).find((note) => note.id === assetId);
		// The positive controls: the nudge, the height and the drag each write before the incident.
		await designer.nudgeTo(assetId, 2);
		await height().setValue('750');
		await browser.keys('Enter');
		await expect.poll(async () => (await asset())?.height).toBe(750);
		await designer.holdDrag(BOWL, 40);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(3);
		const centre = await designer.inspectorField('centre-x').getValue();
		const sidecar = readFileSync(designer.sidecarPath(assetId), 'utf8');
		const note = await asset();

		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await designer.reloadPlugin();
		await designer.openDesignerFor('Paused toilet');
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe(centre);

		// Nothing looks paused: every tool button enabled, and no incident sentence anywhere in the leaf.
		const tools = designer.designer().$('.rp-designer-tools');
		expect(await tools.$$('.rp-designer-tool-button:not(.rp-designer-history *)').length).toBeGreaterThan(0);
		expect(await tools.$$('.rp-designer-tool-button[disabled]:not(.rp-designer-history *)').length).toBe(0);
		const leafText = await browser.execute((sel: string) => document.querySelector(sel)?.textContent ?? '', '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
		expect(leafText).toContain('Paused toilet');
		expect([leafText.includes(UNRECOVERED), leafText.includes(WRITES_PAUSED)]).toEqual([false, false]);
		const undoBefore = await designer.undoDisabled();

		await designer.nudge();
		await height().setValue('900');
		await browser.keys('Enter');
		await designer.holdDrag(BOWL, 40);
		await browser.pause(SETTLE_MS);
		await logEvidence(directory, 'step-5-surface', { undoDisabledOnOpen: undoBefore, header: await designer.header(), notices: await designer.notices() });
		expect(readFileSync(designer.sidecarPath(assetId), 'utf8')).toBe(sidecar);
		expect(await asset()).toEqual(note);

		// Reopened, the design is the one written before the incident.
		await designer.closeDesigner();
		await designer.openDesignerFor('Paused toilet');
		await designer.selectPart(BOWL);
		await expect.poll(() => designer.inspectorField('centre-x').getValue()).toBe(centre);
		expect(await height().getValue()).toBe('750');
	});

	// Step 7 with BOTH panes in the layout. Obsidian restores its leaves before `onLayoutReady`,
	// where the registry's read starts, so a restored pane is seeded clean (L-14) — measured for one
	// pane by `writeIncident.e2e.ts`. Each pane's first write then reaches the guarded door, and its
	// refusal is where that pane catches up (`withSaveStateTracking`'s `markVaultPaused`).
	desktop('step 7: two restored panes draw unpaused, and each is paused by its own first refused write', async ({ native: { browser, page, ui, directory } }) => {
		await widen(browser);
		await seedSampleProject(browser, ui);
		await plantIncidents(browser, JSON.stringify(PLANTED_INCIDENT));
		await reloadPlugin(page);
		await openPlan(browser, ui, PLAN);
		await expectPaused(browser.$(EDITOR));
		await browser.executeObsidian(async ({ app }, type) => {
			const [leaf] = app.workspace.getLeavesOfType(type);
			if (!leaf) throw new Error('No Plan Editor leaf to split.');
			await app.workspace.duplicateLeaf(leaf, 'split', 'vertical');
		}, PLAN_EDITOR);
		await expect.poll(() => canvases(browser)).toBe(2);
		const sidecar = await sidecarPath(browser);
		const before = await readSidecar(browser, sidecar);

		await saveLayout(browser);
		await browser.reloadObsidian();
		await widen(browser);
		await expect.poll(() => ui.leafCount(PLAN_EDITOR)).toBe(2);
		await expect.poll(() => canvases(browser)).toBe(2);
		const firstFrames = await strips(browser);
		await logEvidence(directory, 'step-7-first-frames', firstFrames);
		expect(firstFrames.map((text) => text.includes(UNRECOVERED))).toEqual([false, false]);

		const panes = await browser.$$(EDITOR);
		expect(panes).toHaveLength(2);
		for (const pane of panes) {
			await selectRoom(browser, KITCHEN, pane);
			await nudgeRoom(browser, pane);
			await expectPaused(pane);
		}
		expect(await readSidecar(browser, sidecar)).toBe(before);
		expect(await browser.executeObsidian(({ app }, file) => app.vault.adapter.read(file), await incidentsPath(browser))).toBe(JSON.stringify(PLANTED_INCIDENT));
	});
});

describe('Notices and save state, the failure rows, over a real file system (Linux)', () => {
	desktop('steps 16 and 17: a refused sidecar write reads Save error in the error colour, and the next write that lands clears it', async ({ native: { browser, page, ui } }) => {
		await widen(browser);
		await seedSampleProject(browser, ui);
		await selectRoom(browser, KITCHEN);
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		const sidecar = await sidecarPath(browser);
		const before = await readSidecar(browser, sidecar);
		// The label's colour against a probe coloured `var(--text-error)` in the same place.
		const colours = () =>
			browser.execute((editor: string) => {
				const label = document.querySelector(`${editor} .rp-save-state-label`);
				const probe = document.createElement('span');
				probe.style.color = 'var(--text-error)';
				label?.parentElement?.append(probe);
				const read = { label: label ? getComputedStyle(label).color : 'absent', error: getComputedStyle(probe).color, text: label?.textContent ?? '' };
				probe.remove();
				return read;
			}, EDITOR);
		const atRest = await colours();
		expect(atRest.label).not.toBe(atRest.error);

		await withLocked(await geometryPaths(browser, page), async (unlock) => {
			await nudgeRoom(browser, browser.$(EDITOR));
			await expect.poll(() => saveLabel(browser)).toEqual(SAVE_ERROR);
			await browser.pause(SETTLE_MS);
			expect(await saveLabel(browser)).toEqual(SAVE_ERROR);
			const failed = await colours();
			expect(failed.label).toBe(failed.error);
			expect(await readSidecar(browser, sidecar)).toBe(before);

			// Step 17: writable again, and the next nudge lands and settles on the relative phrase.
			unlock();
			await nudgeRoom(browser, browser.$(EDITOR));
			await expect.poll(() => readSidecar(browser, sidecar)).not.toBe(before);
			await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
			expect((await colours()).text).toContain(en['save-state.saved-just-now']);
		});
	});

	desktop('steps 17a and 17b: a write left half-done raises a durable incident, which a settings rebind keeps', async ({ native: { browser, page, ui, directory } }) => {
		const paths = await prepareUncompensated(browser, page, ui);
		await withLocked(paths, async () => {
			await addRoom(browser, 'Pantry');
			await expectUncompensated(browser, directory);
		});
		await logEvidence(directory, 'step-17a-zone-notes', Object.values(await ui.notesOfType('renovation-zone')).map((zone) => zone.name));
		// Both permissions back, so a refusal now is the vault's gate and not the file system.
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);

		// 17b: a settings save remounts the editor with a fresh Pinia.
		const windows = await openPluginSettings(browser);
		await settingControl(browser, 'Units', 'select').selectByAttribute('value', 'imperial');
		await closePluginSettings(browser, windows);
		await settleSettings(browser);
		await ui.activate(PLAN_EDITOR);
		await expectPaused(browser.$(EDITOR));
		const sidecar = await sidecarPath(browser);
		const before = await readSidecar(browser, sidecar);
		await selectRoom(browser, KITCHEN);
		await nudgeRoom(browser, browser.$(EDITOR));
		await browser.pause(SETTLE_MS);
		expect(await readSidecar(browser, sidecar)).toBe(before);
	});

	// 17c asks two questions and the case pins the answers. The layout is saved through Obsidian's
	// own debouncer (`requestSaveLayout`, then `run()` to flush it) rather than trusted to happen at
	// quit: what is pinned is that the leaf's state CARRIES the incident and that a restored leaf
	// honours it — not when Obsidian chooses to save.
	desktop('steps 17c and 17d: the incident rides the saved layout into a restart, and a new tab is paused by the vault record', async ({ native: { browser, page, ui, directory } }) => {
		const paths = await prepareUncompensated(browser, page, ui);
		await withLocked(paths, async () => {
			await addRoom(browser, 'Pantry');
			await expectUncompensated(browser, directory);
		});
		await saveLayout(browser);
		const saved = await browser.executeObsidian(async ({ app }, type) => {
			const found: unknown[] = [];
			const walk = (node: unknown): void => {
				if (node === null || typeof node !== 'object') return;
				const state = (node as { state?: { type?: string; state?: Record<string, unknown> } }).state;
				if (state?.type === type) found.push(state.state?.unrecoveredWrite ?? null);
				for (const child of Object.values(node)) walk(child);
			};
			walk(JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/workspace.json`)));
			return found;
		}, PLAN_EDITOR);

		await browser.reloadObsidian();
		await widen(browser);
		await expect.poll(() => ui.leafCount(PLAN_EDITOR)).toBe(1);
		await expect.poll(() => canvases(browser)).toBe(1);
		const firstFrame = await strips(browser);
		await logEvidence(directory, 'step-17c', { savedUnrecoveredWrite: saved, firstFrame });
		expect(saved).toEqual([true]);
		expect(firstFrame.map((text) => text.includes(UNRECOVERED))).toEqual([true]);
		expect(await tryNewPlan(browser, ui, 'Attic')).toContain(WRITES_PAUSED);
		expect((await recorded(browser)).map(([code]) => code)).toEqual(['zone.sidecar-insert-uncompensated']);

		// 17d, re-read at HEAD: the row expects a NEW tab with no warning. Since ADR-0034 the incident
		// is the VAULT's, so a new tab seeds paused from the record (Two panes step 1's mechanism).
		await browser.executeObsidian(({ app }, type) => {
			for (const leaf of app.workspace.getLeavesOfType(type)) leaf.detach();
		}, PLAN_EDITOR);
		await expect.poll(() => ui.leafCount(PLAN_EDITOR)).toBe(0);
		await openPlan(browser, ui, PLAN);
		await expectPaused(browser.$(EDITOR));
	});
});
