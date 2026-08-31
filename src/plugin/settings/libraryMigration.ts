import type { TFile } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import type { Logger } from '../../application/ports/Logger';
import type { ProjectIndex } from '../../application/ports/ProjectIndex';
import { foldersOverlap } from '../../infrastructure/obsidian/repositories/foldersOverlap';
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
	/**
	 * Every folder the vault holds, by path. Asked about the SOURCE and only the source, and
	 * asked for the LIST rather than for a yes/no because the question is not "is it there"
	 * — see the source guard, which has to tell a missing folder from a misspelt one, and
	 * cannot do that from a predicate that has already collapsed the two.
	 */
	vaultFolders(): readonly string[];
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
 * Refresh, validate, move, rebuild, and persist LAST.
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
 *
 * **The late-arrival window is smaller than it looks, and the honest name for it is not "a
 * split catalogue".** `catalogueNotes(source)` is read once, before step 4's awaited rename
 * loop, so an asset note created or dragged into the source WHILE that loop runs is not
 * moved. What it is NOT is a catalogue in two halves: since design slice 18 the index is
 * bounded by what a note DECLARES rather than by where it sits, and
 * `ObsidianAssetRepository.listAll` reads the TYPE axis (`getIdsByType('renovation-asset')`)
 * rather than a folder — so that note stays discoverable, readable and updatable, and an
 * update writes where the note already sits. The whole outcome is one asset filed outside
 * the library, which is exactly the state Task 5's open question 3 already declares legal
 * for an asset the user filed there deliberately. Only INSERTS go to the library folder.
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

	// 0. Refresh the index before ANY question is asked of it, because both of the questions
	// below are asked of it and a stale answer to either moves files.
	//
	// `RenovationPlannerPlugin` filters every vault event to `TFile`, so the `TFolder`
	// Obsidian reports for a folder rename is dropped and the index keeps each DESCENDANT
	// note at its old path until the next full rebuild. That filter is pre-existing and
	// global — every index consumer inherits it — and this step does not close it. What it
	// closes is the two places THIS function would otherwise act on the stale answer:
	//
	// - `catalogueNotes(source)` intersects index paths with live `TFile` paths, so a
	//   descendant of a renamed folder matches NEITHER and is silently omitted. The
	//   migration then moves the rest, rebuilds, and persists the destination as a success:
	//   a move that relocates too FEW notes raises nothing, which is the hazard
	//   `catalogueNotesIn`'s own docblock names for a different cause.
	// - `projectFolders()` derives each project's folder from where its note sits
	//   (ADR-0013), through the same index — so step 3's §83 overlap check would be
	//   adjudicating against folders that have moved, and could permit a destination that
	//   really does overlap a project folder.
	//
	// It is a second full scan on a rare, user-initiated, explicitly-confirmed operation,
	// which is the cheapest possible price for both. It gets its OWN code rather than
	// sharing step 5's: that sentence opens "The catalogue moved to …", and nothing has
	// moved here — the remedy differs too, since a retry is exactly what may work.
	try {
		deps.rebuildIndex();
	} catch (cause) {
		deps.logger.error('settings.library-refresh-failed', { source, destination, cause });
		return err({
			category: 'Persistence',
			code: 'settings.library-refresh-failed',
			message: `The project index could not be refreshed, so nothing was moved and the setting was not changed.`,
			cause,
		});
	}

	// 1. A source the vault does not hold at the SPELLING the setting names, while holding a
	// folder that differs from it only in case.
	//
	// That conjunction is the whole guard, and each half alone is the wrong rule. The
	// enumeration below matches paths exactly (see `catalogueNotesIn` for why it must not
	// fold), so a misspelt source selects NOTHING: the migration would move no notes, raise
	// no failure, and persist the destination as though it had worked, leaving the catalogue
	// at a path no setting names any more. That is the one arm here that could report success
	// having done nothing.
	//
	// But "the folder is not there" is true of TWO states and cannot separate them:
	//
	//   (a) it genuinely does not exist — a fresh vault, where the default library folder is
	//       created LAZILY by the asset repository on the first insert. There is nothing to
	//       move and nothing that could be stranded, so persisting the new location is
	//       correct; refusing here would break the ordinary first thing a user does, which is
	//       choose a library folder before creating any assets.
	//   (b) it does not exist at the configured spelling while a CASE-VARIANT of it does —
	//       the dangerous one, because the notes are then somewhere the exact enumeration
	//       will not look.
	//
	// The variant test is what discriminates them, and it is a full-path fold rather than a
	// segment comparison so that a difference in any segment counts. It needs no `!==` guard
	// against matching the source itself: it is only reached when no folder equals the source
	// exactly, so a folded match is necessarily a different spelling. Obsidian's own paths
	// are already normalised, which is why only the source passes through `normalizeFolder`.
	const folders = deps.vaultFolders();
	if (!folders.includes(source) && folders.some((folder) => folder.toLowerCase() === source.toLowerCase())) {
		return err({
			category: 'Validation',
			code: 'settings.library-source-case-mismatch',
			message: `The library folder ${source} is not in the vault, though a folder differing only in case is.`,
		});
	}

	// 2. Validate against the SOURCE, before any project folder, because this is the one
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

	// 3. Validate against EVERY project folder, in both directions (§83): a project folder
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

	// 4. Move, so the vault's links survive.
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

	// 5. Rebuild from the new roots, and 6. persist ONLY now.
	//
	// The rebuild READS — `buildProjectIndexEntries` walks the vault and the metadata cache —
	// so it can throw, and it runs at the point where every note has already moved. Left
	// uncaught it was the one arm of this function that REJECTED instead of resolving its
	// declared `Result`: the caller went down the generic detached-fault path, which says
	// nothing a user could act on, while the durable setting still named the source.
	//
	// Its own code rather than the persist one below, because neither half of that sentence is
	// true here — nothing was attempted, so "the setting could not be saved" describes the
	// wrong event, and the remedy is different: the session's index is the thing that is
	// behind, so it has to catch up with the vault before pointing the setting anywhere.
	try {
		deps.rebuildIndex();
	} catch (cause) {
		deps.logger.error('settings.library-rebuild-failed', { destination, cause });
		return err({
			category: 'Persistence',
			code: 'settings.library-rebuild-failed',
			message: `The catalogue moved to ${destination} but the project index could not be rebuilt.`,
			cause,
		});
	}

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
 *
 * `parentOf(entry.path)` rather than `paths.projectFolderOf`, which spells that same
 * derivation for ONE id. Reaching it from here means `getPath` per id, which is the
 * pairwise form `catalogueNotesIn` below argues against — and its reason applies
 * identically: it adds an `undefined` arm no honest fixture can drive, because both
 * answers come from the one entry list, in which an id always has a path. A shared
 * one-line derivation is not worth a branch nothing can reach.
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
 * WHICH NOTES ARE THE CATALOGUE — asked of the Project Index, then intersected with the
 * source folder.
 *
 * It used to ask "every file under the library folder", and that premise produced four
 * separate findings before it was replaced: a destination nested inside the source that got
 * re-enumerated on a retry, a case-variant missed so the migration reported success having
 * moved nothing, a case-variant swept so unrelated files were relocated, and finally a whole
 * PROJECT swept — §83 forbids a project folder inside the library and Tasks 8 and 9 exist to
 * MARK that state, so a project at `Renovation/Library/Kitchen` is a state this slice already
 * grants, and moving the library took its note, its zones and its geometry sidecar to
 * `Shared/Kitchen`. Four fixes each refined the prefix match; the prefix match was the wrong
 * question. A fix that keeps needing another fix is answering the wrong one.
 *
 * BOTH halves are load-bearing, and neither is a tidying of the other:
 *
 * - **The index half** is what makes a project note not a catalogue note. SDD §47 makes the
 *   index the single answer to "where is entity X", and every other read in this plugin
 *   already resolves through it, so this stops being a second mechanism for finding notes.
 *   The §83 violation then DISSOLVES rather than being refused: the project stays where it
 *   is, only the catalogue moves, and the user is asked for nothing.
 *
 *   **`'renovation-asset'` IS the definition of the catalogue, and it is a literal, so it does
 *   not grow on its own.** The comment above about `Suppliers/` and `Trades/` beside `Assets/`
 *   is this migration's own anticipation of more library-resident kinds — and the day one is
 *   added to `ENTITY_TYPES`, its notes are silently left behind by every library move with
 *   nothing failing anywhere, because a move that relocates too FEW notes raises nothing. So:
 *   whoever adds a library-resident entity type owes this line, in the same edit.
 * - **The source intersection** preserves Task 5's documented behaviour that an asset filed
 *   outside the library is NOT relocated — updates write where the note already sits, and
 *   only inserts go to the library (its open question 3). Enumerating by type alone would
 *   change that silently.
 *
 * The intersection is at the SEGMENT boundary and CASE-SENSITIVE, so `Renovation/LibraryOld`
 * is not read as part of `Renovation/Library` and an asset under a case-variant folder counts
 * as filed outside the library, which is what Task 5's rule says it is. `foldersOverlap`
 * folds and this does not, deliberately: for a GUARD over-refusing is the safe direction,
 * while for an ENUMERATION over-selecting MOVES FILES. Two predicates that look alike are not
 * automatically duplication.
 *
 * Read through `entries()` rather than `getIdsByType` + `getPath` per id, which is the same
 * authority answering the same question — and it is the sibling `projectFolderPaths` above
 * already spells. The pairwise form would add a `getPath` returned `undefined` arm that no
 * honest fixture can drive: both answers derive from one entry list, so an id from
 * `getIdsByType` always has a path, and a fake that produced one would be a fake modelling a
 * state the real index cannot be in.
 *
 * Takes the persistence stack rather than the index for the reason `projectFolderPaths`
 * states: a session with settings unrecovered composes no persistence at all, so the arm is
 * asked HERE instead of being spelled as an `?.` at the call site.
 */
export function catalogueNotesIn(
	persistence: { index: ProjectIndex } | null,
	files: readonly TFile[],
	folder: string,
): TFile[] {
	if (persistence === null) return [];
	const catalogue = new Set(
		persistence.index
			.entries()
			.filter((entry) => entry.type === 'renovation-asset')
			.map((entry) => entry.path),
	);
	const root = `${normalizeFolder(folder)}/`;
	return files.filter((file) => catalogue.has(file.path) && file.path.startsWith(root));
}
