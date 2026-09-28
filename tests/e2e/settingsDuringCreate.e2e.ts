import { describe, expect } from 'vitest';
import { test } from './fixture';
import { closePluginSettings, openPluginSettings, settingControl, settleSettings } from './helpers';
import { writeEvidence } from './diagnostics';
import { reloadPlugin, type Ui } from './planner';
import { mobileEmulation, PLUGIN_ID, type NativeBrowser } from './session';

/**
 * Owner question Q2 (tracker L-19, lifecycle contract F1), as the one vault run
 * `docs/releases/first-beta-readiness/05-owner-decisions.md` §4 asks for: a project create held
 * inside `vault.create` while a settings save rebinds the view. The owner's criterion is "block
 * only if the run shows it": the project must appear in the rebound list without a reload.
 */
const desktop = mobileEmulation ? test.skip : test;

/** `VaultChangeAdapter`'s 500 ms debounce, three times over plus a parse: long enough on a loaded runner. */
const ROW_WINDOW_MS = 3_000;
const ITERATIONS = 3;
/** The forced case's iterations: once forced, the race is deterministic, so a few are enough. */
const FORCED_ITERATIONS = 5;

interface HeldVault {
	create: (...args: unknown[]) => Promise<unknown>;
	__rpOriginalCreate?: (...args: unknown[]) => Promise<unknown>;
}
interface HoldWindow {
	__rpRelease?: () => void;
	__rpHeld?: number;
}

/**
 * Hold every `vault.create` until the test releases it. `noteEntityWrite.ts` calls
 * `deps.vault.create(...)` as a method on the instance the plugin was handed (`this.app.vault`),
 * so wrapping that instance's own `create` holds the project note's write. Restored by
 * `releaseCreates`, in a `finally`, so a failed case does not hang its teardown.
 */
async function holdCreates(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		const vault = app.vault as unknown as HeldVault;
		const held = window as unknown as HoldWindow;
		const original = vault.create.bind(vault);
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		held.__rpRelease = release;
		held.__rpHeld = 0;
		vault.__rpOriginalCreate = original;
		vault.create = async (...args: unknown[]) => {
			held.__rpHeld = (held.__rpHeld ?? 0) + 1;
			await gate;
			return original(...args);
		};
	});
}

async function releaseCreates(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		(window as unknown as HoldWindow).__rpRelease?.();
		const vault = app.vault as unknown as HeldVault;
		if (vault.__rpOriginalCreate) vault.create = vault.__rpOriginalCreate;
		delete vault.__rpOriginalCreate;
	});
}

const heldCreates = (browser: NativeBrowser): Promise<number> =>
	browser.execute(() => (window as unknown as HoldWindow).__rpHeld ?? 0);

/** The project rows' names, scoped to `ProjectRow` so a `Continue` row's name cannot answer. */
function listed(ui: Ui): Promise<string[]> {
	return ui.projectView().$$('.rp-project-row .rp-project-list__name').map((element) => element.getText());
}

interface ForceWindow {
	__rpForceArmed?: boolean;
	__rpForceInstalled?: boolean;
	/**
	 * One entry per forced swap: whether the metadata cache still had NO entry for the note, and
	 * whether the OUTGOING adapter already held the path as pending — the gap and the hand-over.
	 */
	__rpForced?: { cold: boolean; pending: boolean }[];
}

/**
 * The plugin's private swap and the settings it runs on, reached as the S21 forced arm reached
 * them, plus the change adapter's private pending set.
 */
interface Swappable {
	root: { settings: unknown; persistence: { changeAdapter: { pending: Set<string> } } | null };
	applySettings(next: unknown): void;
}

/**
 * Owner ruling 41's race, forced: exactly ONE extra `applySettings` for the next note created,
 * run INSIDE the vault's `create` event — after the plugin's own listener (registered at
 * layout-ready, so earlier) has queued the path, and before Obsidian parses the note. The S21
 * investigation's forced-at-create arm listed 0 of 20 on the build before the ruling.
 */
async function armSwapAtCreate(browser: NativeBrowser): Promise<void> {
	await browser.executeObsidian(({ app }, id) => {
		const held = window as unknown as ForceWindow;
		held.__rpForceArmed = true;
		if (held.__rpForceInstalled) return;
		held.__rpForceInstalled = true;
		held.__rpForced = [];
		const plugin = (app as unknown as { plugins: { plugins: Record<string, Swappable> } }).plugins.plugins[id];
		app.vault.on('create', (file) => {
			if (!held.__rpForceArmed || !file.path.endsWith('.md')) return;
			held.__rpForceArmed = false;
			const note = app.vault.getFileByPath(file.path);
			held.__rpForced?.push({
				cold: note !== null && app.metadataCache.getFileCache(note) === null,
				// Without this a listener order that ran the swap BEFORE the plugin queued the path
				// would still pass: nothing to hand over, and the new root's own event listed it.
				pending: plugin.root.persistence?.changeAdapter.pending.has(file.path) === true,
			});
			plugin.applySettings(plugin.root.settings);
		});
	}, PLUGIN_ID);
}

const forcedSwaps = (browser: NativeBrowser): Promise<{ cold: boolean; pending: boolean }[]> =>
	browser.execute(() => (window as unknown as ForceWindow).__rpForced ?? []);

async function setProjectsFolder(browser: NativeBrowser, folder: string): Promise<void> {
	const windows = await openPluginSettings(browser);
	await settingControl(browser, 'Default projects folder', 'input').setValue(folder);
	await browser.keys('Tab');
	await closePluginSettings(browser, windows);
	// Owner ruling 41: every keystroke queued a save and a swap. Waiting for the last of them is
	// what keeps a trailing swap out of the create-to-parse gap (the S21 cold arm) and off the
	// elements the next step holds; the gap itself is pinned by the forced case below.
	await settleSettings(browser);
}

/** Submit one project create, and hold it inside `vault.create` while the folder setting changes. */
async function createAcrossSettingsSave(browser: NativeBrowser, ui: Ui, name: string, after: string): Promise<void> {
	await holdCreates(browser);
	try {
		// The empty state's action on a vault with no listed project, the list header's otherwise.
		await ui.projectView().$('.rp-project-list__create, .rp-empty-state__action').click();
		await expect.poll(() => ui.dialog().isDisplayed()).toBe(true);
		await ui.dialog().$('[data-field="name"]').setValue(name);
		await ui.dialog().$('button[type="submit"]').click();
		// The create is IN the window: exactly one write reached the host and is held there.
		await expect.poll(() => heldCreates(browser)).toBe(1);
		await setProjectsFolder(browser, after);
		// The save's rebind landed INSIDE the window: `DialogHost`'s unmount resolved the busy
		// dialog as a cancel while its write is still held. Without a rebind it stays open, busy.
		await expect.poll(() => ui.dialog().isExisting()).toBe(false);
	} finally {
		await releaseCreates(browser);
	}
}

describe('Q2: a settings save inside a live project create', () => {
	desktop(
		'a project created across a settings save appears in the list without a reload (owner criterion for Q2)',
		{ timeout: 300_000 },
		async ({ native: { browser, page, ui, directory } }) => {
			const arms: { name: string; path: string; listed: boolean; afterMs: number }[] = [];
			for (let i = 1; i <= ITERATIONS; i += 1) {
				const name = `Kitchen ${i}`;
				const before = `Before ${i}`;
				// Each iteration starts from a known folder, set before the create.
				await setProjectsFolder(browser, before);
				await ui.openProjectView();
				await createAcrossSettingsSave(browser, ui, name, `After ${i}`);
				// Premise: written by the retired root, so under the PREVIOUS folder.
				const path = `${before}/${name}/${name}.md`;
				await expect
					.poll(async () => Object.keys(await ui.notesOfType('renovation-project')).filter((p) => p.endsWith(`/${name}.md`)))
					.toEqual([path]);
				// The rebind cancels the dialog and `onCreateProject` returns on `'cancel'` without
				// navigating, and the view state still holds no project: the LIST is what draws.
				await ui.openProjectView();
				const start = Date.now();
				let seen = false;
				while (!seen && Date.now() - start < ROW_WINDOW_MS) seen = (await listed(ui)).includes(name);
				arms.push({ name, path, listed: seen, afterMs: Date.now() - start });
			}
			await writeEvidence(directory, 'l19-arms', arms);
			// Control: the same selector sees every one of them after a real reload, so a miss above
			// is the index, not a selector matching nothing.
			await reloadPlugin(page);
			await ui.openProjectView();
			const names = arms.map((arm) => arm.name);
			await expect.poll(async () => (await listed(ui)).toSorted()).toEqual(names);
			// The owner's criterion (05-owner-decisions.md §4): "block only if run shows it".
			expect(arms.map((arm) => arm.listed)).toEqual(Array.from({ length: ITERATIONS }, () => true));
		},
	);

	/**
	 * Owner ruling 41: the settings swap HANDS the outgoing adapter's pending note to the incoming
	 * root instead of flushing it against a cache that has not parsed it. The case above waits for
	 * settings to settle, so it can no longer reach that gap; this one forces it, every iteration.
	 * Unverified until CI runs it — the e2e packages are not installed where it was written.
	 */
	desktop(
		'a project whose create event meets a settings swap before the parse is listed without a reload (ruling 41)',
		{ timeout: 300_000 },
		async ({ native: { browser, ui, directory } }) => {
			const arms: { name: string; listed: boolean; afterMs: number }[] = [];
			for (let i = 1; i <= FORCED_ITERATIONS; i += 1) {
				const name = `Pantry ${i}`;
				await ui.openProjectView();
				await armSwapAtCreate(browser);
				await ui.projectView().$('.rp-project-list__create, .rp-empty-state__action').click();
				// The forced swap remounts the view, so the dialog goes either way: closed by the
				// create's own success or cancelled by the rebind's unmount.
				await ui.submitForm(name);
				await expect
					.poll(async () => Object.keys(await ui.notesOfType('renovation-project')).filter((p) => p.endsWith(`/${name}.md`)))
					.toHaveLength(1);
				await ui.openProjectView();
				const start = Date.now();
				let seen = false;
				while (!seen && Date.now() - start < ROW_WINDOW_MS) seen = (await listed(ui)).includes(name);
				arms.push({ name, listed: seen, afterMs: Date.now() - start });
			}
			await writeEvidence(directory, 'ruling-41-forced-arms', arms);
			// The premise, or this case proves nothing: every iteration's swap ran inside the gap,
			// with the path already queued in the adapter the swap retired.
			expect(await forcedSwaps(browser)).toEqual(
				Array.from({ length: FORCED_ITERATIONS }, () => ({ cold: true, pending: true })),
			);
			expect(arms.map((arm) => arm.listed)).toEqual(Array.from({ length: FORCED_ITERATIONS }, () => true));
		},
	);
});
