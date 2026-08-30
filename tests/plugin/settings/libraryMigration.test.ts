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

	it('leaves data.json untouched when a move fails', async () => {
		const rig = harness({ renameFile: () => Promise.reject(new Error('locked')) });

		const result = await migrateLibraryFolder(rig.deps, SOURCE, DESTINATION);

		expect(isErr(result) && result.error.code).toBe('settings.library-move-failed');
		expect(rig.persistedFolder()).toBeUndefined();
		// Not merely "no persist": the rebuild is downstream of the move too, so a partial
		// move must not re-point the index at a folder half the catalogue never reached.
		expect(rig.order).not.toContain('rebuild');
		expect(rig.logged.map((line) => line.event)).toEqual(['settings.library-move-failed']);
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
		);

		// `Renovation` contains the project folder, so it goes too — the check refuses in
		// both directions, since either path can be the one that moves.
		expect(offered).toEqual(['Shared/Catalogue']);
	});
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
});
