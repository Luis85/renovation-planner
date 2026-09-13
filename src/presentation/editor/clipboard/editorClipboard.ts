import { shallowRef, type ShallowRef } from 'vue';
import type { SpatialClipboard } from '../../../domain/spatial/clipboard';

/** The geometry payload a successful Paste actually places; renovation records are never part of it. */
export interface ClipboardSummary {
	readonly rooms: number;
	readonly walls: number;
	readonly doors: number;
	readonly windows: number;
	readonly openings: number;
	readonly elements: number;
}

/**
 * Count the captured payload, not a selection or a rendered list: the copied Room can bring
 * dependent walls/openings and an opening can bring its host. This keeps Paste feedback truthful
 * when the source selection is not the final clipboard scope.
 */
export function clipboardSummary(clipboard: SpatialClipboard): ClipboardSummary {
	const { openings } = clipboard.structure;
	return {
		rooms: clipboard.rooms.length,
		walls: clipboard.structure.walls.length,
		doors: openings.filter(item => item.kind === 'door').length,
		windows: openings.filter(item => item.kind === 'window').length,
		openings: openings.filter(item => item.kind === 'opening').length,
		elements: clipboard.structure.elements.length,
	};
}

/**
 * What Copy last took, shared by every Plan Editor leaf (design spec §3). Each leaf mounts its
 * own Vue app and Pinia, so this cannot be a store: the plugin makes ONE and hands it to every
 * leaf through `PlanEditorDeps`. A ref rather than a plain holder because Vue's reactivity is not
 * scoped to an app — a Copy in one leaf re-evaluates the Paste item of another leaf's menu.
 * Held in memory only, so an Obsidian reload empties it.
 */
export type EditorClipboard = ShallowRef<SpatialClipboard | null>;

export function createEditorClipboard(): EditorClipboard {
	return shallowRef(null);
}
