import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import type { NativeBrowser } from './session';
import type { createPlannerPage } from './helpers';

export const DESIGNER = 'renovation-asset-designer';
export const LIBRARY = 'renovation-asset-library';
export const PLAN_EDITOR = 'renovation-plan-editor';
/** The toilet preset's bowl, the part every drag and nudge here takes. */
export const BOWL = 'detail:detail-2';
/** The one refusal on this surface that speaks in a sentence — `undo.superseded`. */
const SUPERSEDED =
	'This change was edited elsewhere after this step, so undoing it would discard that edit. Reload and undo again if you still want it reversed.';

/** A `.rpgeo` as the designer writes it, read back as the case's own instrument. */
export interface Sidecar {
	schemaVersion: number;
	assetId: string;
	revision: number;
	calibration: unknown;
	shape: {
		footprint: { points: number[][] };
		clearance?: { points: number[][] };
		clearanceNeedsReview: boolean;
		details: { id: string; name: string; outline: { points: number[][]; bulges?: number[] } }[];
	} | null;
}

interface Point { x: number; y: number }
export type ObsidianPage = ReturnType<NativeBrowser['getObsidianPage']>;

/**
 * The asset designer as a user reaches it, plus the two things only a real vault offers: the
 * sidecar on DISK, and Obsidian's own reconcile hook for an edit made outside it.
 */
export type DesignerPage = ReturnType<typeof createDesignerPage>;

export function createDesignerPage(browser: NativeBrowser, page: ObsidianPage, ui: ReturnType<typeof createPlannerPage>) {
	const { leaf, activate } = ui;
	const designer = () => leaf(DESIGNER);
	const geometryDir = () => path.join(page.getVaultPath(), 'Renovation/Library/Geometry');
	const sidecarPath = (assetId: string) => path.join(geometryDir(), `${assetId}.rpgeo`);
	const readSidecar = (assetId: string) => JSON.parse(readFileSync(sidecarPath(assetId), 'utf8')) as Sidecar;

	const leafStates = (type: string) =>
		browser.executeObsidian(({ app }, viewType) => app.workspace.getLeavesOfType(viewType).map((l) => l.getViewState().state), type);

	/** The open designer's asset id, from Obsidian's own view state rather than the DOM. */
	const openAssetId = async (): Promise<string> => {
		const states = (await leafStates(DESIGNER)) as { assetId: string }[];
		const id = states[0]?.assetId;
		if (!id) throw new Error('No designer leaf is open.');
		return id;
	};

	/** The visible save-state word — `Saved just now`, `Saving`, `Save error`, `Saved · refresh needed`. */
	const header = async (): Promise<string> => {
		const text = await designer().$('.rp-save-state-label').getText();
		return text.split('\n').at(-1) ?? text;
	};

	/** Every toast currently shown, as its message line alone. */
	const notices = async (): Promise<string[]> => {
		const all = await browser.$$('.notice-container .notice').map((n) => n.getText());
		return all.map((text) => text.split('\n').filter((line) => line && line !== '×' && line !== line.toUpperCase()).join(' '));
	};

	const submitDialog = async (fill: (form: ReturnType<typeof browser.$>) => Promise<void>): Promise<void> => {
		const form = browser.$('.rp-dialog .rp-dialog-form');
		await expect.poll(() => form.isDisplayed()).toBe(true);
		await fill(form);
		// A typed value reaches the form's own model a tick after the keystrokes; a submit sent
		// inside that tick has been measured to close the dialog with nothing written.
		await browser.pause(250);
		await form.$('button[type="submit"]').click();
		await expect.poll(() => browser.$('.rp-dialog').isExisting()).toBe(false);
	};

	/** The Renovation project view's New asset door, which opens the designer on what it made. */
	const createAsset = async (name: string): Promise<string> => {
		await ui.openProjectView();
		// The door is on the LIST state's foot line; a view left in a project's detail goes back first.
		const back = ui.projectView().$('.rp-project-detail__back');
		if (await back.isExisting()) await back.click();
		await ui.projectView().$('.rp-view-aside__create-asset').click();
		await ui.submitForm(name);
		await expect.poll(() => designer().isDisplayed()).toBe(true);
		return openAssetId();
	};

	const applyPreset = async (preset: string): Promise<void> => {
		const assetId = await openAssetId();
		const before = existsSync(sidecarPath(assetId)) ? readSidecar(assetId).revision : 0;
		await designer().$('.rp-designer-start-preset').click();
		await browser.$(`.rp-preset-choice[data-preset="${preset}"]`).click();
		await submitDialog(() => Promise.resolve());
		await expect.poll(() => readSidecar(assetId).revision).toBe(before + 1);
	};

	const selectPart = (key: string) => designer().$(`.rp-designer-part-row[name="${key}"]`).click();

	/** The fixture most cases start from: a new asset, the toilet preset, its bowl selected. */
	const createToilet = async (name: string): Promise<string> => {
		const assetId = await createAsset(name);
		await applyPreset('toilet');
		await selectPart(BOWL);
		return assetId;
	};


	/**
	 * Where a Konva shape sits on screen, by the id the designer gives it, on the stage of the
	 * n-th designer leaf — two leaves on one asset draw the same ids.
	 */
	const partCentre = (id: string, leafIndex = 0): Promise<Point | null> =>
		browser.execute((wanted, which) => {
			const konva = (window as unknown as { Konva: { stages: { find(sel: string): { id(): string; getClientRect(): { x: number; y: number; width: number; height: number } }[]; container(): HTMLElement }[] } }).Konva;
			const host = document.querySelectorAll('.workspace-leaf-content[data-type="renovation-asset-designer"]')[which];
			for (const stage of konva.stages) {
				if (host && !host.contains(stage.container())) continue;
				const shape = stage.find('Shape').find((candidate) => candidate.id() === wanted);
				if (shape) {
					const c = stage.container().getBoundingClientRect();
					const r = shape.getClientRect();
					// Three quarters down rather than the centre: the toilet's anchor dot sits at the
					// bowl's centre and wins the hit there, by design (hit order step 2).
					return { x: c.left + r.x + r.width / 2, y: c.top + r.y + r.height * 0.75 };
				}
			}
			return null;
		}, id, leafIndex);

	/**
	 * The first half of a drag, HELD: the press captures the design's version, and what happens
	 * before `release` is the conflict window the two-leaf case exists for. `perform(true)` keeps
	 * the button down across action batches.
	 */
	/** A viewport point at a fraction of the active designer's canvas. */
	const canvasPoint = async (fx: number, fy: number): Promise<{ x: number; y: number }> => {
		const canvas = designer().$('.rp-plan-canvas');
		const size = await canvas.getSize();
		const at = await canvas.getLocation();
		return { x: Math.round(at.x + size.width * fx), y: Math.round(at.y + size.height * fy) };
	};

	/**
	 * One key press that leaves every other input source where it is. `browser.keys` ends with
	 * `releaseActions`, which lifts a held pointer too — measured: a drag held in one leaf was
	 * released by the peer's keystroke, so the conflict window closed before the peer wrote.
	 */
	const keyPress = (key: 'ArrowRight' | 'ArrowLeft') => {
		// WebDriver's own key codes for the two arrows: a key action takes one character.
		const code = key === 'ArrowRight' ? '\uE014' : '\uE012';
		return browser.action('key').down(code).up(code).perform(true);
	};

	/** Keyboard focus onto a designer's canvas WITHOUT a click: the active leaf's, or the n-th's. */
	const focusCanvas = (leafIndex?: number) =>
		browser.execute((which) => {
			const canvas =
				// `undefined` crosses the driver as `null`, so the check is on the type.
				typeof which !== 'number'
					? document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"] .rp-plan-canvas')
					: document.querySelectorAll('.workspace-leaf-content[data-type="renovation-asset-designer"] .rp-plan-canvas')[which];
			(canvas as HTMLElement | null | undefined)?.focus();
		}, leafIndex);

	/**
	 * One arrow-key nudge of the current selection: one write through the same chain a drag takes.
	 * The canvas is focused by script, never clicked — a click lands on whatever is under the
	 * canvas's centre, which in a narrow leaf is empty space, and that clears the selection.
	 */
	const nudge = async (leafIndex?: number): Promise<void> => {
		await focusCanvas(leafIndex);
		await keyPress('ArrowRight');
	};

	/**
	 * Arm a keystroke on the n-th designer's canvas `delay` ms from now, from INSIDE the page. The
	 * only way anything overlaps a held pointer: WebDriver serialises its own commands, so a
	 * `browser.execute` issued during an action chain runs after the chain, not during it (measured).
	 */
	const armPeerNudge = (leafIndex: number, delay: number) =>
		browser.execute(
			(which, ms) => {
				const canvas = document.querySelectorAll('.workspace-leaf-content[data-type="renovation-asset-designer"] .rp-plan-canvas')[which] as HTMLElement;
				setTimeout(() => {
					canvas.focus();
					canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
				}, ms);
			},
			leafIndex,
			delay,
		);

	/**
	 * A drag held for 2.5 s in ONE action chain, released where it was held. `during` runs 900 ms
	 * into the hold on the NODE side — the file system is the one thing that reaches the vault
	 * while the driver is busy. A peer keystroke goes through `armPeerNudge` BEFORE this call.
	 */
	const holdDrag = async (id: string, dx: number, leafIndex = 0, during: () => Promise<void> = () => Promise.resolve()): Promise<void> => {
		const from = await partCentre(id, leafIndex);
		if (!from) throw new Error(`No drawn part ${id}.`);
		const x = Math.round(from.x);
		const y = Math.round(from.y);
		const held = browser
			.action('pointer')
			.move({ x, y, origin: 'viewport' })
			.down()
			.move({ x: x + dx, y, duration: 150, origin: 'viewport' })
			.pause(2500)
			.up()
			.perform();
		await new Promise((resolve) => {
			setTimeout(resolve, 900);
		});
		await during();
		await held;
	};

	/** One nudge, waited for on disk. */
	const nudgeTo = async (assetId: string, revision: number): Promise<void> => {
		await nudge();
		await expect.poll(() => readSidecar(assetId).revision).toBe(revision);
	};

	/** One click on the middle of the active Plan Editor's canvas — where a placement lands. */
	const clickPlanCentre = async (): Promise<{ x: number; y: number }> => {
		const canvas = leaf(PLAN_EDITOR).$('.rp-plan-canvas');
		const size = await canvas.getSize();
		const at = await canvas.getLocation();
		const centre = { x: Math.round(at.x + size.width / 2), y: Math.round(at.y + size.height / 2) };
		await browser.action('pointer').move({ ...centre, origin: 'viewport' }).down().up().perform();
		return centre;
	};

	const undoButton = () => designer().$('.rp-designer-history [aria-label="Undo"]');
	const undoDisabled = async (): Promise<boolean> => (await undoButton().getAttribute('disabled')) !== null;

	/**
	 * The sandwiched undo's second half: one Undo lands (`restored` is the revision it writes), the
	 * next is refused with the sentence, and the refusal writes nothing.
	 */
	const undoUntilSuperseded = async (assetId: string, restored: number): Promise<void> => {
		await undoButton().click();
		await expect.poll(() => readSidecar(assetId).revision).toBe(restored);
		expect(await notices()).toEqual([]);
		await undoButton().click();
		await expect.poll(notices).toContain(SUPERSEDED);
		expect(readSidecar(assetId).revision).toBe(restored);
	};

	/** Type into an open FuzzySuggestModal and take the first match. */
	const pickFromPrompt = async (name: string): Promise<void> => {
		await browser.$('.prompt-input').setValue(name);
		await expect.poll(() => browser.$('.prompt .suggestion-item').getText()).toContain(name);
		await browser.keys('Enter');
		await expect.poll(() => browser.$('.prompt').isExisting()).toBe(false);
	};

	/** The FuzzySuggestModal the designer's Choose a background opens; returns the paths it listed. */
	const chooseBackground = async (name: string): Promise<string[]> => {
		await designer().$('button=Choose a background').click();
		await expect.poll(() => browser.$('.prompt').isDisplayed()).toBe(true);
		const listed = await browser.$$('.prompt .suggestion-item').map((item) => item.getText());
		await pickFromPrompt(name);
		return listed;
	};

	const referenceTab = async (): Promise<void> => {
		await designer().$('.rp-designer-tab[data-rp-tab="reference"]').click();
	};

	/** A `dt`/`dd`-style row of the Reference panel, by its label. */
	const referenceRow = (label: string) =>
		designer().$(`.rp-designer-reference-fields`).$(`.//*[normalize-space(.)="${label}"]/following-sibling::*[1]`);

	const editDimensions = async (width: number, depth: number): Promise<void> => {
		await designer().$('.rp-designer-edit-dimensions').click();
		await submitDialog(async (form) => {
			await form.$('input[name="width"]').setValue(String(width));
			await form.$('input[name="depth"]').setValue(String(depth));
		});
	};

	/**
	 * Calibrate the sheet: two points a beat apart — two clicks in one tick read as one — then
	 * the known length. Only the distance dialog appears when nothing is pending.
	 */
	const calibrate = async (knownDistance: number): Promise<void> => {
		await designer().$('.rp-designer-tools [aria-label="Calibrate"]').click();
		const canvas = designer().$('.rp-plan-canvas');
		const size = await canvas.getSize();
		const at = await canvas.getLocation();
		const y = Math.round(at.y + size.height / 2);
		for (const fraction of [0.3, 0.7]) {
			await browser.action('pointer').move({ x: Math.round(at.x + size.width * fraction), y, origin: 'viewport' }).down().up().perform();
			await browser.pause(400);
		}
		await submitDialog(async (form) => {
			await form.$('input[type="number"]').setValue(String(knownDistance));
		});
	};

	/** The palette command's picker, over the Project Index's assets. */
	const openDesignerFor = async (name: string): Promise<void> => {
		await ui.command('open-asset-designer');
		await expect.poll(() => browser.$('.prompt').isDisplayed()).toBe(true);
		await pickFromPrompt(name);
		await expect.poll(() => designer().isDisplayed()).toBe(true);
	};

	/** A second leaf on the open asset, Obsidian's own way — what the tab menu's Split does. */
	const split = () =>
		browser.executeObsidian(async ({ app }) => {
			const source = app.workspace.getLeavesOfType('renovation-asset-designer')[0];
			if (!source) throw new Error('No designer leaf to split.');
			await app.workspace.duplicateLeaf(source, 'split', 'vertical');
		});

	const closeDesigner = (index = 0) =>
		browser.executeObsidian(({ app }, which) => app.workspace.getLeavesOfType('renovation-asset-designer')[which]?.detach(), index);

	/** A write to the sidecar from OUTSIDE the plugin, as a text editor or a sync client makes one. */
	const editSidecar = (assetId: string, mutate: (text: string) => string): void => {
		writeFileSync(sidecarPath(assetId), mutate(readFileSync(sidecarPath(assetId), 'utf8')));
	};

	/**
	 * What Obsidian's own file watcher does on a change it notices: `reconcileFile` is the
	 * adapter's own reconciliation, which raises `modify` for the file. Called by hand because a
	 * driven Obsidian raises `raw` for an external write and never reconciles it (measured,
	 * `assetDesignerRecovery.e2e.ts` pins that), so this is the first link of the chain the plugin
	 * subscribes to, supplied where the host stops.
	 */
	const reconcile = (vaultPath: string) =>
		browser.executeObsidian(async ({ app }, target) => {
			const adapter = app.vault.adapter as unknown as { reconcileFile(a: string, b: string): Promise<void> };
			await adapter.reconcileFile(target, target);
		}, vaultPath);

	const consoleMessages = async (): Promise<string[]> => {
		const logs = (await browser.getLogs('browser')) as { message: string }[];
		return logs.map((entry) => entry.message);
	};

	return {
		leaf,
		designer,
		activate,
		leafStates,
		openAssetId,
		header,
		notices,
		submitDialog,
		createAsset,
		createToilet,
		applyPreset,
		selectPart,
		nudge,
		nudgeTo,
		undoUntilSuperseded,
		partCentre,
		canvasPoint,
		focusCanvas,
		keyPress,
		armPeerNudge,
		holdDrag,
		undoButton,
		clickPlanCentre,
		undoDisabled,
		chooseBackground,
		referenceTab,
		referenceRow,
		editDimensions,
		calibrate,
		openDesignerFor,
		split,
		closeDesigner,
		geometryDir,
		sidecarPath,
		readSidecar,
		editSidecar,
		reconcile,
		consoleMessages,
		inspectorField: (name: string) => designer().$(`.rp-designer-inspector input[name="${name}"]`),
	};
}
