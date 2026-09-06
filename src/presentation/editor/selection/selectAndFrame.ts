import type { useProjectStore } from '../../stores/ProjectStore';
import type { useEditorStore } from '../../stores/EditorStore';
import type { useSelectionStore } from './selection-store';
import { structureCandidates } from '../structure/structureCandidates';
import { selectSpatial } from './selectSpatial';
import { boundsOfZones } from '../viewport/zoneExtent';

/** Select a list identity, then frame its current spatial extent. */
export function selectAndFrameOn(
	projectStore: ReturnType<typeof useProjectStore>,
	selection: ReturnType<typeof useSelectionStore>,
	editor: ReturnType<typeof useEditorStore>,
	target: { readonly id: string; readonly toggle: boolean },
): void {
	const { id, toggle } = target;
	selectSpatial(selection, id, toggle);
	if (toggle) return;
	const zone = projectStore.zones.get(id) ?? structureCandidates(projectStore.structure).find(candidate => candidate.id === id);
	if (zone === undefined) return;
	const bounds = boundsOfZones([zone]);
	if (bounds === null) return; // nothing to frame: the selection stands, the camera stays
	editor.fitTo(bounds, editor.stageSize);
}
