import type { MetadataCache, TFile, Vault } from 'obsidian';
import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityType, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { Logger } from '../../../application/ports/Logger';
import { GEOMETRY_FOLDER, normalizeFolder } from '../../obsidian/repositories/paths';
import type { EchoWindow } from './EchoWindow';

const OUR_NOTE_TYPES: readonly string[] = ['renovation-project', 'renovation-plan', 'renovation-zone'];

function listSidecars(vault: Vault, geometryPrefix: string): TFile[] {
	return vault
		.getFiles()
		.filter((file) => file.path.startsWith(geometryPrefix) && file.path.endsWith('.rpgeo'));
}

function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
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
 */
export function buildProjectIndexEntries(input: {
	vault: Vault;
	metadataCache: MetadataCache;
	echo: EchoWindow;
	logger: Logger;
	projectFolder: string;
}): ProjectIndexEntry[] {
	const folder = normalizeFolder(input.projectFolder);
	const geometryPrefix = `${folder}/${GEOMETRY_FOLDER}/`;
	const entries = new Map<string, ProjectIndexEntry>();

	for (const file of input.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		const frontmatter = input.metadataCache.getFileCache(file)?.frontmatter;
		if (!frontmatter) continue;

		const type = frontmatter['type'];
		if (typeof type !== 'string' || !OUR_NOTE_TYPES.includes(type)) continue;

		const id = frontmatter['id'];
		if (typeof id !== 'string' || !id) {
			input.logger.warn('persistence.index.note-excluded', {
				path: file.path,
				reason: 'a note of this plugin must declare a non-empty id',
			});
			continue;
		}

		entries.set(id, {
			id: id as EntityId<string>,
			type: type as EntityType,
			path: file.path,
			projectId: stringField(frontmatter['project']) as ProjectId | undefined,
			planId: stringField(frontmatter['plan']) as PlanId | undefined,
		});
		input.echo.markFrontmatter(file.path, frontmatter);
	}

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

	return [...entries.values()];
}
