import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from './selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { structureCandidates } from '../structure/structureCandidates';
import { boundsOfZones } from '../viewport/zoneExtent';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

/** Current geometry supplies editing actions. Intended targets keep their Planned authority. */
export function useDirectActionContext() {
	const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
	const workspace = useWorkspaceStore();
	const target = computed(() => {
		if (selection.selectedIds.length !== 1) return null;
		const id = selection.selectedIds[0], zone = project.zones.get(id);
		const shape = zone ?? structureCandidates(project.structure).find(item => item.id === id);
		if (!shape) return null;
		const box = boundsOfZones([shape]);
		if (!box) return null;
		const wall = project.structure.walls.find(item => item.id === id);
		const opening = project.structure.openings.find(item => item.id === id);
		const roomId = zone?.zoneType === 'Room' ? id : session.targetId === id && project.zones.get(session.roomId)?.zoneType === 'Room' ? session.roomId : '';
		return { id, zone, wall, opening, roomId, box, visible: zone ? workspace.layerVisibility.zone : workspace.layerVisibility.architecture };
	});
	return { target, session };
}
