import type { Structure } from '../../../domain/spatial/Structure';
import type { EditorRuntime } from '../runtime';

/** A multi-item Delete waits out a stale floor and any removal still reading its baseline. */
export function multiDeleteBlocked(runtime: Pick<EditorRuntime, 'writesBlocked' | 'structureActions' | 'elementActions'>): boolean {
	return runtime.writesBlocked.value || runtime.structureActions.active.value || runtime.elementActions.removeManyActive.value;
}

/**
 * The ONE multi-item Delete behind the context menu, the Delete key and the batch panel. Walls and
 * openings alone keep their structure command; a selection holding anything else — a Room, an Area,
 * an element — is one composite removal (`DeleteSelectionCommand`).
 */
export function deleteItems(runtime: Pick<EditorRuntime, 'structureActions' | 'elementActions'>, structure: Structure, ids: readonly string[]): Promise<void> {
	const structural = ids.every(id => structure.walls.some(item => item.id === id) || structure.openings.some(item => item.id === id));
	return structural ? runtime.structureActions.remove(ids) : runtime.elementActions.removeMany(ids);
}
