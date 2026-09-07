import { describe, expect, it } from 'vitest';
import type { TFile } from 'obsidian';
import type { EntityId } from '../../../src/core/identity/EntityId';
import type { ProjectIndex, ProjectIndexEntry } from '../../../src/application/ports/ProjectIndex';
import { catalogueNotesIn } from '../../../src/plugin/settings/libraryMigration';
const SOURCE = 'Renovation/Library';
const noteAt = (path: string): TFile => ({ path }) as unknown as TFile;

const entry = (id: string, type: ProjectIndexEntry['type'], path: string): ProjectIndexEntry => ({
	id: id as EntityId<string>,
	type,
	path,
});

const stackOver = (entries: readonly ProjectIndexEntry[]): { index: ProjectIndex } => ({
	index: { entries: () => entries } as unknown as ProjectIndex,
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
