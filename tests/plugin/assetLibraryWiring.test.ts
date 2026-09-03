/**
 * @vitest-environment jsdom
 *
 * `assetLibraryDeps` — the Asset library's own bundle, assembled from a composed root.
 *
 * The same shape as `assetDesignerWiring.test.ts` and for the same reason those wiring files
 * exist: a composition that hands the view the wrong collaborator compiles, passes every other
 * test here, and says nothing. What is checked is which SERVICE each member is bound to and
 * what the bundle degrades to when settings could not be read — never the behaviour of the
 * queries themselves, which is asked of them directly one layer down.
 */
import { describe, expect, it } from 'vitest';
import { assetLibraryDeps } from '../../src/plugin/assetLibraryDeps';
import { createCompositionRoot, type CompositionRoot } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { createRepositoryStack } from '../helpers/vault';
import { installObsidianDom } from '../helpers/dom';
import { FakeWorkspace } from '../helpers/workspace';
import { recorder, resetRecorder, lines } from '../helpers/logger';
import { expectErr } from '../helpers/domain';
import type { AssetId } from '../../src/domain/asset/AssetId';
import { ok } from '../../src/core/result/Result';
import type { CatalogueListing } from '../../src/application/queries/ListCatalogueEntries';

installObsidianDom();

const TILES = 'asset-tiles' as AssetId;
const PAINT = 'asset-paint' as AssetId;
const EMPTY_LISTING: CatalogueListing = { entries: [], unreadable: [] };

function composedRoot(): { root: CompositionRoot; stack: ReturnType<typeof createRepositoryStack> } {
	const stack = createRepositoryStack();
	const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, {
		vault: stack.vault,
		fileManager: stack.fileManager,
		metadataCache: stack.metadataCache,
	} as never);
	return { root, stack };
}

function unrecoveredRoot(): CompositionRoot {
	// `settings === null` is exactly the state §4's *Failed, unrecoverable* row is about: the
	// root composed no persistence at all, so there is nothing to re-run and no retry to offer.
	return createCompositionRoot(null, recorder);
}

describe('assetLibraryDeps with a composed root', () => {
	it('binds the commands, the logger and the vault to the root\'s own', () => {
		const { root, stack } = composedRoot();
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');

		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});

		// The PASS-THROUGH half of the bundle: these five members are handed on by reference, so
		// identity is the whole of what there is to check. The QUERIES are the group the bundle
		// CONSTRUCTS, so they cannot be checked this way and are not — the case below drives
		// them instead. This case was named "binds every read … and never a second copy" for a
		// round while asserting not one read; a mutation composing a second `guardAssetLibrary`
		// passed it and the whole suite.
		expect(deps.commands.updateAsset).toBe(persistence.updateAsset);
		expect(deps.commands.setAssetHeight).toBe(persistence.assetDesign.setHeight);
		expect(deps.commands.deleteAsset).toBe(persistence.deleteAsset);
		expect(deps.logger).toBe(root.logger);
		expect(deps.vault).toBe(stack.vault);
		expect(deps.indexScanCompleted()).toBe(true);
	});

	/**
	 * **Every read reaches the query the ROOT composed, and never a second copy.**
	 *
	 * The queries are the one group this bundle CONSTRUCTS rather than passes through, which
	 * makes them the one group where a second copy is possible at all — and a second copy is
	 * not a cosmetic duplication: it is a second guard, applied with whatever exception mapper
	 * that composition happens to reach for, over collaborators the guard-category walk has
	 * detonated somewhere else.
	 *
	 * Driven by REPLACING each guarded door's `execute` on the root's own object AFTER the
	 * bundle is built, which is what makes this an identity check rather than a behaviour one:
	 * the bundle spreads `persistence.assetLibrary`, so it holds those very objects and reads
	 * `.execute` off them at call time. A build composing its own `guardAssetLibrary(...)` — or
	 * its own `GetAssetDesignQuery` — reaches none of these and records nothing.
	 *
	 * Watched failing against exactly that mutation.
	 */
	it('routes all five reads through the root\'s own guarded queries', async () => {
		const { root, stack } = composedRoot();
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});

		const asked: string[] = [];
		const record = (name: string, answer: unknown) => ({
			execute: () => {
				asked.push(name);
				return Promise.resolve(answer);
			},
		});
		Object.assign(persistence.assetLibrary.listCatalogue, record('listCatalogue', ok(EMPTY_LISTING)));
		Object.assign(persistence.assetLibrary.listOutlines, record('listOutlines', ok(new Map())));
		Object.assign(
			persistence.assetLibrary.listOverridingProjects,
			record('listOverridingProjects', ok([])),
		);
		Object.assign(persistence.assetDesign.get, record('getDesign', ok(null)));
		Object.assign(
			persistence.requirementQueries.listRequirementsReferencing,
			record('listReferencing', ok([])),
		);

		await deps.queries.listCatalogue();
		await deps.queries.listOutlines([TILES]);
		await deps.queries.getDesign(TILES);
		await deps.queries.listReferencing(TILES);
		await deps.queries.listOverridingProjects(TILES);

		expect(asked).toEqual([
			'listCatalogue',
			'listOutlines',
			'getDesign',
			'listReferencing',
			'listOverridingProjects',
		]);
	});

	/**
	 * The two halves of the outline boundary, JOINED — which neither of the files proving them
	 * separately can do. `guardCategory.test.ts` proves a detonated collaborator produces
	 * `vault.unexpected-failure` at the guarded door; `assetLibraryQueries.test.ts` proves a
	 * refused batch becomes one `refused` entry per requested id. Nothing drove a THROWING
	 * sidecar all the way through the bundle a view actually holds, so the join followed by
	 * construction and by nothing else.
	 *
	 * The code matters as much as the count: a mark reading `refused` with the mapped code is
	 * what tells a user their shape could not be read, where an empty map would have said *no
	 * shape yet* about every asset in the batch.
	 */
	it('turns a thrown sidecar read into one mapped refused mark per requested id', async () => {
		const { root, stack } = composedRoot();
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});
		Object.assign(persistence.assetGeometry, {
			read: () => {
				throw new Error('the vault exploded');
			},
		});

		const outlines = await deps.queries.listOutlines([TILES, PAINT]);

		expect([...outlines.keys()]).toEqual([TILES, PAINT]);
		expect([...outlines.values()]).toEqual([
			{ kind: 'refused', code: 'vault.unexpected-failure', sidecarPath: undefined },
			{ kind: 'refused', code: 'vault.unexpected-failure', sidecarPath: undefined },
		]);
	});

	it('reads the catalogue through the composed stack rather than refusing', async () => {
		const { root, stack } = composedRoot();

		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});
		const listed = await deps.queries.listCatalogue();

		// An empty vault, read successfully — which is the answer a refusal bundle cannot give,
		// so this is what tells a composed bundle from an unavailable one.
		expect(listed.ok).toBe(true);
	});

	it('subscribes to the ROOT\'s own event bus, so a library change reaches the view', async () => {
		const { root, stack } = composedRoot();
		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});
		const heard: boolean[] = [];
		const unsubscribe = deps.onLibraryChanged((change) => {
			heard.push(change.catalogue);
		});

		// Awaited: an unawaited publish makes this assertion pass vacuously.
		await root.eventBus.publish({ type: 'ProjectIndexRebuilt' });
		unsubscribe();
		await root.eventBus.publish({ type: 'ProjectIndexRebuilt' });

		expect(heard).toEqual([true]);
	});

	it('opens a note BY PATH, which is the only handle an unreadable note has', async () => {
		const { root, stack } = composedRoot();
		await stack.vault.createFolder('Library');
		await stack.vault.create('Library/Broken.md', '---\nname: no id here\n---\n');
		const workspace = new FakeWorkspace();

		const deps = assetLibraryDeps(root, workspace as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});

		expect(await deps.openNote('Library/Broken.md')).toBe('opened');
		// The id-keyed door could not have reached this note at all: it declares no `id`, so
		// `entityRefOf` excludes it and the index never holds it.
		expect(await deps.openNote('Library/Gone.md')).toBe('missing');
	});

	/**
	 * The composed fault door, which nothing else drives: `openNoteAtPath` reports through the
	 * closure this factory builds, and a bundle that forgot to build one would be an unhandled
	 * rejection reaching nobody — every caller of `openNote` is a click handler that discards
	 * its promise.
	 */
	it('reports a faulted open as view.asset-library.open-note-failed rather than rejecting', async () => {
		activateNotices();
		resetRecorder();
		const { root, stack } = composedRoot();
		await stack.vault.createFolder('Library');
		await stack.vault.create('Library/Broken.md', '---\nname: no id here\n---\n');
		const exploding = {
			getLeavesOfType: () => {
				throw new Error('workspace exploded');
			},
		};

		const deps = assetLibraryDeps(root, exploding as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});

		await expect(deps.openNote('Library/Broken.md')).resolves.toBe('failed');
		const logged = lines.find((line) => line.event === 'view.asset-library.open-note-failed');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('workspace exploded');
	});

	it('opens the designer through the one activation every other door already uses', async () => {
		const { root, stack } = composedRoot();
		const workspace = new FakeWorkspace();

		const deps = assetLibraryDeps(root, workspace as never, stack.vault as never, {
			indexScanCompleted: () => true,
		});
		await deps.openDesigner(TILES);

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0]?.state?.state).toEqual({ assetId: TILES });
	});
});

describe('assetLibraryDeps with settings unrecovered', () => {
	/**
	 * TOTAL rather than nullable, exactly as `planEditorDeps` and `assetDesignerDeps` are: the
	 * view stays registered and draws §4's *Failed, unrecoverable* row, where a nullable
	 * dependency would put a branch in every consumer and refusing to register would leave a
	 * restored leaf pointing at a view type Obsidian does not know.
	 */
	it('hands over refusing queries and refusing commands, not null', async () => {
		const deps = assetLibraryDeps(unrecoveredRoot(), new FakeWorkspace() as never, {} as never, {
			indexScanCompleted: () => false,
		});

		expect(expectErr(await deps.queries.listCatalogue()).code).toBe('settings.unrecovered');
		expect(expectErr(await deps.commands.updateAsset.execute({} as never)).code).toBe(
			'settings.unrecovered',
		);
		expect(expectErr(await deps.commands.setAssetHeight.execute({} as never)).code).toBe(
			'settings.unrecovered',
		);
		// The SECOND door, which a proxy could not have supplied: `executeWithVersion` off a
		// proxied function is `undefined`, and a `TypeError` at the one moment this bundle
		// exists to produce a clean refusal.
		expect(expectErr(await deps.commands.setAssetHeight.executeWithVersion({} as never)).code).toBe(
			'settings.unrecovered',
		);
		expect(expectErr(await deps.commands.deleteAsset.execute({} as never)).code).toBe(
			'settings.unrecovered',
		);
	});

	/**
	 * Wired from the bus UNCONDITIONALLY, persistence or not — the bus is the root's own and
	 * exists either way, and a refusing bundle re-reading simply refuses again. Making this the
	 * one member that turns into a no-op would be a second answer to "is this session wired",
	 * decided somewhere else from the other members.
	 */
	it('still subscribes to the bus, so the change source is not a second answer to "is this wired"', async () => {
		const root = unrecoveredRoot();
		const deps = assetLibraryDeps(root, new FakeWorkspace() as never, {} as never, {
			indexScanCompleted: () => false,
		});
		const heard: boolean[] = [];
		deps.onLibraryChanged((change) => {
			heard.push(change.catalogue);
		});

		await root.eventBus.publish({ type: 'ProjectIndexRebuilt' });

		expect(heard).toEqual([true]);
	});
});
