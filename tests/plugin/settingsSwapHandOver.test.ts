// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM (ribbon element, settings tab) through the module
// mock, and the change adapter arms its debounce on `window`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack, serializeFrontmatter } from '../helpers/vault';
import { expectOk } from '../helpers/domain';
import type { ProjectIndexEntryChanged } from '../../src/application/events/projectIndex.events';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { DEFAULT_SETTINGS, type RenovationPlannerSettings } from '../../src/plugin/settings/settings';

installObsidianDom();

/**
 * Owner ruling 41: a note created just before a settings swap is indexed by the root the swap
 * installs, rather than dropped by the root it retires.
 *
 * The race, as the S21 investigation measured it in real Obsidian: a settings apply lands
 * between the vault's `create` event for one of our notes and Obsidian's parse of it (2–19 ms).
 * The swap used to FLUSH the outgoing adapter, which read the note against a null metadata
 * cache and a per-root echo window that had never heard of it, called it "not ours" and spent
 * the one event there would ever be; the incoming root's scan ran inside the same gap and missed
 * it too. Forced at `create`, 0 of 20 listed until a reload.
 *
 * The fake models that gap already — `FakeVault.create` leaves the path in `pendingParse`, so
 * `getFileCache` answers `null` until `catchUp()` — which is what lets this case be the real
 * pipeline rather than a stand-in for it. What the fake does NOT do is deliver its own events to
 * the plugin: `loadedPlugin`'s app vault records the plugin's listeners separately, so every case
 * here forwards the fake's `create`/`delete` to them the way Obsidian's single vault would.
 */

/** `applySettings` is private; the e2e forced arm reaches it the same way, as `plugin.applySettings`. */
type Swappable = { applySettings(next: RenovationPlannerSettings): void };

/** Private at compile time, present at run time: which paths the pipeline actually processed. */
type Processing = { processPath(path: string): void };

async function wiredPlugin() {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
	const loaded = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
	loaded.workspace.layoutReady();
	const persistence = () => {
		const current = loaded.plugin.root.persistence;
		if (current === null) throw new Error('persistence was not composed');
		return current;
	};
	return { stack, ...loaded, persistence };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('a settings swap inside the create-to-parse gap', () => {
	it('indexes a project created across the swap once the new adapter debounces, and lists it', async () => {
		const { plugin, stack, triggerVault, persistence } = await wiredPlugin();
		// The investigation's forced-at-create arm: exactly one extra apply, inside the create
		// event of the project note, while the cache still has no entry for it.
		let forced = false;
		stack.vault.on('create', (file: TFile) => {
			triggerVault('create', file);
			if (forced || !file.path.endsWith('.md')) return;
			forced = true;
			expect(stack.metadataCache.getFileCache(file)).toBeNull();
			(plugin as unknown as Swappable).applySettings(plugin.root.settings as RenovationPlannerSettings);
		});

		const created = expectOk(await persistence().createProject.execute({ name: 'Kitchen' }));
		const id = created.project.entity.id;
		expect(forced).toBe(true);
		// The new root's own scan ran inside the gap and could not see it: the premise.
		expect(persistence().index.getPath(id)).toBeUndefined();

		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);

		expect(persistence().index.getPath(id)).toBe('Renovation/Kitchen/Kitchen.md');
		const listed = expectOk(await persistence().listProjects.execute());
		expect(listed.projects.map((project) => project.name)).toEqual(['Kitchen']);
	});

	it('processes a handed-over path once, in the new root, and nothing in the outgoing one', async () => {
		const { plugin, stack, triggerVault, persistence } = await wiredPlugin();
		stack.vault.on('create', (file: TFile) => triggerVault('create', file));
		const outgoing = persistence();
		const retired = vi.spyOn(outgoing.changeAdapter as unknown as Processing, 'processPath');
		const oldHeard: string[] = [];
		plugin.root.eventBus.subscribe('ProjectIndexEntryChanged', (event) => {
			oldHeard.push((event as ProjectIndexEntryChanged).payload.entityId);
		});

		// A foreign project note, arriving the way sync delivers one, still unparsed.
		const id = createProjectId();
		const path = 'Renovation/Synced/Synced.md';
		await stack.vault.createFolder('Renovation/Synced');
		await stack.vault.create(path, serializeFrontmatter({ type: 'renovation-project', id, 'schema-version': 1, name: 'Synced' }));

		await plugin.saveSettings({ units: 'imperial' });
		const incoming = persistence();
		expect(incoming).not.toBe(outgoing);
		const fresh = vi.spyOn(incoming.changeAdapter as unknown as Processing, 'processPath');
		const newHeard: string[] = [];
		plugin.root.eventBus.subscribe('ProjectIndexEntryChanged', (event) => {
			newHeard.push((event as ProjectIndexEntryChanged).payload.entityId);
		});

		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);
		await Promise.resolve();

		expect(retired).not.toHaveBeenCalled();
		expect(fresh.mock.calls).toEqual([[path]]);
		expect(incoming.index.getPath(id)).toBe(path);
		expect(newHeard).toEqual([id]);
		expect(oldHeard).toEqual([]);
	});

	it('does not resurrect a note deleted before the swap', async () => {
		const { plugin, stack, triggerVault, persistence } = await wiredPlugin();
		stack.vault.on('create', (file: TFile) => triggerVault('create', file));
		stack.vault.on('delete', (file: TFile) => triggerVault('delete', file));
		const id = createProjectId();
		const path = 'Renovation/Gone/Gone.md';
		await stack.vault.createFolder('Renovation/Gone');
		await stack.vault.create(path, serializeFrontmatter({ type: 'renovation-project', id, 'schema-version': 1, name: 'Gone' }));
		await stack.vault.delete(stack.vault.getAbstractFileByPath(path) as TFile);

		await plugin.saveSettings({ units: 'imperial' });
		const fresh = vi.spyOn(persistence().changeAdapter as unknown as Processing, 'processPath');
		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);

		expect(fresh).not.toHaveBeenCalled();
		expect(persistence().index.getPath(id)).toBeUndefined();
	});

	it('arms no timer in the new root when nothing was pending', async () => {
		const { plugin } = await wiredPlugin();
		const before = vi.getTimerCount();

		await plugin.saveSettings({ units: 'imperial' });

		expect(vi.getTimerCount()).toBe(before);
	});

	/**
	 * The swap's own failure arm: `applySettings` throws at `disposeCascade` (the plant the
	 * apply-failed cases in `settingsTab.test.ts` use), so no new root is installed — and the
	 * paths it had taken from the outgoing adapter go BACK to it, since it is still the adapter
	 * every vault event reaches.
	 */
	it('gives the paths back to the adapter still in charge when the swap fails', async () => {
		const { plugin, stack, triggerVault, persistence } = await wiredPlugin();
		stack.vault.on('create', (file: TFile) => triggerVault('create', file));
		const outgoing = persistence();
		vi.spyOn(outgoing.changeAdapter, 'flush').mockImplementationOnce(() => {
			throw new Error('the outgoing adapter is wedged');
		});
		const id = createProjectId();
		const path = 'Renovation/Kept/Kept.md';
		await stack.vault.createFolder('Renovation/Kept');
		await stack.vault.create(path, serializeFrontmatter({ type: 'renovation-project', id, 'schema-version': 1, name: 'Kept' }));

		await plugin.saveSettings({ units: 'imperial' });
		expect(persistence()).toBe(outgoing);

		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);

		expect(outgoing.index.getPath(id)).toBe(path);
	});
});
