import type { useProjectStore } from '../../stores/ProjectStore';
import type { useEditorStore } from '../../stores/EditorStore';
import type { useSelectionStore } from './selection-store';
import { structureCandidates } from '../structure/structureCandidates';
import { selectSpatial } from './selectSpatial';
import { boundsOfZones } from '../viewport/zoneExtent';
import { groupMembers, groupRoots } from '../../../domain/spatial/SpatialGroup';
import type { EntityId } from '../../../core/identity/EntityId';

/** Select a list identity, then frame its current spatial extent. */
export function selectAndFrameOn(
	projectStore: ReturnType<typeof useProjectStore>,
	selection: ReturnType<typeof useSelectionStore>,
	editor: ReturnType<typeof useEditorStore>,
	target: { readonly id: string; readonly toggle: boolean },
): void {
	const { id, toggle } = target;
	const root = groupRoots([id], projectStore.structure)[0];
	const group = projectStore.groups.find(item => item.id === id || item.memberIds.includes(root));
	if (group) {
		const members = groupMembers(group, projectStore.structure), selected = selection.selectedIds;
		const ids = toggle ? members.every(member => selected.some(value => value === member)) ? selected.filter(value => !members.includes(value)) : [...selected, ...members] : members;
		selection.select(ids.map(value => value as EntityId<string>));
		if (!toggle) {
			const candidates = [...projectStore.zones.values(), ...structureCandidates(projectStore.structure)];
			const bounds = boundsOfZones(candidates.filter(item => members.includes(item.id)));
			if (bounds) editor.fitTo(bounds, editor.stageSize);
		}
		return;
	}
	selectSpatial(selection, id, toggle);
	if (toggle) return;
	const zone = projectStore.zones.get(id) ?? structureCandidates(projectStore.structure).find(candidate => candidate.id === id);
	if (zone === undefined) return;
	const bounds = boundsOfZones([zone]);
	if (bounds === null) return; // nothing to frame: the selection stands, the camera stays
	editor.fitTo(bounds, editor.stageSize);
}
