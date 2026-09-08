import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useSelectionStore } from '../selection/selection-store';
import { structureCandidates } from '../structure/structureCandidates';
import { boundsOfZones } from './zoneExtent';

/** One extent calculation for the native View controls and canvas fit shortcuts. */
export function usePlanFrame() {
	const editor = useEditorStore(), project = useProjectStore();
	const workspace = useWorkspaceStore(), selection = useSelectionStore();
	return (all: boolean) => {
		const zones = [...project.zones.values(), ...structureCandidates(project.structure)];
		const framed = all ? zones : zones.filter(zone => selection.selectedIds.some(id => String(id) === zone.id));
		return boundsOfZones(all && workspace.layerVisibility.background
			? [...framed, { points: editor.referencePoints }] : framed);
	};
}
