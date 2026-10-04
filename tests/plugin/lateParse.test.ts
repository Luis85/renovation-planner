// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM through the module mock, and the change adapter arms
// its debounce on `window`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack, serializeFrontmatter } from '../helpers/vault';
import { expectOk } from '../helpers/domain';
import type { ProjectIndexEntryChanged } from '../../src/application/events/projectIndex.events';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';

installObsidianDom();

/**
 * Owner ruling 76: a note Obsidian parses AFTER the vault-change pipeline has processed it joins
 * the index when the parse arrives (`metadataCache.on('changed')`), rather than staying dropped
 * as "not ours" until the next full rebuild.
 *
 * The window is not "a parse slower than 500 ms". `VaultChangeAdapter.enqueue` arms ONE timer on
 * the first path queued and never re-arms it, so a note queued late in a running window gets only
 * what is left of it — the E2E seed's `Loft` project starts the timer, and the six assets created
 * just after it are flushed a few milliseconds later, still unparsed. Both cases below are
 * driven that way: a running window, and a note queued 10 ms before it closes.
 *
 * The fake models the parse: `FakeVault.create` leaves the path unparsed (`getFileCache` answers
 * `null`), and `catchUp()` parses it and fires `changed` — after the cache is current, as
 * `obsidian.d.ts` documents. The plugin's listener is on the stack's own metadata cache, since
 * `loadedPlugin` hands that object over as `app.metadataCache`; only VAULT events have to be
 * forwarded by hand.
 */

/** Private at compile time, present at run time: which paths the pipeline actually processed. */
type Processing = { processPath(path: string): void };

async function wiredPlugin() {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
	const loaded = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
	loaded.workspace.layoutReady();
	const persistence = loaded.plugin.root.persistence;
	if (persistence === null) throw new Error('persistence was not composed');
	stack.vault.on('create', (file: TFile) => loaded.triggerVault('create', file));
	const heard: string[] = [];
	loaded.plugin.root.eventBus.subscribe('ProjectIndexEntryChanged', (event) => {
		heard.push((event as ProjectIndexEntryChanged).payload.entityId);
	});
	return { stack, persistence, heard };
}

/** A project note written the way sync delivers one — straight into the vault, unparsed. */
async function foreignProject(stack: ReturnType<typeof createRepositoryStack>, name: string) {
	const id = createProjectId();
	const path = `Renovation/${name}/${name}.md`;
	await stack.vault.createFolder(`Renovation/${name}`);
	await stack.vault.create(path, serializeFrontmatter({ type: 'renovation-project', id, 'schema-version': 1, name }));
	return { id, path };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('a note parsed after the pipeline processed it', () => {
	it('joins the index when its parse arrives, though it was queued late in a running window', async () => {
		const { stack, persistence, heard } = await wiredPlugin();
		// The window opens on a note Obsidian parses at once — the E2E seed's project.
		const first = await foreignProject(stack, 'Loft');
		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(490);

		// Queued with 10 ms of the window left, and not parsed inside it.
		const late = await foreignProject(stack, 'Attic');
		vi.advanceTimersByTime(10);
		await Promise.resolve();

		// The premise: the window closed, the first note is in, the late one was read against a
		// null cache and dropped.
		expect(persistence.index.getPath(first.id)).toBe(first.path);
		expect(persistence.index.getPath(late.id)).toBeUndefined();
		expect(heard).toEqual([first.id]);

		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);
		await Promise.resolve();

		expect(persistence.index.getPath(late.id)).toBe(late.path);
		expect(heard).toEqual([first.id, late.id]);
	});

	it('takes the parse of its own write as an echo: one read, no write, no announcement', async () => {
		const { stack, persistence, heard } = await wiredPlugin();
		const created = expectOk(await persistence.createProject.execute({ name: 'Kitchen' }));
		const id = created.project.entity.id;
		const path = persistence.index.getPath(id) as string;
		// The create event's own pass, against a null cache that the echo window answers for.
		vi.advanceTimersByTime(500);
		await Promise.resolve();
		heard.length = 0;
		const processed = vi.spyOn(persistence.changeAdapter as unknown as Processing, 'processPath');
		const writes = stack.vault.operations.length;

		stack.metadataCache.catchUp();
		vi.advanceTimersByTime(500);
		await Promise.resolve();

		expect(processed.mock.calls).toEqual([[path]]);
		expect(persistence.index.getPath(id)).toBe(path);
		expect(heard).toEqual([]);
		// Nothing written, so nothing for Obsidian to parse again: no loop to wait for.
		expect(stack.vault.operations.slice(writes).filter((op) => !op.startsWith('read'))).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});
});
