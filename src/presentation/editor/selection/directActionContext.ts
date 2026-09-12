import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from './selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { structureCandidates } from '../structure/structureCandidates';
import { boundsOfZones } from '../viewport/zoneExtent';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';

/** Current geometry supplies editing actions. Intended targets keep their Planned authority. */
export function useDirectActionContext() {
	const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
	const workspace = useWorkspaceStore(), assetShapes = useAssetShapeStore();
	const target = computed(() => {
		if (selection.selectedIds.length !== 1) return null;
		const id = selection.selectedIds[0], zone = project.zones.get(id);
		const shape = zone ?? structureCandidates(project.structure, assetShapes.shapeOf).find(item => item.id === id);
		if (!shape) return null;
		const box = boundsOfZones([shape]);
		if (!box) return null;
		const wall = project.structure.walls.find(item => item.id === id);
		const opening = project.structure.openings.find(item => item.id === id);
		const roomId = zone?.zoneType === 'Room' ? id : session.targetId === id && project.zones.get(session.roomId)?.zoneType === 'Room' ? session.roomId : '';
		const visible = zone ? workspace.layerVisibility.zone : 'kind' in shape && shape.kind === 'asset' ? workspace.layerVisibility.asset : workspace.layerVisibility.architecture;
		return { id, zone, wall, opening, roomId, box, visible };
	});
	return { target, session };
}
