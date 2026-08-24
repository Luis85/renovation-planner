import type { MetadataCache, TFile, Vault } from 'obsidian';
import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { ENTITY_TYPES, type EntityType, type ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { Logger } from '../../../application/ports/Logger';
import { GEOMETRY_FOLDER, normalizeFolder } from '../../obsidian/repositories/paths';
import { frontmatterOf } from '../../obsidian/repositories/noteIo';
import type { EchoWindow } from './EchoWindow';

function listSidecars(vault: Vault, geometryPrefix: string): TFile[] {
	return vault
		.getFiles()
		.filter((file) => file.path.startsWith(geometryPrefix) && file.path.endsWith('.rpgeo'));
}

/**
 * A frontmatter value usable as an id reference: a non-empty string, or nothing.
 * Exported because the vault-change pipeline asks the same question of the same keys —
 * one answer, so the full scan and the incremental run cannot disagree about a note.
 */
export function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

/** What both passes need: the vault surface, the diagnostics sink, and the echo window. */
interface ScanInput {
	vault: Vault;
	metadataCache: MetadataCache;
	echo: EchoWindow;
	logger: Logger;
	projectFolder: string;
}

/**
 * Two notes CAN carry one id — Obsidian's own "Duplicate file" command produces exactly
 * that, and so does a sync conflict copy. The index is keyed by id, so one of them is
 * unreachable no matter what; last-writer-wins is kept deliberately, because changing it
 * would make which note wins depend on scan order — arbitrary AND invisible instead of
 * merely arbitrary. What was missing is the diagnostic: without it the losing note simply
 * never opens and nothing says why.
 */
function warnOnDuplicate(logger: Logger, previous: ProjectIndexEntry | undefined, id: string, path: string): void {
	if (!previous || previous.path === path) return;
	logger.warn('persistence.index.duplicate-id', {
		id,
		path,
		otherPath: previous.path,
		reason: 'two notes declare this id; only the last one scanned is reachable',
	});
}

/** Pass one: every note of ours under the project folder, keyed by its declared id. */
function collectNotes(input: ScanInput, folder: string, entries: Map<string, ProjectIndexEntry>): void {
	for (const file of input.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		// Through `frontmatterOf`, so a note whose cache entry Obsidian has not produced yet
		// is still scanned from what this plugin last wrote there. At `onLayoutReady` the
		// echo is empty and this is exactly the cache read it always was; it earns its keep
		// on the RE-scan `saveSettings` triggers mid-session, where notes written moments
		// ago would otherwise be dropped from the index they had just been added to.
		const frontmatter = frontmatterOf(input, file);
		if (Object.keys(frontmatter).length === 0) continue;

		const type = frontmatter['type'];
		if (typeof type !== 'string' || !ENTITY_TYPES.includes(type as EntityType)) continue;

		const id = frontmatter['id'];
		if (typeof id !== 'string' || !id) {
			input.logger.warn('persistence.index.note-excluded', {
				path: file.path,
				reason: 'a note of this plugin must declare a non-empty id',
			});
			continue;
		}

		warnOnDuplicate(input.logger, entries.get(id), id, file.path);
		entries.set(id, {
			id: id as EntityId<string>,
			type: type as EntityType,
			path: file.path,
			projectId: stringField(frontmatter['project']) as ProjectId | undefined,
			planId: stringField(frontmatter['plan']) as PlanId | undefined,
		});
		input.echo.markFrontmatter(file.path, frontmatter);
	}
}

/** Pass two: join each sidecar to its Plan entry by filename (see the header on why). */
function joinSidecars(input: ScanInput, geometryPrefix: string, entries: Map<string, ProjectIndexEntry>): void {
	for (const file of listSidecars(input.vault, geometryPrefix)) {
		const planId = file.basename;
		const planEntry = entries.get(planId);
		if (!planEntry || planEntry.type !== 'renovation-plan') {
			input.logger.warn('persistence.index.sidecar-skipped', {
				path: file.path,
				reason: 'no indexed plan carries this id',
			});
			continue;
		}
		entries.set(planId, { ...planEntry, geometrySidecarPath: file.path });
	}
}

/**
 * The full scan that populates the Project Index (SDD §47). Runs from
 * `onLayoutReady` — NOT `onload`: a vault-wide scan there competes with workspace
 * restoration on the main thread, and `MetadataCache` is incomplete until layout-ready,
 * so an earlier scan would build a partial index that looks complete.
 *
 * Notes are read through `MetadataCache`, never by parsing files; sidecars are joined to
 * their Plan entries by FILENAME — the fast path — because reading and schema-parsing
 * every `.rpgeo` would be hundreds of whole-file reads at the one moment startup is
 * most expensive. The filename join is VERIFIED later, on the first read of that
 * sidecar (`PlanGeometryStore.read` compares the document's own `planId`). A file whose
 * name is not a plan ID is skipped with a diagnostic rather than guessed at.
 *
 * Two named passes rather than one body: the sidecar join can only run once every note
 * entry exists, so the ORDER here is the contract, and it is worth being able to read.
 */
export function buildProjectIndexEntries(input: ScanInput): ProjectIndexEntry[] {
	const folder = normalizeFolder(input.projectFolder);
	const entries = new Map<string, ProjectIndexEntry>();

	collectNotes(input, folder, entries);
	joinSidecars(input, `${folder}/${GEOMETRY_FOLDER}/`, entries);

	return [...entries.values()];
}
