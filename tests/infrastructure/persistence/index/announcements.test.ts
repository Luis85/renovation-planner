import { describe, expect, it } from 'vitest';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import {
	makeAsset as makeAssetEntity,
	makePlan as makePlanEntity,
	makeProject as makeProjectEntity,
} from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createEventBus, type DomainEvent } from '../../../../src/core/events/EventBus';
import type {
	GeometrySidecarChanged,
	ProjectIndexEntryChanged,
} from '../../../../src/application/events/projectIndex.events';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { fileStatAt } from '../../../../src/infrastructure/obsidian/repositories/noteIo';

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
		// The REAL event type, not a hand-written `{ payload: … }`. `DomainEvent` declares only
		// `type`, so the old cast was a conversion between shapes with no overlap — and it was a
		// second derivation of a contract `projectIndex.events.ts` already states, free to drift
		// from it silently.
		const { payload } = event as ProjectIndexEntryChanged;
		announced.push({ id: String(payload.entityId), type: payload.entityType });
	});
	const sidecars: { id: string; type: string }[] = [];
	bus.subscribe('GeometrySidecarChanged', (event: DomainEvent) => {
		const { payload } = event as GeometrySidecarChanged;
		sidecars.push({ id: String(payload.entityId), type: payload.entityType });
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
	return { adapter, announced, sidecars };
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
/** A project and one plan of it, saved through the real repositories so the sidecar exists. */
async function seedPlan(stack: ReturnType<typeof createRepositoryStack>) {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return planId;
}

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

	/**
	 * **The sidecar half, and it is the one nothing else could reach.** A `.rpgeo` is not a
	 * note: it carries no frontmatter, no index entry of its own, and — for an ASSET — no index
	 * mapping either, since ADR-0014 derives its home. So sync, a hand edit or the file
	 * explorer changing one reached the index (at most, a plan's mapping) and no leaf: an open
	 * designer went on drawing the shape it read at mount, indefinitely, and so did an open
	 * Plan Editor for its zones.
	 *
	 * These cases assert on the SIDECAR event rather than on the index, for the reason the file
	 * header gives: the index half of these paths already behaved, and a case reading it is
	 * equally true of the defect and of the fix.
	 */
	describe('a geometry sidecar changing out of band', () => {
		it('announces a plan sidecar modified out of band', async () => {
			const stack = createRepositoryStack();
			const planId = await seedPlan(stack);
			const path = stack.index.getGeometrySidecarPath(planId) ?? '';
			expect(path).toContain('.rpgeo');
			// Forgotten first, which is what makes this an OUT-OF-BAND edit rather than our own:
			// the write that seeded it left a token behind, and the echo check is what that token
			// exists for.
			stack.echo.forget(path);
			const { adapter, sidecars } = wired(stack);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(planId), type: 'renovation-plan' }]);
		});

		it('announces a plan sidecar deleted out of band', async () => {
			const stack = createRepositoryStack();
			const planId = await seedPlan(stack);
			const path = stack.index.getGeometrySidecarPath(planId) ?? '';
			const { adapter, sidecars } = wired(stack);
			stack.vault.entries.delete(path);

			adapter.onDelete({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(planId), type: 'renovation-plan' }]);
		});

		/**
		 * The half the reviewer reported. `processSidecar` returns for an asset entry before it
		 * reaches any of the plan bookkeeping — correctly, since ADR-0014 leaves nothing to
		 * bookkeep — and that return used to be the end of the story.
		 */
		it('announces an asset sidecar modified out of band', async () => {
			const stack = createRepositoryStack();
			const assetId = createAssetId();
			expectOk(await stack.assets.save(makeAssetEntity({ id: assetId }), 'absent'));
			const path = `${stack.libraryFolder}/Geometry/${assetId}.rpgeo`;
			stack.vault.entries.set(path, '{}');
			const { adapter, sidecars } = wired(stack);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(assetId), type: 'renovation-asset' }]);
		});

		it('announces an asset sidecar deleted out of band', async () => {
			const stack = createRepositoryStack();
			const assetId = createAssetId();
			expectOk(await stack.assets.save(makeAssetEntity({ id: assetId }), 'absent'));
			const path = `${stack.libraryFolder}/Geometry/${assetId}.rpgeo`;
			const { adapter, sidecars } = wired(stack);

			adapter.onDelete({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(assetId), type: 'renovation-asset' }]);
		});

		/**
		 * **The discriminating case, and the same one the note path has: the echo check stays
		 * AHEAD of the publish.** This plugin's own sidecar write already costs the leaf one
		 * refresh through the command's own domain event; announcing here as well would make
		 * every zone drag and every shape edit re-read twice. Announcing unconditionally turns
		 * this case red, which is what makes it discriminate rather than merely pass.
		 */
		it('says nothing about this plugin echoing its own sidecar write back', async () => {
			const stack = createRepositoryStack();
			const planId = await seedPlan(stack);
			const path = stack.index.getGeometrySidecarPath(planId) ?? '';
			const { adapter, sidecars } = wired(stack);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([]);
		});

		/**
		 * **The defect this guard was narrowed for, and it is the ordinary case rather than an
		 * edge one.** The check used to be `echo.knows(path)` — "has this plugin ever written
		 * here" — and nothing but a delete removes a path from that memory, so the FIRST local
		 * write silenced every later sync, restore and hand edit of that sidecar for the life of
		 * the session. Every plan whose zones have been dragged, and every asset anyone has
		 * actually designed, is exactly the file this door then stopped speaking about.
		 *
		 * The case above and this one are the two halves of one question and neither is
		 * sufficient alone: the echo must survive our own write and must NOT survive somebody
		 * else's. Note the missing `echo.forget` — the case forty lines up needs one to reach
		 * this door at all, which is the workaround that made the defect invisible.
		 */
		it('announces an edit to a plan sidecar this plugin wrote earlier in the session', async () => {
			const stack = createRepositoryStack();
			const planId = await seedPlan(stack);
			const path = stack.index.getGeometrySidecarPath(planId) ?? '';
			const { adapter, sidecars } = wired(stack);
			// Straight into the entries map, which is this fake's outside world: a sync client,
			// another device, a hand edit in the file explorer.
			stack.vault.entries.set(path, `{"schemaVersion":1,"planId":"${planId}","revision":9,"unit":"mm","calibration":null,"objects":[]}`);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(planId), type: 'renovation-plan' }]);
		});

		/**
		 * The asset half of the case above, and it is what pins the ASSET writer's own stat:
		 * mutating `AssetGeometryStore.writeText` to record none passed the entire suite, 4581
		 * cases, with the designer's every save then announcing itself back into the leaf that
		 * made it. The plan writer had this case from the day the echo check was written; its
		 * sibling had none.
		 */
		it('says nothing about this plugin echoing its own asset sidecar write back', async () => {
			const stack = createRepositoryStack();
			const assetId = createAssetId();
			expectOk(await stack.assets.save(makeAssetEntity({ id: assetId }), 'absent'));
			expectOk(await stack.assetGeometry.write(assetId, { calibration: null, shape: null }));
			const path = `${stack.libraryFolder}/Geometry/${assetId}.rpgeo`;
			const { adapter, sidecars } = wired(stack);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([]);
		});

		/** The asset half, driven through the store a designer's own save goes through. */
		it('announces an edit to an asset sidecar this plugin wrote earlier in the session', async () => {
			const stack = createRepositoryStack();
			const assetId = createAssetId();
			expectOk(await stack.assets.save(makeAssetEntity({ id: assetId }), 'absent'));
			expectOk(await stack.assetGeometry.write(assetId, { calibration: null, shape: null }));
			const path = `${stack.libraryFolder}/Geometry/${assetId}.rpgeo`;
			const { adapter, sidecars } = wired(stack);
			stack.vault.entries.set(path, `{"schemaVersion":1,"assetId":"${assetId}","revision":9,"unit":"mm","calibration":null,"shape":null}`);

			adapter.onModify({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(assetId), type: 'renovation-asset' }]);
		});

		/**
		 * **The delete branch's echo asymmetry, pinned as BEHAVIOUR rather than left as a
		 * paragraph.** A modify of a file the window still recognises as ours says nothing; a
		 * DELETE says something regardless. That is deliberate: both sidecar stores call
		 * `echo.forget` inside their own delete, and `trashFile` is awaited, so whether the
		 * window still knows the path when Obsidian raises the event is a race rather than a
		 * fact — an echo test here would decide nondeterministically while reading as
		 * protection. The price is one redundant re-read on this plugin's own delete, beside
		 * the domain event its command already published; the alternative is a sidecar deleted
		 * out of band reaching nobody, which is the defect this event exists for.
		 *
		 * A build that starts gating the delete on the echo fails HERE rather than leaving the
		 * comment beside that branch quietly wrong.
		 */
		it('announces a deleted sidecar the echo window would have recognised as ours', async () => {
			const stack = createRepositoryStack();
			const planId = await seedPlan(stack);
			const path = stack.index.getGeometrySidecarPath(planId) ?? '';
			// The precondition, in the terms the modify branch now decides on: this is the file we
			// wrote, unchanged since. Asserted rather than assumed, so a build whose sidecar
			// writers stop recording a stat fails HERE instead of turning this case into a
			// vacuous one about a path the window never knew.
			expect(stack.echo.wroteFile(path, fileStatAt(stack.vault as never, path) ?? '')).toBe(true);
			const { adapter, sidecars } = wired(stack);
			stack.vault.entries.delete(path);

			adapter.onDelete({ path } as never);
			await settled();

			expect(sidecars).toEqual([{ id: String(planId), type: 'renovation-plan' }]);
		});

		/**
		 * A stray `.rpgeo` — a copied file, a hand-renamed one — names no indexed entity, so it
		 * has no subject to be about and every leaf must be left alone. Without this the
		 * unfiltered version of the fix passes: publishing for a resolved entry only is what
		 * makes the id in the payload mean something.
		 */
		it('says nothing about a sidecar whose basename names no indexed entity', async () => {
			const stack = createRepositoryStack();
			await seedPlan(stack);
			const { adapter, sidecars } = wired(stack);
			const strayPath = `Renovation/Geometry/${createPlanId()}.rpgeo`;
			stack.vault.entries.set(strayPath, '{}');

			adapter.onModify({ path: strayPath } as never);
			adapter.onDelete({ path: `Renovation/Geometry/${createPlanId()}.rpgeo` } as never);
			await settled();

			expect(sidecars).toEqual([]);
		});
	});
});
