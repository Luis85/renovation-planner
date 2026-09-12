import { guideFramePoints } from '../hierarchy/parentZoneGuide';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useSelectionStore } from '../selection/selection-store';
import { structureCandidates } from '../structure/structureCandidates';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { boundsOfZones } from './zoneExtent';

/**
 * One extent calculation for the native View controls and canvas fit shortcuts. The parent-zone
 * guide (ADR-0028) is framed exactly like the reference it lines up with: in a whole-plan fit
 * while the Reference layer is visible, never in a selection fit. `reference: false` frames the
 * drawn items alone, which is what a plan opens on.
 */
export function usePlanFrame() {
	const editor = useEditorStore(), project = useProjectStore(), hierarchy = usePlanHierarchyStore();
	const workspace = useWorkspaceStore(), selection = useSelectionStore(), assetShapes = useAssetShapeStore();
	return (all: boolean, reference = true) => {
		const zones = [...project.zones.values(), ...structureCandidates(project.structure, assetShapes.shapeOf)];
		const framed = all ? zones : zones.filter(zone => selection.selectedIds.some(id => String(id) === zone.id));
		return boundsOfZones(all && reference && workspace.layerVisibility.background
			? [...framed, { points: editor.referencePoints }, { points: guideFramePoints(hierarchy.hierarchy.parentZone) }] : framed);
	};
}
