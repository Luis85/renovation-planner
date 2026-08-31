import type { TFile } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import type { Logger } from '../../application/ports/Logger';
import type { ProjectIndex } from '../../application/ports/ProjectIndex';
import { folderContains, foldersOverlap } from '../../infrastructure/obsidian/repositories/foldersOverlap';
import { joinFolder, normalizeFolder, parentOf } from '../../infrastructure/obsidian/repositories/paths';

/**
 * Everything a `libraryFolder` change needs, and the reason it is a MIGRATION rather than
 * a preference (§83): the setting "moves the catalogues, rebuilds the index, and refuses
 * the new value until the move has succeeded".
 *
 * This module lives in `plugin/` because the settings pane is what reaches it, and it
 * therefore takes every vault operation as an INJECTED dep rather than calling `vault.*`
 * or `fileManager.*` itself — the write boundary keeps those calls in
 * `infrastructure/obsidian/`, and a migration that spelled them here would be the first
 * exception to a rule with no exceptions.
 */

export interface LibraryMigrationDeps {
	/** Every project's own folder, as ADR-0013 derives it: where its `Project.md` sits. */
	projectFolders(): readonly string[];
	catalogueNotes(from: string): readonly TFile[];
	ensureFolder(path: string): Promise<void>;
	/**
	 * A MOVE, never a create-and-delete: Obsidian rewrites the vault's links for a rename
	 * and knows nothing about a file that was copied and then trashed.
	 */
	renameFile(file: TFile, to: string): Promise<void>;
	rebuildIndex(): void;
	/**
	 * Writes `data.json` and swaps the composition root, IN THAT ORDER. Never
	 * `saveSettings` directly: that swaps first and writes second, so a rejecting write
	 * strands the session on a folder the file does not name.
	 */
	persist(libraryFolder: string): Promise<void>;
	logger: Logger;
}

/**
 * Validate, move, rebuild, and persist LAST.
 *
 * The order is the whole point — persisting first leaves every project resolving an empty
 * library while the notes sit at the old path, which is a catalogue split in two rather
 * than a preference briefly out of date.
 *
 * **Partial moves are not compensated**, identically to slice 18's migration and for the
 * same reason: a reverse move can fail the same way and leave no coherent shape. A
 * diagnostic names how many notes moved, the setting is not persisted, and this is the
 * documented cost rather than a bug — the notes that did move are still readable, and the
 * setting still names the folder the rest of them are in.
 */
export async function migrateLibraryFolder(
	deps: LibraryMigrationDeps,
	from: string,
	to: string,
): Promise<Result<void, AppError>> {
	// Asked of the RAW value rather than of the normalised one. Obsidian's `normalizePath`
	// answers `/` for an empty path where this suite's stand-in answers `''`, so a check on
	// its output would be true here and false in a vault — a fake kinder than the real thing
	// at exactly the guard that matters.
	if (to.trim() === '') {
		return err({ category: 'Validation', code: 'settings.library-folder-empty', message: 'A library folder cannot be empty.' });
	}
	const destination = normalizeFolder(to);
	const source = normalizeFolder(from);

	// 1. Validate against the SOURCE, before any project folder, because this is the one
	// overlap that makes the move itself incoherent rather than merely ill-placed.
	//
	// The nested direction is what the guard is for. `catalogueNotes` enumerates by path
	// prefix, so moving `Renovation/Library` into `Renovation/Library/New` leaves every note
	// still UNDER the source — and the setting is persisted LAST, so a persist failure is
	// followed by a retry that re-enumerates the notes it has just moved and sends
	// `New/Assets/Tiles.md` to `New/New/Assets/Tiles.md`. Should the persist then succeed,
	// the catalogue sits below the folder the setting names and no read resolves it.
	//
	// `foldersOverlap` is symmetric, so the two cheaper directions come free and are worth
	// having in their own right: the destination EQUAL to the source renames every note onto
	// itself, and a destination CONTAINING the source flattens the catalogue into a folder
	// whose own subtree it was just lifted out of.
	if (foldersOverlap(destination, source)) {
		return err({
			category: 'Validation',
			code: 'settings.library-overlaps-source',
			message: `The library folder ${destination} overlaps its current location ${source}.`,
		});
	}

	// 2. Validate against EVERY project folder, in both directions (§83): a project folder
	// holding the library would take every project's shared catalogues with it when the
	// project is deleted.
	for (const projectFolder of deps.projectFolders()) {
		if (foldersOverlap(destination, projectFolder)) {
			return err({
				category: 'Validation',
				code: 'settings.library-overlaps-project',
				message: `The library folder ${destination} overlaps project folder ${projectFolder}.`,
			});
		}
	}

	// 3. Move, so the vault's links survive.
	const moved: string[] = [];
	for (const note of deps.catalogueNotes(source)) {
		// The path RELATIVE to the old root, never `note.name`. A catalogue note lives at
		// `<library>/Assets/Tiles.md`, so its leaf name alone would flatten it to
		// `<destination>/Tiles.md` — losing the layout `assetsFolderFor(libraryFolder)`
		// expects, and colliding the moment `Suppliers/` and `Trades/` exist.
		const next = joinFolder(destination, note.path.slice(source.length + 1));
		try {
			await deps.ensureFolder(parentOf(next));
			await deps.renameFile(note, next);
			moved.push(next);
		} catch (cause) {
			deps.logger.error('settings.library-move-failed', { moved, cause });
			return err({
				category: 'Persistence',
				code: 'settings.library-move-failed',
				message: `Moved ${moved.length} note(s) before failing; the setting was not changed.`,
				cause,
			});
		}
	}

	// 4. Rebuild from the new roots, and 5. persist ONLY now.
	deps.rebuildIndex();
	try {
		await deps.persist(destination);
	} catch (cause) {
		// The one failure this function cannot make safe: every note has MOVED and the
		// durable setting still names the old folder, so a restart writes new catalogue
		// entries under the old location and splits the catalogue in two. Rejecting here
		// would also break this function's declared `Result` contract and send the caller
		// down the generic fault path, which says nothing a user could act on.
		//
		// It gets its own code because its recovery is its own: the notes are already at
		// the destination, so re-running the migration is NOT the remedy — setting the
		// library folder to where they now are is.
		deps.logger.error('settings.library-persist-failed', { destination, cause });
		return err({
			category: 'Persistence',
			code: 'settings.library-persist-failed',
			message: `The catalogue moved to ${destination} but the setting could not be saved.`,
			cause,
		});
	}
	return ok(undefined);
}

/**
 * Every project's folder, derived from where its own note sits (ADR-0013) and resolved
 * through the index, which is the single answer to "where is entity X" (SDD §47).
 *
 * It takes the persistence stack rather than the index, so the "there is no stack" arm is
 * asked HERE rather than spelled as an `?.` at the call site: a session with settings
 * unrecovered composes no persistence at all, and that arm is unreachable from the pane —
 * a tab with unrecovered settings declares one text-only row and no action — so a caller
 * that asked it would carry a branch nothing could ever drive. Answering "no project
 * folders" is the honest reading of having no index to ask.
 */
export function projectFolderPaths(persistence: { index: ProjectIndex } | null): string[] {
	if (persistence === null) return [];
	return persistence.index
		.entries()
		.filter((entry) => entry.type === 'renovation-project')
		.map((entry) => parentOf(entry.path));
}

/**
 * The folders the destination picker may offer: everything the vault holds, less anything
 * §83 would refuse.
 *
 * Filtering is a convenience and never the guard — a project folder can be dragged between
 * choosing a destination and applying it, so `migrateLibraryFolder` is what refuses. Both of
 * its overlap rules are applied here for the same reason: there is no point offering a
 * destination that is guaranteed to be refused, and dropping the SOURCE is what stops the
 * picker listing the folder the catalogue is already in.
 */
export function libraryDestinations(
	folders: readonly string[],
	projectFolders: readonly string[],
	source: string,
): string[] {
	return folders.filter(
		(folder) =>
			!foldersOverlap(folder, source) &&
			!projectFolders.some((projectFolder) => foldersOverlap(folder, projectFolder)),
	);
}

/**
 * The files under the library folder — at the SEGMENT boundary, never as a string prefix,
 * so `Renovation/LibraryOld` is not read as part of `Renovation/Library`.
 *
 * Through `folderContains`, which is the SAME predicate the guards above refuse with, and
 * that identity is the point rather than a saving. This filter spelled the rule out longhand
 * once and folded no case, while `foldersOverlap` folds it deliberately — so the two
 * disagreed about what "the same folder" means, and a source differing from the vault's own
 * paths only in case (a case-only external rename, or a hand-edited `data.json` on a Windows
 * or macOS vault, where two casings are one folder on disk) selected ZERO notes. The
 * migration then moved nothing, rebuilt, and persisted the destination as though it had
 * worked: the catalogue left at the old path, every future asset written to the new one, and
 * success reported. Every other arm of this migration at least refuses.
 */
export function catalogueNotesIn(files: readonly TFile[], folder: string): TFile[] {
	return files.filter((file) => folderContains(folder, file.path));
}
