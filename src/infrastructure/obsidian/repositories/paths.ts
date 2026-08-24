import { normalizePath, type Vault } from 'obsidian';
import type { PlanId } from '../../../domain/plan/PlanId';

/**
 * Where entities live inside the vault. The project folder is THE one location setting
 * (ADR-011); every other path is derived here — and only here — from it.
 *
 * Deriving a SIDECAR path at read time is forbidden (ADR-011): reads resolve through the
 * Project Index. This module's sidecar function has exactly two callers, both legitimate:
 * the Plan insert path (which creates the file and is therefore the only code alive at
 * the moment the mapping can first exist) and nothing else. Reads never import it.
 */

export const GEOMETRY_FOLDER = 'Geometry';

const PLANS_FOLDER = 'Plans';
const ZONES_FOLDER = 'Zones';

/** The user-editable setting passes through `normalizePath` before any Vault call. */
export function normalizeFolder(raw: string): string {
	return normalizePath(raw.trim());
}

/**
 * The folder a path sits in — what a compensating `create` has to `ensureFolder` first.
 * Here rather than in either repository: the Plan and Zone restore paths both need it,
 * and this module is the one place a path is taken apart or put together.
 */
export function parentOf(path: string): string {
	// slice(0, 0) when there is no slash — no branch needed for rootless paths.
	return path.slice(0, Math.max(path.lastIndexOf('/'), 0));
}

function geometryFolderFor(projectFolder: string): string {
	return `${projectFolder}/${GEOMETRY_FOLDER}`;
}

export function plansFolderFor(projectFolder: string): string {
	return `${projectFolder}/${PLANS_FOLDER}`;
}

export function zonesFolderFor(projectFolder: string): string {
	return `${projectFolder}/${ZONES_FOLDER}`;
}

export function sidecarPathFor(projectFolder: string, planId: PlanId | string): string {
	return `${geometryFolderFor(projectFolder)}/${String(planId)}.rpgeo`;
}

/**
 * Human-chosen filename derived from the entity's name at creation time
 * ("deduplicated on collision" is the caller's job: it knows what already exists, and
 * appends the entity ID when the plain name is taken). Filename is NEVER identity (§83):
 * reads resolve through the index, and this only names what a write creates.
 *
 * Obsidian-forbidden characters (`\ / : * ? " < > | # ^ [ ]`) go first; what remains is
 * trimmed of edge dots and spaces, which Windows and the app both dislike.
 */
export function fileNameFor(name: string): string {
	const clean = name
		.replace(/[/\\:*?"<>|#^[\]]/g, '')
		.replace(/^[\s.]+|[\s.]+$/g, '')
		.slice(0, 80)
		.replace(/[\s.]+$/g, '');
	return clean || 'untitled';
}

/**
 * The path an INSERT creates its note at: the name-derived filename, or that name plus the
 * entity id when a file already sits there.
 *
 * This is the "deduplicated on collision" half the comment above hands to the caller, and
 * all three repositories are that caller — so it lives here once rather than as a private
 * copy per repository. Two of them had no copy at all and simply built the plain path,
 * which makes `vault.create` reject on any second entity named like the first: two Plans
 * both called "Ground floor" is a thing a user does on purpose, and the second one refused
 * to save with a write failure that named no cause a user could act on.
 *
 * The id suffix is not a uniqueness LOOP — one collision check, then a name carrying an id
 * that is unique by construction. Filename is never identity (§83), so this only has to
 * produce a free path, not a predictable one.
 */
export function freshNotePath(vault: Vault, folder: string, name: string, id: string): string {
	const base = `${folder}/${fileNameFor(name)}`;
	return vault.getAbstractFileByPath(`${base}.md`) ? `${base} ${id}.md` : `${base}.md`;
}
