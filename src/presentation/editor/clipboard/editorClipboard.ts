import { shallowRef, type ShallowRef } from 'vue';
import type { SpatialClipboard } from '../../../domain/spatial/clipboard';

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
