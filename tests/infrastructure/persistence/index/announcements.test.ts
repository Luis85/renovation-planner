import { describe, expect, it } from 'vitest';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createEventBus, type DomainEvent } from '../../../../src/core/events/EventBus';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';

/**
 * The vault-change pipeline ANNOUNCES what it changed, which for four slices it did not.
 *
 * `VaultChangeAdapter` is the sole index writer for every change this plugin did not make
 * itself — a note added by hand, copied in, or arriving through sync — and it held no
 * `EventBus` at all, so each of those reached the index and no view. `ProjectIndexRebuilt`
 * was not going to correct anyone either: it has exactly one publisher, at layout-ready and
 * on a settings swap. A mounted Renovation Project pane therefore drew the vault it had read
 * at mount, indefinitely. Reported in review.
 *
 * These cases assert on the EVENTS rather than on the index, because every one of these paths
 * already updated the index correctly before this existed (`pipeline.test.ts` pins that) — a
 * case reading the index is equally true of the defect and of the fix.
 */
function wired(stack: ReturnType<typeof createRepositoryStack>) {
	const bus = createEventBus(() => undefined);
	const announced: { id: string; type: string }[] = [];
	bus.subscribe('ProjectIndexEntryChanged', (event: DomainEvent) => {
		const payload = (event as { payload: { entityId: string; entityType: string } }).payload;
		announced.push({ id: String(payload.entityId), type: payload.entityType });
	});
	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		events: bus,
		debounceMs: 0,
	});
	return { adapter, announced };
}

/** A project note written straight into the vault, the way sync or a file explorer does. */
function writeForeignProject(stack: ReturnType<typeof createRepositoryStack>, path: string, id: string): void {
	stack.vault.entries.set(
		path,
		serializeFrontmatter({ type: 'renovation-project', id, 'schema-version': 1 }),
	);
	stack.metadataCache.catchUp();
}

/**
 * The bus is promise-aware and costs one microtask hop per delivery, so a fire-and-forget
 * publish — which is what a synchronous pipeline can do and all it can do — has not reached
 * its handler by the time the call returns.
 */
function settled(): Promise<void> {
	return Promise.resolve().then(() => undefined);
}

describe('the vault-change pipeline announces the entries it changes', () => {
	it('announces a project note that arrived from outside this plugin', async () => {
		const stack = createRepositoryStack();
		const { adapter, announced } = wired(stack);
		writeForeignProject(stack, 'Elsewhere/Bathroom/Project.md', 'p-out');

		adapter.onCreate({ path: 'Elsewhere/Bathroom/Project.md' } as never);
		await settled();

		expect(announced).toEqual([{ id: 'p-out', type: 'renovation-project' }]);
	});

	/**
	 * The half `projectListChangeSource`'s docblock had recorded as unfixable — "a project note
	 * DELETED in the vault still publishes nothing at all … there is no `ProjectDeleted` to add
	 * here until something raises one". The removal carries the entry's own type, read off the
	 * entry BEFORE it is dropped, because after `index.remove` there is nothing left to ask.
	 */
	it('announces a project note deleted out of band', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		const { adapter, announced } = wired(stack);
		stack.vault.entries.delete(path);

		adapter.onDelete({ path } as never);
		await settled();

		expect(announced).toEqual([{ id: String(projectId), type: 'renovation-project' }]);
	});

	/**
	 * A rename moves the entry rather than replacing it, so it is the one path that announces
	 * from `onRename` itself: the bytes did not change, so the re-evaluation queued behind it
	 * is suppressed as an echo and would announce nothing at all.
	 */
	it('announces an entry a rename moved', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const oldPath = stack.index.getPath(projectId) ?? '';
		const newPath = 'Renovation/Moved.md';
		const { adapter, announced } = wired(stack);
		stack.vault.entries.set(newPath, stack.vault.entries.get(oldPath) ?? '');
		stack.vault.entries.delete(oldPath);
		stack.metadataCache.catchUp();

		adapter.onRename({ path: newPath } as never, oldPath);
		await settled();

		expect(announced).toEqual([{ id: String(projectId), type: 'renovation-project' }]);
	});

	/**
	 * **The discriminating case, and the reason the announcement sits at the pipeline rather
	 * than inside `ProjectIndex`.** This plugin's own writes upsert the index synchronously and
	 * publish their own command events; Obsidian then replays them back through this pipeline,
	 * where the echo window drops them. An announcement made before that check would fire a
	 * second refresh for every save the user makes — and would make the index, not the domain,
	 * the thing views listen to.
	 */
	it('says nothing about this plugin echoing its own write back', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		const { adapter, announced } = wired(stack);

		adapter.onModify({ path } as never);
		await settled();

		expect(announced).toEqual([]);
	});

	/**
	 * **A retype DISPLACES an entry, and the displacement is a fact about the type it left.**
	 * An upsert keyed on the id replaces the whole entry, so a project note whose `type` is
	 * hand-edited to another of the five leaves `getIdsByType('renovation-project')` — and the
	 * announcement named only what it BECAME. `createProjectListChangeSource` filters on
	 * `renovation-project`, so the one source that needed telling was the one filtered out: a
	 * mounted project list kept the row, and the row's click resolves through `getPath(id)`,
	 * which still answers that path, so it opened the retyped note. Reported in review.
	 *
	 * The displaced type is read BEFORE the upsert, because after it there is nothing left to
	 * ask — which is the sentence `applyRemove` has carried since it was written and the sibling
	 * it sits beside was not following.
	 */
	it('announces both types when an upsert displaces an entry of another type', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		const { adapter, announced } = wired(stack);
		stack.vault.entries.set(
			path,
			serializeFrontmatter({ type: 'renovation-plan', id: String(projectId), 'schema-version': 1 }),
		);
		stack.metadataCache.catchUp();

		adapter.onModify({ path } as never);
		await settled();

		expect(announced).toEqual([
			{ id: String(projectId), type: 'renovation-project' },
			{ id: String(projectId), type: 'renovation-plan' },
		]);
	});

	/**
	 * The other half of the pair, and the one that says the fix is a displacement test rather
	 * than an unconditional second announcement: an ordinary edit to a project note re-upserts
	 * the same type, and a view must hear about that once.
	 */
	it('announces once when an upsert does not change the entry type', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		const { adapter, announced } = wired(stack);
		stack.vault.entries.set(
			path,
			serializeFrontmatter({
				type: 'renovation-project',
				id: String(projectId),
				'schema-version': 1,
				name: 'Renamed by hand',
			}),
		);
		stack.metadataCache.catchUp();

		adapter.onModify({ path } as never);
		await settled();

		expect(announced).toEqual([{ id: String(projectId), type: 'renovation-project' }]);
	});

	it('says nothing about a note that is not ours and never was', async () => {
		const stack = createRepositoryStack();
		const { adapter, announced } = wired(stack);
		stack.vault.entries.set('Notes/Shopping.md', '---\ntitle: milk\n---\n');
		stack.metadataCache.catchUp();

		adapter.onCreate({ path: 'Notes/Shopping.md' } as never);
		await settled();

		expect(announced).toEqual([]);
	});
});
