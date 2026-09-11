import type { useProjectStore } from '../../stores/ProjectStore';
import type { useEditorStore } from '../../stores/EditorStore';
import type { useSelectionStore } from './selection-store';
import { structureCandidates } from '../structure/structureCandidates';
import { selectSpatial } from './selectSpatial';
import { boundsOfZones } from '../viewport/zoneExtent';
import { groupMembers, groupRoots } from '../../../domain/spatial/SpatialGroup';
import type { EntityId } from '../../../core/identity/EntityId';
import { assetShapesFor } from '../elements/assetShapeLoader';

/**
 * Select a list identity, then frame its current spatial extent.
 *
 * It runs at CLICK time, from list-row handlers with no injection context, where
 * `useAssetShapeStore()` would resolve Pinia's module-global active instance — which every
 * view's mount reassigns — and so read, or create a store in, another leaf's Pinia. The asset
 * shapes come instead from `assetShapesFor(projectStore)`: the lookup this leaf's
 * `watchAssetShapes` registered at setup against the same project store handed in here.
 * Not a `shapeOf` parameter, because its one caller, `runtime.ts`, is at its 400-line cap and not
 * edited.
 */
export function selectAndFrameOn(
	projectStore: ReturnType<typeof useProjectStore>,
	selection: ReturnType<typeof useSelectionStore>,
	editor: ReturnType<typeof useEditorStore>,
	target: { readonly id: string; readonly toggle: boolean },
): void {
	const { id, toggle } = target, shapeOf = assetShapesFor(projectStore);
	const root = groupRoots([id], projectStore.structure)[0];
	const group = projectStore.groups.find(item => item.id === id || item.memberIds.includes(root));
	if (group) {
		const members = groupMembers(group, projectStore.structure), selected = selection.selectedIds;
		const ids = toggle ? members.every(member => selected.some(value => value === member)) ? selected.filter(value => !members.includes(value)) : [...selected, ...members] : members;
		selection.select(ids.map(value => value as EntityId<string>));
		if (!toggle) {
			const candidates = [...projectStore.zones.values(), ...structureCandidates(projectStore.structure, shapeOf)];
			const bounds = boundsOfZones(candidates.filter(item => members.includes(item.id)));
			if (bounds) editor.fitTo(bounds, editor.stageSize);
		}
		return;
	}
	selectSpatial(selection, id, toggle);
	if (toggle) return;
	const zone = projectStore.zones.get(id) ?? structureCandidates(projectStore.structure, shapeOf).find(candidate => candidate.id === id);
	if (zone === undefined) return;
	const bounds = boundsOfZones([zone]);
	if (bounds === null) return; // nothing to frame: the selection stands, the camera stays
	editor.fitTo(bounds, editor.stageSize);
}
