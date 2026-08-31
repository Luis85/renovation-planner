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
	libraryDestinations,
	migrateLibraryFolder,
	projectFolderPaths,
	type LibraryMigrationDeps,
} from '../../../src/plugin/settings/libraryMigration';
import { isErr, isOk } from '../../../src/core/result/Result';
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
		folderExists: (path) => path === SOURCE,
		catalogueNotes: (from) => [noteAt(`${from}/Assets/Tiles.md`), noteAt(`${from}/Assets/Paint.md`)],
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
		expect(rig.order).toEqual(['move', 'move', 'rebuild', 'persist']);
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
		// Not merely "no persist": the rebuild is downstream of the move too, so a partial
		// move must not re-point the index at a folder half the catalogue never reached.
		expect(rig.order).not.toContain('rebuild');
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
	 * The last failure point, and the only one where the notes have already moved. It gets
	 * its own code because its recovery differs from every other arm: re-running the
	 * migration would move nothing, since the notes are already there.
	 */
	it('reports a distinct outcome when persisting fails after the move', async () => {
		const rig = harness({ persist: () => Promise.reject(new Error('data.json is read-only')) });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		// It RESOLVES a failed Result rather than rejecting — the declared contract.
		expect(isErr(result) && result.error.code).toBe('settings.library-persist-failed');
		expect(rig.order).toEqual(['move', 'move', 'rebuild']);
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
 * A source that does not resolve to a folder in the vault — a case-only external rename on a
 * case-SENSITIVE filesystem, or a hand-edited `data.json`.
 *
 * The enumeration is exact, so such a source selects nothing. Without this refusal that is
 * the worst shape any arm of this migration has: zero notes moved, no failure reported, and
 * the destination persisted as though the move had succeeded — the catalogue left behind
 * while every future asset is written to the new root, and the user told it worked.
 *
 * The remedy is a REFUSAL rather than a wider match. Widening the enumeration to fold case
 * was tried and is wrong in the destructive direction: see the sibling case below.
 */
it('refuses when the configured source is not a folder in the vault, and moves nothing', async () => {
	const files = [noteAt('Renovation/Library/Assets/Tiles.md')];
	const rig = harness({
		catalogueNotes: (from) => catalogueNotesIn(files, from),
		folderExists: (path) => path === 'Renovation/Library',
	});

	const result = await migrateLibraryFolder(rig.deps, 'renovation/library', DESTINATION);

	expect(isErr(result) && result.error.code).toBe('settings.library-source-missing');
	expect(rig.renamed).toEqual([]);
	expect(rig.persistedFolder()).toBeUndefined();
});

/**
 * The reason the enumeration must NOT fold case, and why this is the opposite trade from
 * `foldersOverlap`'s.
 *
 * For the PREDICATE, over-refusing is the safe direction: it costs a user one rename, while
 * under-refusing costs every project's catalogue. For the ENUMERATION the asymmetry
 * REVERSES — over-selecting MOVES UNRELATED FILES, which is destructive, while
 * under-selecting merely finds nothing, which the refusal above now reports. A case-sensitive
 * Linux vault can hold `Renovation/Library` and `Renovation/library` as two real folders, and
 * a folded match relocates the second one's notes into the destination.
 */
it('leaves a sibling folder differing only in case untouched', async () => {
	const files = [noteAt('Renovation/Library/Assets/Tiles.md'), noteAt('Renovation/library/Assets/Paint.md')];
	const rig = harness({ catalogueNotes: (from) => catalogueNotesIn(files, from) });

	const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

	expect(isOk(result)).toBe(true);
	expect(rig.renamed).toEqual([
		{ from: 'Renovation/Library/Assets/Tiles.md', to: 'Shared/Catalogue/Assets/Tiles.md' },
	]);
});

describe('catalogueNotesIn', () => {
	it('takes the files under the folder, at the segment boundary', () => {
		const files = [
			noteAt('Renovation/Library/Assets/Tiles.md'),
			noteAt('Renovation/Library.md'),
			// The prefix trap: `Renovation/LibraryOld` is not inside `Renovation/Library`.
			noteAt('Renovation/LibraryOld/Assets/Paint.md'),
		];

		expect(catalogueNotesIn(files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Assets/Tiles.md',
		]);
	});

	/**
	 * CASE-SENSITIVE, deliberately, and the opposite of what `foldersOverlap` does three
	 * imports away. Obsidian's paths are case-sensitive and a Linux vault really can hold
	 * both spellings, so folding here would take the other folder's notes with it.
	 */
	it('takes them case-sensitively', () => {
		const files = [
			noteAt('Renovation/Library/Assets/Tiles.md'),
			noteAt('Renovation/library/Assets/Paint.md'),
		];

		expect(catalogueNotesIn(files, SOURCE).map((file) => file.path)).toEqual([
			'Renovation/Library/Assets/Tiles.md',
		]);
	});
});
