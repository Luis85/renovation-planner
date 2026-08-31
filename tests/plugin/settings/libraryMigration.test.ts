/**
 * Changing the library folder is a MIGRATION, and the ORDER is its whole contract:
 * validate, move, rebuild, and persist LAST. Persisting first leaves every project
 * resolving an empty library while the notes still sit at the old path, which is why the
 * first case asserts a SEQUENCE rather than an end state — a build that wrote `data.json`
 * before moving a note passes every outcome assertion in this file.
 */
import { describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import {
	catalogueNotesIn,
	libraryGeometryIn,
	libraryDestinations,
	migrateLibraryFolder,
	projectFolderPaths,
	type LibraryMigrationDeps,
} from '../../../src/plugin/settings/libraryMigration';
import { isErr, isOk } from '../../../src/core/result/Result';
import { assetSidecarPathFor } from '../../../src/infrastructure/obsidian/repositories/paths';
import type { ProjectIndex, ProjectIndexEntry } from '../../../src/application/ports/ProjectIndex';
import type { EntityId } from '../../../src/core/identity/EntityId';

const SOURCE = 'Renovation/Library';
const DESTINATION = 'Shared/Catalogue';

/** A stand-in for the one member this code reads off a note: where it is. */
const noteAt = (path: string): TFile => ({ path }) as unknown as TFile;

interface Harness {
	deps: LibraryMigrationDeps;
	/** Every side effect that reaches the vault or the file, in the order it happened. */
	order: string[];
	renamed: { from: string; to: string }[];
	ensured: string[];
	logged: { event: string; context?: Record<string, unknown> }[];
	persistedFolder(): string | undefined;
}

function harness(overrides: Partial<LibraryMigrationDeps> = {}): Harness {
	const order: string[] = [];
	const renamed: { from: string; to: string }[] = [];
	const ensured: string[] = [];
	const logged: { event: string; context?: Record<string, unknown> }[] = [];
	let persisted: string | undefined;
	const record = (event: string, context?: Record<string, unknown>): void => {
		logged.push({ event, context });
	};
	const deps: LibraryMigrationDeps = {
		projectFolders: () => ['Renovation/Kitchen refit'],
		// The source is there unless a case says otherwise — every other case is about what
		// happens once it is.
		vaultFolders: () => [SOURCE],
		catalogueNotes: (from) => [noteAt(`${from}/Assets/Tiles.md`), noteAt(`${from}/Assets/Paint.md`)],
		/**
		 * EMPTY by default — a library nobody has designed an asset in yet, which is the
		 * ordinary state and the one every case written before ADR-0014 was describing. The
		 * cases that care hand in their own, rather than every existing `order` and `renamed`
		 * sequence in this file gaining a move it was not written to argue about.
		 */
		geometrySidecars: () => [],
		ensureFolder: (path) => {
			ensured.push(path);
			return Promise.resolve();
		},
		renameFile: (file, to) => {
			order.push('move');
			renamed.push({ from: file.path, to });
			return Promise.resolve();
		},
		rebuildIndex: () => {
			order.push('rebuild');
		},
		persist: (folder) => {
			order.push('persist');
			persisted = folder;
			return Promise.resolve();
		},
		logger: { debug: record, info: record, warn: record, error: record },
		...overrides,
	};
	return { deps, order, renamed, ensured, logged, persistedFolder: () => persisted };
}

describe('migrateLibraryFolder', () => {
	it('moves every catalogue note, then rebuilds, then persists — in that order', async () => {
		const rig = harness();

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isOk(result)).toBe(true);
		expect(rig.order).toEqual(['rebuild', 'move', 'move', 'rebuild', 'persist']);
		expect(rig.persistedFolder()).toBe(DESTINATION);
	});

	/**
	 * The path RELATIVE to the old root, never the leaf name: a catalogue note lives at
	 * `<library>/Assets/Tiles.md`, so its name alone would flatten it into the destination
	 * and collide the moment `Suppliers/` and `Trades/` exist beside `Assets/`.
	 */
	it('keeps each note at its path relative to the old root', async () => {
		const rig = harness();

		await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(rig.renamed).toEqual([
			{ from: 'Renovation/Library/Assets/Tiles.md', to: 'Shared/Catalogue/Assets/Tiles.md' },
			{ from: 'Renovation/Library/Assets/Paint.md', to: 'Shared/Catalogue/Assets/Paint.md' },
		]);
		expect(rig.ensured).toEqual(['Shared/Catalogue/Assets', 'Shared/Catalogue/Assets']);
	});

	/**
	 * A partial move is not compensated, so the DIAGNOSTIC is the only record of which notes
	 * were relocated before the failure — `docs/tasks/19`'s Definition of Done asks for one
	 * "naming what moved". Asserting the event name alone would stay green against a
	 * diagnostic that had dropped `moved` entirely, which is why the context is asserted and
	 * why the fixture moves ONE note successfully first: an empty `moved` would pass against
	 * a dropped field too.
	 */
	it('leaves data.json untouched when a move fails, and names what it had already moved', async () => {
		const relocated: string[] = [];
		const rig = harness({
			renameFile: (_file, to) => {
				if (relocated.length > 0) return Promise.reject(new Error('locked'));
				relocated.push(to);
				return Promise.resolve();
			},
		});

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isErr(result) && result.error.code).toBe('settings.library-move-failed');
		expect(rig.persistedFolder()).toBeUndefined();
		// Not merely "no persist": the POST-move rebuild is downstream of the move too, so a
		// partial move must not re-point the index at a folder half the catalogue never
		// reached. Asserted as the exact sequence rather than as "contains no rebuild", which
		// stopped discriminating when step 0 put a refresh in front of the move: that spelling
		// now fails for the refresh and would go on passing if the post-move rebuild came back.
		// Step 0's refresh and nothing after it. This case overrides `renameFile` without
		// recording, so a move leaves no entry — the discriminating half is that no SECOND
		// 'rebuild' appears, which is what a partial move must never produce.
		expect(rig.order).toEqual(['rebuild']);
		expect(rig.logged).toHaveLength(1);
		expect(rig.logged[0].event).toBe('settings.library-move-failed');
		// The note that DID move, by its destination path, plus the cause that stopped the
		// next one — the two halves a reader needs to find the catalogue and know why it is
		// in two places.
		expect(rig.logged[0].context).toMatchObject({ moved: ['Shared/Catalogue/Assets/Tiles.md'] });
		expect(rig.logged[0].context?.cause).toBeInstanceOf(Error);
		// And no reverse move: the only rename after the failure would be a compensation,
		// and this migration deliberately attempts none.
		expect(relocated).toEqual(['Shared/Catalogue/Assets/Tiles.md']);
	});

	/**
	 * The rebuild is the OTHER step that runs after every note has moved, and it can throw:
	 * `buildProjectIndexEntries` reads the vault and the metadata cache. Sitting outside both
	 * catch blocks, it made this one arm reject rather than resolve — breaking the contract
	 * the sibling case below asserts, leaving the durable setting naming the SOURCE while the
	 * notes sit at the destination, and sending the caller down the generic detached-fault
	 * path with none of the recovery guidance the post-move failures carry.
	 *
	 * Asserted on the CODE rather than on "it did not succeed", because a rejection satisfies
	 * that reading too — and the `await` below is the whole instrument: against a rejecting
	 * build it throws before any assertion runs.
	 */
	it('resolves a distinct outcome when the rebuild fails after the move', async () => {
		// Throws on the SECOND call, not on every one: since step 0 refreshes the index before
		// reading it, an unconditional thrower never reaches the move at all and this case
		// would silently become a test of `settings.library-refresh-failed` — green, and about
		// a different arm than its name claims. Measured: that was the first spelling here.
		//
		// It WRAPS the harness's own dep rather than replacing it, because the recorder is
		// private to `harness()`. A hand-rolled `order.push('rebuild')` does not merely fail
		// to record — `order` is not in scope, so the ReferenceError is caught by step 0's own
		// catch and reported as a refresh failure, which is a fake manufacturing the very
		// outcome this case exists to distinguish from.
		const rig = harness();
		const refresh = rig.deps.rebuildIndex;
		let calls = 0;
		rig.deps.rebuildIndex = (): void => {
			calls += 1;
			if (calls === 1) {
				refresh();
				return;
			}
			throw new Error('the metadata cache is not ready');
		};

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isErr(result) && result.error.code).toBe('settings.library-rebuild-failed');
		// Persistence is not attempted: the session cannot be told to agree with a vault it
		// has just failed to read.
		expect(rig.order).toEqual(['rebuild', 'move', 'move']);
		expect(rig.persistedFolder()).toBeUndefined();
		expect(rig.logged).toHaveLength(1);
		expect(rig.logged[0].event).toBe('settings.library-rebuild-failed');
		expect(rig.logged[0].context?.cause).toBeInstanceOf(Error);
	});

	/**
	 * The defect this step exists for, driven through the one relationship that produces it:
	 * the enumeration reads the INDEX, and the index is stale until something rebuilds it.
	 *
	 * A user renames a folder inside the library and then moves the library in the same
	 * session. Obsidian reports that rename as a `TFolder`, `RenovationPlannerPlugin` filters
	 * every vault event to `TFile`, so each DESCENDANT note keeps its old path in the index —
	 * while the vault file already has its new one. `catalogueNotesIn` intersects the two, so
	 * the note matches neither side and is silently omitted: the migration moves what is left,
	 * rebuilds, and persists the destination as a success.
	 *
	 * The fake models exactly that dependency and nothing else — `catalogueNotes` answers
	 * nothing until a rebuild has run, which is what the real closure over the live index
	 * does. Against a build with no step 0 it returns empty, no note moves, and the migration
	 * still resolves `ok` having persisted the destination: the assertion on `renamed` is
	 * what discriminates, and asserting `isOk` alone would pass in both worlds, which is the
	 * shape this file has already been caught by once.
	 */
	it('refreshes the index before enumerating, so a note under a renamed folder still moves', async () => {
		let refreshed = false;
		const rig = harness({
			rebuildIndex: () => {
				refreshed = true;
			},
			catalogueNotes: (from) => (refreshed ? [noteAt(`${from}/Assets/Tiles.md`)] : []),
		});

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isOk(result)).toBe(true);
		expect(rig.renamed).toEqual([
			{ from: `${SOURCE}/Assets/Tiles.md`, to: `${DESTINATION}/Assets/Tiles.md` },
		]);
		expect(rig.persistedFolder()).toBe(DESTINATION);
	});

	/**
	 * Step 0's own failure arm. It is NOT the rebuild row's: that sentence opens "The
	 * catalogue moved", and here nothing has been renamed at all — asserted on `renamed`
	 * rather than on the code alone, because a build that refused with the right code after
	 * moving half the catalogue would satisfy the code assertion and be the worse outcome.
	 */
	it('refuses without moving anything when the pre-move refresh fails', async () => {
		const rig = harness({
			rebuildIndex: () => {
				throw new Error('the metadata cache is not ready');
			},
		});

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isErr(result) && result.error.code).toBe('settings.library-refresh-failed');
		expect(rig.renamed).toEqual([]);
		expect(rig.order).toEqual([]);
		expect(rig.persistedFolder()).toBeUndefined();
		expect(rig.logged).toHaveLength(1);
		expect(rig.logged[0].event).toBe('settings.library-refresh-failed');
		expect(rig.logged[0].context?.cause).toBeInstanceOf(Error);
	});

	/**
	 * The last failure point, and the only one where the notes have already moved. It gets
	 * its own code because its recovery differs from every other arm: re-running the
	 * migration would move nothing, since the notes are already there.
	 */
	it('reports a distinct outcome when persisting fails after the move', async () => {
		const rig = harness({ persist: () => Promise.reject(new Error('data.json is read-only')) });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		// It RESOLVES a failed Result rather than rejecting — the declared contract.
		expect(isErr(result) && result.error.code).toBe('settings.library-persist-failed');
		expect(rig.order).toEqual(['rebuild', 'move', 'move', 'rebuild']);
		expect(rig.logged.map((line) => line.event)).toEqual(['settings.library-persist-failed']);
	});

	it('refuses a destination overlapping any project folder, and moves nothing', async () => {
		const renameFile = vi.fn<LibraryMigrationDeps['renameFile']>(() => Promise.resolve());
		const rig = harness({
			renameFile,
			// The overlapping folder is SECOND, so the loop has to walk past a folder that
			// does not overlap rather than stopping at the first one it is handed.
			projectFolders: () => ['Renovation/Bathroom', 'Renovation/Kitchen refit'],
		});

		const result = await migrateLibraryFolder(rig.deps, SOURCE, 'Renovation/Kitchen refit/Library');

		expect(isErr(result) && result.error.code).toBe('settings.library-overlaps-project');
		expect(renameFile).not.toHaveBeenCalled();
	});

	/**
	 * A destination that OVERLAPS the source, in any of the three directions
	 * `foldersOverlap` reads: the source itself, a folder inside it, and a folder that
	 * contains it.
	 *
	 * The nested one is what makes this a refusal rather than a tidiness rule. Moving
	 * `Renovation/Library` into `Renovation/Library/New` leaves every note still UNDER the
	 * source, so a persist failure — which does not change the setting — is followed by a
	 * retry that re-enumerates the very notes it just moved and sends
	 * `New/Assets/Tiles.md` to `New/New/Assets/Tiles.md`. If persistence then succeeds, the
	 * catalogue is stranded below the folder the setting names.
	 */
	it.each([
		['the source itself', SOURCE],
		['a folder nested inside the source', `${SOURCE}/New`],
		['a folder containing the source', 'Renovation'],
	])('refuses %s as a destination, and moves nothing', async (_case, destination) => {
		const renameFile = vi.fn<LibraryMigrationDeps['renameFile']>(() => Promise.resolve());
		const rig = harness({ renameFile });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, destination);

		expect(isErr(result) && result.error.code).toBe('settings.library-overlaps-source');
		expect(renameFile).not.toHaveBeenCalled();
	});

	it('refuses an empty destination, and moves nothing', async () => {
		const renameFile = vi.fn<LibraryMigrationDeps['renameFile']>(() => Promise.resolve());
		const rig = harness({ renameFile });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, '   ');

		expect(isErr(result) && result.error.code).toBe('settings.library-folder-empty');
		expect(renameFile).not.toHaveBeenCalled();
	});
});

const entry = (id: string, type: ProjectIndexEntry['type'], path: string): ProjectIndexEntry => ({
	id: id as EntityId<string>,
	type,
	path,
});

const stackOver = (entries: readonly ProjectIndexEntry[]): { index: ProjectIndex } => ({
	index: { entries: () => entries } as unknown as ProjectIndex,
});

describe('projectFolderPaths', () => {
	it('derives each project folder from where its own note sits', () => {
		const persistence = stackOver([
			entry('p1', 'renovation-project', 'Renovation/Kitchen refit/Project.md'),
			entry('z1', 'renovation-zone', 'Renovation/Kitchen refit/Zones/Kitchen.md'),
			entry('p2', 'renovation-project', 'Elsewhere/Loft/Project.md'),
		]);

		expect(projectFolderPaths(persistence)).toEqual(['Renovation/Kitchen refit', 'Elsewhere/Loft']);
	});

	/**
	 * With settings unrecovered there is no persistence stack at all, so there is no index
	 * to ask. Answering "no project folders" is the honest reading of that, and it is the
	 * safe one too: the migration is unreachable from a pane that declares no action row.
	 */
	it('answers nothing when there is no index to ask', () => {
		expect(projectFolderPaths(null)).toEqual([]);
	});
});

describe('libraryDestinations', () => {
	it('drops every folder that overlaps a project folder in either direction', () => {
		const offered = libraryDestinations(
			['Shared/Catalogue', 'Renovation/Kitchen refit', 'Renovation/Kitchen refit/Assets', 'Renovation'],
			['Renovation/Kitchen refit'],
			SOURCE,
		);

		// `Renovation` contains the project folder, so it goes too — the check refuses in
		// both directions, since either path can be the one that moves.
		expect(offered).toEqual(['Shared/Catalogue']);
	});

	/**
	 * The same predicate against the SOURCE, which drops three folders a user could
	 * otherwise pick: the library folder itself (renaming every note onto itself), a folder
	 * inside it (the stranding case the migration's own guard refuses) and a folder that
	 * contains it.
	 *
	 * Filtering stays a convenience — the migration is what refuses — but there is no
	 * reason to offer a destination that is guaranteed to be refused.
	 */
	it('drops the current library folder and anything overlapping it', () => {
		const offered = libraryDestinations(
			['Shared/Catalogue', SOURCE, `${SOURCE}/New`, 'Renovation'],
			[],
			SOURCE,
		);

		expect(offered).toEqual(['Shared/Catalogue']);
	});
});

/**
 * The finding that changed the QUESTION rather than adding a fifth refinement to the answer.
 *
 * §83 forbids a project folder inside the library, and Tasks 8 and 9 exist to MARK that state
 * — so this slice already grants it happens. A project dragged to `Renovation/Library/Kitchen`
 * puts its note, its zones and its geometry sidecar under the library, and an enumeration that
 * asks "every file under this folder" sweeps all of them into the destination: moving the
 * library to `Shared` relocates the whole project to `Shared/Kitchen`.
 *
 * The catalogue is not "the files under a folder". It is the ASSET notes, which the Project
 * Index already knows — SDD §47 makes it the single answer to where an entity is, and every
 * other read in this plugin resolves through it.
 *
 * BOTH halves are asserted. A case checking only that the catalogue moved passes against the
 * defect, since the defect moves the catalogue too — it just takes the project with it.
 */
it('moves the catalogue and leaves a project filed under the library where it is', async () => {
	const files = [
		noteAt('Renovation/Library/Assets/Tiles.md'),
		noteAt('Renovation/Library/Kitchen/Project.md'),
		noteAt('Renovation/Library/Kitchen/Zones/Kitchen.md'),
		// Not an index ENTRY of its own — a plan's sidecar path rides on the plan's entry — so
		// it is a file under the library that no entity type claims. It must not move either.
		noteAt('Renovation/Library/Kitchen/Geometry/p1.rpgeo'),
	];
	const persistence = stackOver([
		entry('a1', 'renovation-asset', 'Renovation/Library/Assets/Tiles.md'),
		entry('p1', 'renovation-project', 'Renovation/Library/Kitchen/Project.md'),
		entry('z1', 'renovation-zone', 'Renovation/Library/Kitchen/Zones/Kitchen.md'),
	]);
	const rig = harness({
		projectFolders: () => ['Renovation/Library/Kitchen'],
		catalogueNotes: (from) => catalogueNotesIn(persistence, files, from),
	});

	const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

	expect(isOk(result)).toBe(true);
	expect(rig.renamed).toEqual([
		{ from: 'Renovation/Library/Assets/Tiles.md', to: 'Shared/Catalogue/Assets/Tiles.md' },
	]);
});

/**
 * Task 5's documented behaviour, and the reason the enumeration is an INTERSECTION rather
 * than a bare "every asset the index knows": an asset filed outside the library is not
 * relocated (an update writes where the note already sits; only an insert goes to the
 * library). Enumerating by type alone would silently change that.
 */
it('leaves an asset filed outside the library where it is', async () => {
	const files = [noteAt('Renovation/Library/Assets/Tiles.md'), noteAt('Elsewhere/Paint.md')];
	const persistence = stackOver([
		entry('a1', 'renovation-asset', 'Renovation/Library/Assets/Tiles.md'),
		entry('a2', 'renovation-asset', 'Elsewhere/Paint.md'),
	]);
	const rig = harness({ catalogueNotes: (from) => catalogueNotesIn(persistence, files, from) });

	await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

	expect(rig.renamed).toEqual([
		{ from: 'Renovation/Library/Assets/Tiles.md', to: 'Shared/Catalogue/Assets/Tiles.md' },
	]);
});

/**
 * A library configured at the vault ROOT — reachable through a hand-edited `data.json`,
 * since `folderFrom` refuses an empty string but accepts `"/"`.
 *
 * A review bot read the enumeration and reported a silent success here: `catalogueNotesIn`
 * builds a `${folder}/` prefix, which for the root is `'/'` (or `'//'` through the real
 * `normalizePath`), and no Obsidian path carries a leading slash — so no catalogue note
 * would match, and the migration would persist the destination having moved nothing.
 *
 * The prefix arithmetic is exactly as described. **The consequence is not reachable**, and
 * this case is what says so rather than a comment: `foldersOverlap` treats the root as
 * containing every folder, so the destination-overlaps-source refusal fires FIRST, at every
 * destination there is. `deps.catalogueNotes` is never called, and `catalogueNotesIn` has no
 * other production caller.
 *
 * So the honest state is a REFUSAL, not a silent success — and the cost is that a root
 * library can never be moved anywhere, which this case also pins. Guarding the enumeration
 * against a folder it cannot receive would be a branch nothing can drive, against a coverage
 * budget of about two.
 */
it('refuses to move a library configured at the vault root, rather than silently moving nothing', async () => {
	const files = [noteAt('Assets/Tiles.md')];
	const persistence = stackOver([entry('a1', 'renovation-asset', 'Assets/Tiles.md')]);
	const rig = harness({ catalogueNotes: (from) => catalogueNotesIn(persistence, files, from) });

	const result = await migrateLibraryFolder(rig.deps, '/', DESTINATION);

	// The refusal, not the no-op: asserted on the CODE, because "moved nothing" is equally
	// true of the silent success the report describes.
	expect(isErr(result) && result.error.code).toBe('settings.library-overlaps-source');
	expect(rig.renamed).toEqual([]);
	expect(rig.persistedFolder()).toBeUndefined();
});

/**
 * The commonest path of all, and the one a blunt existence check breaks: a fresh vault.
 *
 * The default `Renovation/Library` is created LAZILY, by the asset repository, on the first
 * asset insert — so a user who installs the plugin and picks their library folder before
 * creating anything has no source folder at all. There is nothing to move and nothing that
 * could be stranded, so the migration must run normally: validate, move the zero notes it
 * finds, rebuild, persist.
 *
 * Asserted on the PERSIST as well as on `ok`, because "moved nothing" is equally true of a
 * build that refused.
 */
it('moves an empty library when the source folder does not exist at all', async () => {
	const rig = harness({ vaultFolders: () => [], catalogueNotes: () => [] });

	const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

	expect(isOk(result)).toBe(true);
	expect(rig.renamed).toEqual([]);
	// Two rebuilds and no move: step 0's refresh, then step 5's, with nothing to relocate.
	expect(rig.order).toEqual(['rebuild', 'rebuild', 'persist']);
	expect(rig.persistedFolder()).toBe(DESTINATION);
});

/**
 * The other half of that pair, and the one round 2 was written for: the source is absent at
 * the spelling `data.json` names while a CASE-VARIANT of it is present, holding the notes.
 *
 * The exact enumeration will not look there, so without this refusal the migration moves
 * nothing, reports success and persists the destination — the catalogue left at a path no
 * setting names any more. It must stay a refusal: a fix for the fresh-vault case above that
 * let this through would have traded one silent stranding for another.
 */
it('refuses when the source exists only under another spelling, and moves nothing', async () => {
	const files = [noteAt('Renovation/Library/Assets/Tiles.md')];
	const persistence = stackOver([entry('a1', 'renovation-asset', 'Renovation/Library/Assets/Tiles.md')]);
	const rig = harness({
		catalogueNotes: (from) => catalogueNotesIn(persistence, files, from),
		vaultFolders: () => ['Renovation/Library'],
	});

	const result = await migrateLibraryFolder(rig.deps, 'renovation/library', DESTINATION);

	expect(isErr(result) && result.error.code).toBe('settings.library-source-case-mismatch');
	expect(rig.renamed).toEqual([]);
	expect(rig.persistedFolder()).toBeUndefined();
});

/**
 * Two genuinely distinct folders differing only in case, BOTH holding indexed assets — which
 * is what makes this the Linux case rather than the misspelling above, and what makes it
 * still worth having after the enumeration became index-driven.
 *
 * The index half does not save this one: both notes are assets, so only the source
 * INTERSECTION separates them. Folding it would relocate an asset the user filed in the other
 * folder, which Task 5 says stays where it is. For a GUARD over-refusing is the safe
 * direction — `foldersOverlap` folds for that reason — and for an ENUMERATION the asymmetry
 * REVERSES, because over-selecting moves files.
 */
it('leaves an asset in a sibling folder differing only in case untouched', async () => {
	const files = [noteAt('Renovation/Library/Assets/Tiles.md'), noteAt('Renovation/library/Assets/Paint.md')];
	const persistence = stackOver([
		entry('a1', 'renovation-asset', 'Renovation/Library/Assets/Tiles.md'),
		entry('a2', 'renovation-asset', 'Renovation/library/Assets/Paint.md'),
	]);
	// The source resolves EXACTLY here, so the spelling guard does not fire and the question
	// is purely what the enumeration selects.
	const rig = harness({
		catalogueNotes: (from) => catalogueNotesIn(persistence, files, from),
		vaultFolders: () => [SOURCE, 'Renovation/library'],
	});

	const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

	expect(isOk(result)).toBe(true);
	expect(rig.renamed).toEqual([
		{ from: 'Renovation/Library/Assets/Tiles.md', to: 'Shared/Catalogue/Assets/Tiles.md' },
	]);
});

/**
 * ADR-0014 puts an asset's geometry under `<libraryFolder>/Geometry/`, so the sidecars move
 * with the catalogue or the setting strands them — and it strands them SILENTLY, because
 * `AssetGeometryStore` reads an absent sidecar as a shapeless asset rather than as an error.
 * That is why these two cases exist and why the second one is the important one.
 */
describe('the library move takes asset geometry with it', () => {
	const ASSET_ID = 'asset-01JABC';
	const sidecarUnder = (folder: string): TFile => noteAt(assetSidecarPathFor(folder, ASSET_ID));

	it('renames each sidecar to exactly where the store will look for it', async () => {
		const rig = harness({ geometrySidecars: (from) => [sidecarUnder(from)] });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isOk(result)).toBe(true);
		// Asserted against `assetSidecarPathFor(DESTINATION, …)` rather than against a
		// hand-spelled string: the claim is not "it moved somewhere under the destination",
		// it is that the migration and the store agree about one path. A literal here would
		// go on passing if the store's own derivation changed underneath it.
		expect(rig.renamed.at(-1)).toEqual({
			from: assetSidecarPathFor(SOURCE, ASSET_ID),
			to: assetSidecarPathFor(DESTINATION, ASSET_ID),
		});
		expect(rig.order).toEqual(['rebuild', 'move', 'move', 'move', 'rebuild', 'persist']);
	});

	/**
	 * Persist LAST, or not at all. Without this the setting lands, the store resolves under
	 * the new folder, and every designed shape reads as `shape: null` while the files sit
	 * orphaned under the old path with nothing reporting anything. The recoverable state is
	 * the one where `data.json` still names the folder the sidecars are actually in.
	 */
	it('does not persist the new folder when moving a sidecar fails', async () => {
		const renamedTo: string[] = [];
		const rig = harness({
			geometrySidecars: (from) => [sidecarUnder(from)],
			renameFile: (file, to) => {
				if (file.path.endsWith('.rpgeo')) return Promise.reject(new Error('locked'));
				renamedTo.push(to);
				return Promise.resolve();
			},
		});

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isErr(result) && result.error.code).toBe('settings.library-move-failed');
		expect(rig.persistedFolder()).toBeUndefined();
		// The notes really did move first, so this is a PARTIAL move being refused rather
		// than a migration that never started — which is the case the assertion above would
		// otherwise pass for either way.
		expect(renamedTo).toHaveLength(2);
	});
});

/**
 * WHICH `.rpgeo` FILES ARE THE LIBRARY'S. Deliberately not "every `.rpgeo` under the
 * source", which is the prefix premise `catalogueNotesIn`'s own docblock records four
 * findings against: §83 grants a project filed inside the library, and that project's plan
 * sidecars live at `<library>/<project>/Geometry/plan-x.rpgeo`. Moving those would take a
 * project's geometry with a catalogue it has nothing to do with, and leave every plan on it
 * unresolvable.
 *
 * The rule is therefore DIRECT CHILDREN of the library's own `Geometry/`, which is exactly
 * the set ADR-0014's layout defines — no deeper, so no nested project folder can be reached,
 * and `.rpgeo` only, so a file a user dropped in that folder is left alone.
 */
describe('libraryGeometryIn', () => {
	it('takes the library\'s own sidecars and not a nested project\'s', () => {
		const files = [
			noteAt('Renovation/Library/Geometry/asset-01JABC.rpgeo'),
			noteAt('Renovation/Library/Kitchen/Geometry/plan-01JXYZ.rpgeo'),
			noteAt('Renovation/Library/Geometry/Archive/asset-01JOLD.rpgeo'),
		];

		expect(libraryGeometryIn(files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Geometry/asset-01JABC.rpgeo',
		]);
	});

	it('takes only .rpgeo files, so a note filed in that folder is left where it is', () => {
		const files = [
			noteAt('Renovation/Library/Geometry/asset-01JABC.rpgeo'),
			noteAt('Renovation/Library/Geometry/README.md'),
		];

		expect(libraryGeometryIn(files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Geometry/asset-01JABC.rpgeo',
		]);
	});

	/** The prefix trap `catalogueNotesIn` already carries: a segment boundary, not a string one. */
	it('does not reach a folder that merely starts with the library\'s name', () => {
		const files = [noteAt('Renovation/LibraryOld/Geometry/asset-01JABC.rpgeo')];

		expect(libraryGeometryIn(files, SOURCE)).toEqual([]);
	});
});

describe('catalogueNotesIn', () => {
	/**
	 * Every file here is an indexed ASSET, so the index half admits all three and only the
	 * source intersection separates them — which is what keeps the segment boundary a
	 * property of this function rather than an accident of the fixture. The prefix trap:
	 * `Renovation/LibraryOld` is not inside `Renovation/Library`.
	 */
	it('takes the files under the folder, at the segment boundary', () => {
		const files = [
			noteAt('Renovation/Library/Assets/Tiles.md'),
			noteAt('Renovation/Library.md'),
			noteAt('Renovation/LibraryOld/Assets/Paint.md'),
		];
		const persistence = stackOver(files.map((file, index) => entry(`a${index}`, 'renovation-asset', file.path)));

		expect(catalogueNotesIn(persistence, files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Assets/Tiles.md',
		]);
	});

	/**
	 * CASE-SENSITIVE, deliberately, and the opposite of what `foldersOverlap` does three
	 * imports away. Obsidian's paths are case-sensitive and a Linux vault really can hold
	 * both spellings, so folding here would relocate an asset filed in the other one.
	 */
	it('takes them case-sensitively', () => {
		const files = [
			noteAt('Renovation/Library/Assets/Tiles.md'),
			noteAt('Renovation/library/Assets/Paint.md'),
		];
		const persistence = stackOver(files.map((file, index) => entry(`a${index}`, 'renovation-asset', file.path)));

		expect(catalogueNotesIn(persistence, files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Assets/Tiles.md',
		]);
	});

	/**
	 * A file under the library that the index does not know as an asset is not the catalogue,
	 * whatever it is — a project note, a zone, a geometry sidecar, or a note the user simply
	 * filed there. This is the half that makes the §83 violation dissolve instead of needing
	 * a refusal.
	 */
	it('takes only what the index knows as an asset', () => {
		const files = [
			noteAt('Renovation/Library/Assets/Tiles.md'),
			noteAt('Renovation/Library/Kitchen/Project.md'),
			noteAt('Renovation/Library/Notes.md'),
		];
		const persistence = stackOver([
			entry('a1', 'renovation-asset', 'Renovation/Library/Assets/Tiles.md'),
			entry('p1', 'renovation-project', 'Renovation/Library/Kitchen/Project.md'),
		]);

		expect(catalogueNotesIn(persistence, files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Assets/Tiles.md',
		]);
	});

	/**
	 * With settings unrecovered there is no persistence stack and therefore no index to ask.
	 * The same arm `projectFolderPaths` carries, asked here rather than spelled as an `?.` at
	 * the one call site — and unreachable from the pane, which declares no action row in that
	 * state.
	 */
	it('answers nothing when there is no index to ask', () => {
		expect(catalogueNotesIn(null, [noteAt('Renovation/Library/Assets/Tiles.md')], SOURCE)).toEqual([]);
	});
});
