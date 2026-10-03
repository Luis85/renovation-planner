/**
 * **Owner ruling 73, against the vault-change pipeline rather than the repository alone.**
 *
 * `errorPaths.test.ts` pins that a room insert whose sidecar write AND note removal both fail
 * indexes the room's note at once. That entry then meets Obsidian's `create` event for the same
 * note, processed by `VaultChangeAdapter` ~500 ms later — and whether Obsidian has PARSED the note
 * by then is the host's business, not ours. Before the note was marked as this repository's own
 * write, an unparsed note read as "not ours" (`frontmatterOf` answered `{}` for a null cache entry)
 * and the pipeline REMOVED the entry ruling 73 had just written, so the warning's Open source note
 * said "could not be found" again after the debounce. Both orders are driven here: the parse
 * losing that race, and winning it.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { projectFolderOf, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { createEventBus } from '../../../../src/core/events/EventBus';

/** A room insert left standing (`zone.sidecar-insert-uncompensated`), and the pipeline that will hear of it. */
async function halfInsertedRoom(): Promise<{ stack: RepositoryStack; adapter: VaultChangeAdapter; zoneId: string; notePath: string }> {
	const stack = createRepositoryStack();
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
	const planId = createPlanId();
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground' }), 'absent'));
	const folder = projectFolderOf(stack.index, projectId);
	if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
	stack.metadataCache.catchUp();
	const zone = makeZone({ planId, projectId, name: 'Kitchen' });
	const notePath = `${folder}/Zones/Kitchen.md`;
	stack.vault.failures.add(`modify:${sidecarPathFor(folder, planId)}`);
	stack.vault.failures.add(`delete:${notePath}`);
	const saved = await stack.zones.save(zone, 'absent');
	expect(saved.ok ? 'ok' : saved.error.code).toBe('zone.sidecar-insert-uncompensated');
	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		events: createEventBus(() => undefined),
		logger: stack.logger,
		debounceMs: 0,
	});
	return { stack, adapter, zoneId: zone.id, notePath };
}

function createEventFor(stack: RepositoryStack, adapter: VaultChangeAdapter, notePath: string): void {
	const file = stack.vault.getAbstractFileByPath(notePath);
	if (!(file instanceof TFile)) throw new Error(`no note at ${notePath}`);
	adapter.onCreate(file);
}

const entriesAt = (stack: RepositoryStack, path: string): number =>
	stack.index.getIdsByType('renovation-zone').filter((id) => stack.index.getPath(id) === path).length;

describe('a half-inserted room and the vault-change pipeline (owner ruling 73)', () => {
	it('keeps the room indexed when the create event is processed BEFORE Obsidian parses the note', async () => {
		const { stack, adapter, zoneId, notePath } = await halfInsertedRoom();
		// The parse has NOT happened: the fake's cache has no entry for the new note.
		expect(stack.metadataCache.getFileCache(stack.vault.getAbstractFileByPath(notePath) as TFile)).toBeNull();
		createEventFor(stack, adapter, notePath);
		expect(stack.index.getPath(zoneId as never)).toBe(notePath);
		expect(entriesAt(stack, notePath)).toBe(1);
	});

	it('keeps exactly one entry when the parse wins the race', async () => {
		const { stack, adapter, zoneId, notePath } = await halfInsertedRoom();
		stack.metadataCache.catchUp();
		createEventFor(stack, adapter, notePath);
		expect(stack.index.getPath(zoneId as never)).toBe(notePath);
		expect(entriesAt(stack, notePath)).toBe(1);
	});

	it('still hears a later EXTERNAL edit of that note: a hand edit that drops the type removes the entry', async () => {
		const { stack, adapter, zoneId, notePath } = await halfInsertedRoom();
		stack.metadataCache.catchUp();
		createEventFor(stack, adapter, notePath);
		// Straight into `entries`: the outside world, which the cache parses (see `VaultEntries`).
		stack.vault.entries.set(notePath, '---\ntitle: not a room any more\n---\n');
		const file = stack.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) throw new Error(`no note at ${notePath}`);
		adapter.onModify(file);
		expect(stack.index.getPath(zoneId as never)).toBeUndefined();
	});
});
