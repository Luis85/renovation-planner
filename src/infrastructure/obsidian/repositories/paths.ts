import { normalizePath } from 'obsidian';
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

export function projectNotePathFor(projectFolder: string, name: string): string {
	return `${projectFolder}/${fileNameFor(name)}.md`;
}

export function planNotePathFor(projectFolder: string, name: string): string {
	return `${plansFolderFor(projectFolder)}/${fileNameFor(name)}.md`;
}
