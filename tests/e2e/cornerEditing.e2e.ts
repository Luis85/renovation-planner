import { join } from 'node:path';
import type Konva from 'konva';
import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { setWindowSize, windowSize } from './helpers';
import { contextClick, outlineOf, readSidecar, recordSaveStates, saveLabel, saveStates, settleCamera, sidecarPath, type StoredPoint, type WorldPoint } from './canvas';
import { EDITOR, seedSampleProject, selectRoom, textOf, type Ui } from './planner';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Edit a zone corner by typing its position.md` (BP-04) driven in the real host:
 * both doors (steps 1–4), choosing corner 3 and its mark on the canvas (5, 6), a comma-decimal
 * preview and the write that changes that corner alone (7, 8), the submit's label (9, recorded),
 * Undo and Redo through real Ctrl+Z / Ctrl+Y (10), Cancel and an unchanged submit (11, 12), the
 * perspective gates (13, 14), a dirty dialog across a wide and a constrained pane plus the sidebar
 * width (15, 16), and the keyboard-only walk's assertable half (18). Steps 17 (German) live in
 * `germanHost.e2e.ts`; 19 (screen reader) is a person's.
 *
 * **Named screenshots are the case's evidence** (L-31, L-32), written beside `screenshot.png` in
 * the case's `e2e-results/cases/` folder: `corner-menu`, `corner-dialog`, `corner-3-chosen`,
 * `corner-actions-row`, `corner-renovate-greyed` and `corner-460`. CI keeps them 14 days.
 *
 * The step's own "Obsidian's own `Menu`" is this plugin's `CanvasContextMenu.vue`, which a canvas
 * right-click opens; nothing here reaches Obsidian's `Menu` class.
 *
 * Copy is read from the `en` locale module. Desktop only: creation and the editor are refused on
 * the mobile leg. Written from source and not yet run when committed: CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;

const TERRACE = en['sample.zone.terrace'];
const KITCHEN = en['sample.zone.kitchen'];
const GARDEN = en['sample.zone.garden'];
const DIALOG = '.rp-dialog';
const INSPECTOR_DOOR = '.rp-room-inspector [data-rp-action="edit-outline"]';
const MENU_ENTRY = '.rp-canvas-context-menu [data-rp-context-action="edit-outline"]';
const SAVED = { state: 'rp-save-state-saved', text: en['save-state.saved'] };
/**
 * Inside the Terrace and off its centre, its edges' midpoints and its top centre, where the room's
 * HTML labels sit over the stage (`nextActionWalk.e2e.ts`'s note on framing); `contextClick` takes
 * the first that the stage's own canvas answers for.
 */
const IN_TERRACE: WorldPoint[] = [
	{ x: 7800, y: 4000 },
	{ x: 10_200, y: 4000 },
	{ x: 8000, y: 5600 },
	{ x: 10_000, y: 5400 },
];

const shot = (browser: NativeBrowser, directory: string, name: string) => browser.saveScreenshot(join(directory, `${name}.png`));
const dialog = (browser: NativeBrowser) => browser.$(DIALOG);
const undoDisabled = async (browser: NativeBrowser): Promise<boolean> => (await browser.$(EDITOR).$('[data-rp-action="undo"]').getAttribute('disabled')) === 'true';
const at = ([x, y]: StoredPoint): WorldPoint => ({ x, y });

async function zoneNote(ui: Ui, name: string): Promise<Record<string, unknown>> {
	const found = Object.values(await ui.notesOfType('renovation-zone')).filter((zone) => zone.name === name);
	expect(found).toHaveLength(1);
	return found[0];
}

/** The sample project in a 1280 x 1024 window (the editor's `full` layout), with `zone` selected from the list. */
async function seedWith(browser: NativeBrowser, ui: Ui, zone: string): Promise<{ path: string; id: string; outline: StoredPoint[] }> {
	await setWindowSize(browser, 1280, 1024);
	await expect.poll(() => browser.execute(() => window.innerWidth)).toBeGreaterThanOrEqual(1270);
	await seedSampleProject(browser, ui);
	await selectRoom(browser, zone);
	// The Inspector docked beside the stage, not a drawer over it (`nextActionWalk.e2e.ts`'s `widenWindow`).
	expect(await browser.$(EDITOR).$('.rp-editor-shell').getAttribute('data-layout')).toBe('full');
	await settleCamera(browser);
	await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
	const path = await sidecarPath(browser);
	const id = String((await zoneNote(ui, zone)).id);
	return { path, id, outline: await outlineOf(browser, path, id) };
}

async function expectDialogFor(browser: NativeBrowser, name: string): Promise<void> {
	await expect.poll(() => textOf(dialog(browser).$('.rp-dialog-title'))).toBe(en['editor.element.edit'].replace('{name}', name));
}

async function openByInspector(browser: NativeBrowser, name: string): Promise<void> {
	const door = browser.$(EDITOR).$(INSPECTOR_DOOR);
	expect(await textOf(door)).toBe(en['editor.area.outline']);
	await door.click();
	await expectDialogFor(browser, name);
}

/** Step 5: the numbered list's Edit on corner `n`, its row pressed, the region naming it, the caret in its X field. */
async function chooseCorner(browser: NativeBrowser, n: number): Promise<void> {
	const form = dialog(browser).$('[data-rp-form="outline-points"]');
	const choose = await form.$$('[data-rp-corner="choose"]');
	expect(choose.length).toBeGreaterThanOrEqual(n);
	expect(await choose[n - 1].getAttribute('aria-label')).toBe(en['editor.area.edit-corner'].replace('{n}', String(n)));
	await choose[n - 1].click();
	await expect.poll(() => textOf(form.$('[data-rp-corner-status]'))).toBe(en['editor.area.corner'].replace('{n}', String(n)));
	// WebdriverIO's element array has an ASYNC `map`, so the expectation is built from the awaited plain array, never from `choose`.
	const pressed = await form.$$('[data-rp-corner="choose"]').map((button) => button.getAttribute('aria-pressed'));
	expect(pressed).toEqual(pressed.map((_, index) => String(index === n - 1)));
	expect(await browser.execute(() => (document.activeElement as HTMLInputElement | null)?.name ?? null)).toBe(`${String(n - 1)}.x`);
}

/**
 * What `InteractionLayer.vue` draws for the selected zone: each vertex handle (its unnamed circles)
 * as its radius and which of `corners` it sits on, and whether the dialog's dashed preview
 * (`geometry-preview`) passes through each of `through` — `null` when no preview is drawn. Both are
 * located through the zone layer's own transform, the one `canvas.ts` presses corners by.
 */
const marks = (browser: NativeBrowser, corners: readonly WorldPoint[], through: readonly WorldPoint[] = []) =>
	browser.execute(
		(editor: string, worlds: WorldPoint[], targets: WorldPoint[]) => {
			const stage = ((window as unknown as { Konva?: typeof Konva }).Konva?.stages ?? []).find((candidate) => candidate.container().closest(editor) !== null);
			const zone = stage?.findOne<Konva.Layer>('.zone');
			const layer = stage?.findOne<Konva.Layer>('.interaction');
			if (!zone || !layer) throw new Error('No Plan Editor stage with zone and interaction layers is drawn.');
			const screen = (points: WorldPoint[]) => points.map((point) => zone.getAbsoluteTransform().point(point));
			const cornerAt = screen(worlds);
			const handles = layer
				.getChildren((node) => node.getClassName() === 'Circle' && node.name() === '')
				.map((node) => ({ radius: (node as Konva.Circle).radius(), corner: cornerAt.findIndex((corner) => Math.hypot(corner.x - node.getAbsolutePosition().x, corner.y - node.getAbsolutePosition().y) < 2) }));
			const line = layer.findOne<Konva.Line>('.geometry-preview');
			if (!line) return { handles, preview: null };
			const flat = line.points();
			const drawn = Array.from({ length: flat.length / 2 }, (_, index) => line.getAbsoluteTransform().point({ x: flat[index * 2], y: flat[index * 2 + 1] }));
			return { handles, preview: screen(targets).map((target) => drawn.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < 2)) };
		},
		EDITOR,
		[...corners],
		[...through],
	);

/** Every handle at its own corner, `chosen` (0-based) drawn at the highlight radius and no other. */
const handlesWith = (count: number, chosen: number | null) =>
	Array.from({ length: count }, (_, corner) => ({ radius: corner === chosen ? 7 : 4, corner }));

describe('Edit a zone corner by typing its position (BP-04), in the real Obsidian host', () => {
	desktop('steps 1, 2, 5 and 6: the right-click menu offers Edit corners on the Terrace, and corner 3 is chosen and marked alone', async ({ native: { browser, ui, directory } }) => {
		const { outline } = await seedWith(browser, ui, TERRACE);
		await contextClick(browser, IN_TERRACE);
		const menu = browser.$(EDITOR).$('.rp-canvas-context-menu');
		await expect.poll(() => menu.isExisting()).toBe(true);
		const ids = await menu.$$('[data-rp-context-action]').map((item) => item.getAttribute('data-rp-context-action'));
		// The edit group: the zone's details entry, then Edit corners beside it.
		expect(ids.slice(ids.indexOf('rename'), ids.indexOf('rename') + 2)).toEqual(['rename', 'edit-outline']);
		expect(await textOf(menu.$('[data-rp-context-action="rename"]'))).toBe(en['editor.area.details']);
		const entry = browser.$(EDITOR).$(MENU_ENTRY);
		expect({ text: await textOf(entry), disabled: await entry.getAttribute('aria-disabled') }).toEqual({ text: en['editor.area.outline'], disabled: null });
		await shot(browser, directory, 'corner-menu');

		await entry.click();
		await expectDialogFor(browser, TERRACE);
		expect(await dialog(browser).$$('[data-rp-corner-list] li').length).toBe(outline.length);
		// The instrument sees every handle before anything is chosen, so "no other" below can fail.
		expect((await marks(browser, outline.map((point) => at(point)))).handles).toEqual(handlesWith(outline.length, null));
		await shot(browser, directory, 'corner-dialog');

		await chooseCorner(browser, 3);
		await expect.poll(async () => (await marks(browser, outline.map((point) => at(point)))).handles).toEqual(handlesWith(outline.length, 2));
		await shot(browser, directory, 'corner-3-chosen');
	});

	desktop('steps 3 and 4: the Inspector offers Edit corners on a Room and on the Garden, each opening its own dialog', async ({ native: { browser, ui } }) => {
		await seedWith(browser, ui, KITCHEN);
		await openByInspector(browser, KITCHEN);
		await browser.keys('Escape');
		await expect.poll(() => dialog(browser).isExisting()).toBe(false);
		// The opener has focus back; Escape there clears the selection, and the Floor list returns.
		await browser.keys('Escape');
		await expect.poll(() => browser.$(EDITOR).$('.rp-room-inspector').isExisting()).toBe(false);
		await selectRoom(browser, GARDEN);
		await openByInspector(browser, GARDEN);
	});

	desktop('steps 5, 7, 8 and 9: a comma-decimal corner previews without a write, then saves that corner alone; the actions row is in view', async ({ native: { browser, ui, directory } }) => {
		const { path, id, outline } = await seedWith(browser, ui, TERRACE);
		expect(await undoDisabled(browser)).toBe(true);
		await openByInspector(browser, TERRACE);
		await chooseCorner(browser, 3);
		const moved: StoredPoint = [10_500, outline[2][1]];
		const sidecar = await readSidecar(browser, path);
		expect((await marks(browser, [], [at(outline[2]), at(moved)])).preview).toEqual([true, false]);
		await recordSaveStates(browser);
		await dialog(browser).$('[name="2.x"]').setValue('10,5');
		await expect.poll(async () => (await marks(browser, [], [at(outline[2]), at(moved)])).preview).toEqual([false, true]);
		expect(await readSidecar(browser, path)).toBe(sidecar);
		expect(await saveStates(browser)).not.toContain('rp-save-state-saving');

		// L-32: the dialog's one actions row, scrolled into view inside the dialog and the window.
		const row = await browser.execute((selector: string) => {
			const box = document.querySelector(selector)?.getBoundingClientRect();
			const buttons = [...document.querySelectorAll<HTMLElement>(`${selector} .rp-dialog-footer button`)];
			buttons.at(-1)?.scrollIntoView({ block: 'nearest' });
			return buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				const inside = box !== undefined && rect.width > 0 && rect.top >= Math.max(0, box.top) - 0.5 && rect.bottom <= Math.min(window.innerHeight, box.bottom) + 0.5 && rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5;
				return { text: button.textContent?.trim() ?? '', inside };
			});
		}, DIALOG);
		// Step 9 is recorded, not judged: the submit reads `dialog.form.submit`.
		await logEvidence(directory, 'actions-row', row);
		expect(row).toEqual([{ text: en['dialog.cancel'], inside: true }, { text: en['dialog.form.submit'], inside: true }]);
		await shot(browser, directory, 'corner-actions-row');

		await dialog(browser).$('button[type="submit"]').click();
		await expect.poll(() => dialog(browser).isExisting()).toBe(false);
		await expect.poll(() => outlineOf(browser, path, id)).toEqual(outline.map((point, index) => (index === 2 ? moved : point)));
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		expect(await saveStates(browser)).toContain('rp-save-state-saving');
		expect(await undoDisabled(browser)).toBe(false);
	});

	desktop('step 10: real Ctrl+Z restores the outline exactly and Ctrl+Y re-applies it, the zone otherwise untouched', async ({ native: { browser, ui, directory } }) => {
		const { path, id, outline } = await seedWith(browser, ui, TERRACE);
		const fields = ['id', 'name', 'zone-type', 'status', 'project', 'plan'];
		const identity = async () => Object.fromEntries(Object.entries(await zoneNote(ui, TERRACE)).filter(([key]) => fields.includes(key)));
		const before = await identity();
		expect(Object.keys(before).toSorted()).toEqual(fields.toSorted());
		expect(await undoDisabled(browser)).toBe(true);
		await openByInspector(browser, TERRACE);
		await chooseCorner(browser, 3);
		await dialog(browser).$('[name="2.x"]').setValue('10.5');
		await dialog(browser).$('button[type="submit"]').click();
		const edited = outline.map((point, index): StoredPoint => (index === 2 ? [10_500, point[1]] : point));
		await expect.poll(() => outlineOf(browser, path, id)).toEqual(edited);
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		// The keymap's precondition: focus is back inside the editor and not in a text field.
		// Polled: focus is handed back once the dialog has resolved (`restoreInspectorActionFocus.ts`).
		const focusOf = () => browser.execute((editor: string) => ({ inEditor: document.activeElement?.closest(editor) !== null, tag: document.activeElement?.tagName ?? '' }), EDITOR);
		await expect.poll(focusOf).toEqual({ inEditor: true, tag: 'BUTTON' });
		await logEvidence(directory, 'focus-before-keys', await focusOf());

		await browser.keys(['Control', 'z']);
		await expect.poll(() => outlineOf(browser, path, id)).toEqual(outline);
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		// One entry: the history it undid was the whole of it.
		expect(await undoDisabled(browser)).toBe(true);
		await browser.keys(['Control', 'y']);
		await expect.poll(() => outlineOf(browser, path, id)).toEqual(edited);
		await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
		// The zone note is written BEFORE the sidecar (`ObsidianZoneRepository.saveQueued`), so the sidecar
		// outline and the saved label above can both hold while Obsidian is still re-parsing that note:
		// `metadataCache` can then answer no zone note (inferred from the logs, not observed), and a strict one-shot read found NO Terrace on the
		// `latest` leg (two runs, both at this line). Poll the identity until the cache has caught up, and
		// record how long it took and what the misses looked like.
		const misses: number[] = [];
		const started = Date.now();
		await expect
			.poll(async () => {
				const named = Object.values(await ui.notesOfType('renovation-zone')).filter((zone) => zone.name === TERRACE);
				if (named.length !== 1) misses.push(named.length);
				return named.length === 1 ? Object.fromEntries(Object.entries(named[0]).filter(([key]) => fields.includes(key))) : { notes: named.length };
			})
			.toEqual(before);
		await logEvidence(directory, 'identity-after-redo', { misses, waitedMs: Date.now() - started });
	});

	desktop('steps 11 and 12: Cancel and an unchanged submit write nothing and add no history, and the mark is cleared', async ({ native: { browser, ui } }) => {
		const { path, outline } = await seedWith(browser, ui, TERRACE);
		const sidecar = await readSidecar(browser, path);
		expect(await undoDisabled(browser)).toBe(true);
		await openByInspector(browser, TERRACE);
		await chooseCorner(browser, 3);
		await dialog(browser).$('[name="2.x"]').setValue('10.5');
		await recordSaveStates(browser);
		await dialog(browser).$('[data-rp-action="cancel"]').click();
		await expect.poll(() => dialog(browser).isExisting()).toBe(false);
		// The Terrace is still selected, so its handles are drawn: none highlighted, and no preview.
		await expect.poll(() => marks(browser, outline.map((point) => at(point)))).toEqual({ handles: handlesWith(outline.length, null), preview: null });

		await openByInspector(browser, TERRACE);
		const submit = dialog(browser).$('button[type="submit"]');
		expect(await submit.getAttribute('aria-disabled')).toBe('true');
		await submit.click();
		await browser.pause(500);
		expect(await readSidecar(browser, path)).toBe(sidecar);
		expect(await saveStates(browser)).not.toContain('rp-save-state-saving');
		expect(await undoDisabled(browser)).toBe(true);
	});

	desktop('steps 13 and 14: greyed in Renovate with its reason and no Inspector door; absent from both doors in Review', async ({ native: { browser, ui, directory } }) => {
		await seedWith(browser, ui, TERRACE);
		const pane = browser.$(EDITOR);
		const doors = async () => (await pane.$$('[data-rp-action="edit-outline"]')).length;
		expect(await doors()).toBe(1);
		const menu = pane.$('.rp-canvas-context-menu');

		await pane.$('[data-rp-perspective="renovate"]').click();
		await expect.poll(() => pane.$('[data-rp-perspective="renovate"]').getAttribute('aria-checked')).toBe('true');
		await expect.poll(() => pane.$('[data-rp-region="inspector"]').isDisplayed()).toBe(true);
		expect(await doors()).toBe(0);
		await settleCamera(browser);
		await contextClick(browser, IN_TERRACE);
		const entry = pane.$(MENU_ENTRY);
		await expect.poll(() => entry.isExisting()).toBe(true);
		expect({ text: await textOf(entry), disabled: await entry.getAttribute('aria-disabled'), title: await entry.getAttribute('title') }).toEqual({
			text: en['editor.area.outline'],
			disabled: 'true',
			title: en['editor.element.plan-geometry'],
		});
		await shot(browser, directory, 'corner-renovate-greyed');
		await entry.click();
		await browser.pause(500);
		expect(await dialog(browser).isExisting()).toBe(false);
		await browser.keys('Escape');
		await expect.poll(() => menu.isExisting()).toBe(false);

		await pane.$('[data-rp-perspective="review"]').click();
		await expect.poll(() => pane.$('[data-rp-perspective="review"]').getAttribute('aria-checked')).toBe('true');
		await settleCamera(browser);
		await contextClick(browser, IN_TERRACE);
		// The menu did open, so the entry's absence is the menu's answer and not a menu missing.
		// 'Fit selection' (not 'Fit floor') is what only a menu opened on a zone offers, so the Terrace was the target.
		await expect.poll(() => textOf(menu.$('[data-rp-context-action="fit"]'))).toBe(en['editor.view.fit-selection']);
		expect(await pane.$(MENU_ENTRY).isExisting()).toBe(false);
		expect(await doors()).toBe(0);
	});
});

/** The editor shell's width and the layout it chose (`layoutMode.ts`). */
const shellNow = (browser: NativeBrowser) =>
	browser.execute((editor: string) => {
		const shell = document.querySelector(`${editor} .rp-editor-shell`);
		return { width: shell?.clientWidth ?? 0, layout: shell?.getAttribute('data-layout') ?? null };
	}, EDITOR);

/** The editor shell walked to about `target` px by the window: the frame and the docks are measured, not assumed. */
async function paneTo(browser: NativeBrowser, target: number): Promise<void> {
	for (let step = 0, { width } = await shellNow(browser); step < 3 && Math.abs(width - target) > 8; step += 1) {
		const outer = await windowSize(browser);
		await setWindowSize(browser, outer.width + target - width, 1024);
		await browser.pause(400);
		({ width } = await shellNow(browser));
	}
}

/** Where focus is now: whether it is a control drawn inside this editor, and what it is. */
const focusNow = (browser: NativeBrowser) =>
	browser.execute((editor: string) => {
		const active = document.activeElement as HTMLElement | null;
		return {
			live: active !== null && active.isConnected && active.closest(editor) !== null && active.getClientRects().length > 0 && active !== document.body,
			what: active ? `${active.tagName.toLowerCase()}${[...active.attributes].filter((a) => a.name.startsWith('data-rp') || a.name === 'aria-label').map((a) => `[${a.name}="${a.value}"]`).join('')}` : null,
		};
	}, EDITOR);

describe('Edit a zone corner, across pane widths and from the keyboard', () => {
	desktop('steps 15 and 16: a dirty dialog keeps its text across a wide and a constrained pane, Cancel leaves focus on a live control, and the 460 px dialog and mark are recorded', async ({ native: { browser, ui, directory } }) => {
		const { path, outline } = await seedWith(browser, ui, KITCHEN);
		const sidecar = await readSidecar(browser, path);
		await openByInspector(browser, KITCHEN);
		await chooseCorner(browser, 3);
		const field = () => dialog(browser).$('[name="2.x"]');
		await field().setValue('3.9');
		const widths: unknown[] = [];
		for (const layout of ['constrained', 'full', 'constrained'] as const) {
			if (layout === 'full') await setWindowSize(browser, 1280, 1024);
			else await paneTo(browser, 460);
			await expect.poll(async () => (await shellNow(browser)).layout).toBe(layout);
			widths.push({ ...(await shellNow(browser)), openerShown: await browser.$(EDITOR).$(INSPECTOR_DOOR).isDisplayed() });
			expect(await field().getValue()).toBe('3.9');
		}
		// Printed before anything below can fail: the widths reached and whether the opener stayed shown (R7's condition).
		await logEvidence(directory, 'widths', widths);
		await dialog(browser).$('[data-rp-action="cancel"]').click();
		await expect.poll(() => dialog(browser).isExisting()).toBe(false);
		// Focus is handed back once the dialog has resolved (`restoreInspectorActionFocus.ts`), so it is waited for.
		await expect.poll(async () => (await focusNow(browser)).live).toBe(true);
		const focus = await focusNow(browser);
		expect(await readSidecar(browser, path)).toBe(sidecar);

		// Step 15: the dialog opened and a corner chosen AT the sidebar width, from the menu over the room still selected.
		const canvas = await browser.$(EDITOR).$('.rp-plan-canvas').getElement();
		await browser.execute((element: HTMLElement) => element.focus(), canvas);
		await browser.keys(['Shift', 'F10']);
		await browser.$(EDITOR).$(MENU_ENTRY).click();
		await expectDialogFor(browser, KITCHEN);
		await chooseCorner(browser, 3);
		const narrow = await marks(browser, outline.map((point) => at(point)));
		await shot(browser, directory, 'corner-460');
		// Recorded, not asserted (step 15): the widths above, where focus landed, and which handle is
		// drawn at 460 px — the screenshot shows whether it can be seen.
		await logEvidence(directory, 'step-15', { focusAfterCancel: focus, narrowMarks: narrow });
	});

	desktop('step 18: the Inspector door, a corner, its field and the submit are all reached from the keyboard, and focus returns to the door', async ({ native: { browser, ui, directory } }) => {
		const { path, id, outline } = await seedWith(browser, ui, KITCHEN);
		const walk: string[] = [];
		/** Tab until `selector` holds focus, recording each stop; bounded, so a control Tab never reaches fails here. */
		const tabTo = async (selector: string, bound: number): Promise<void> => {
			for (let presses = 0; presses < bound; presses += 1) {
				if (await browser.execute((wanted: string) => document.activeElement?.matches(wanted) === true, selector)) return;
				await browser.keys('Tab');
				walk.push(String((await focusNow(browser)).what));
			}
			throw new Error(`Tab did not reach ${selector} in ${String(bound)} presses`);
		};
		await tabTo(INSPECTOR_DOOR, 300);
		await browser.keys('Enter');
		await expectDialogFor(browser, KITCHEN);
		await tabTo(`[data-rp-corner="choose"][aria-label="${en['editor.area.edit-corner'].replace('{n}', '3')}"]`, 40);
		await browser.keys('Enter');
		expect(await browser.execute(() => (document.activeElement as HTMLInputElement | null)?.name ?? null)).toBe('2.x');
		await browser.keys('End');
		await browser.keys(['Shift', 'Home']);
		for (const key of '4.1') await browser.keys(key);
		await browser.keys('Enter');
		await expect.poll(() => dialog(browser).isExisting()).toBe(false);
		await expect.poll(() => outlineOf(browser, path, id)).toEqual(outline.map((point, index): StoredPoint => (index === 2 ? [4100, point[1]] : point)));
		await expect.poll(() => browser.execute((door: string) => document.activeElement?.matches(door) === true, INSPECTOR_DOOR)).toBe(true);
		await logEvidence(directory, 'keyboard-walk', { stops: walk.length, walk });
	});
});
