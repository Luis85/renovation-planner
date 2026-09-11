import { computed, type ComputedRef } from 'vue';
import type { Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { draftStructure, isStructureTool } from './structureDraft';

/**
 * The structure the canvas is DRAWING: a curve, group or wall-edit preview first, then the
 * structure tool's draft (a non-wall draft only while it validates), then the committed one.
 * `StructureLayer.vue` draws it and `ZoneLayer.vue` asks enclosure of it, so a walled room's
 * outline never hides or shows against walls other than the ones on screen mid-gesture.
 */
export function useDrawnStructure(): ComputedRef<Structure> {
	const project = useProjectStore(), runtime = useEditorRuntime(), task = runtime.structureTask;
	const draftPreview = computed(() => {
		if (!isStructureTool(runtime.activeToolId.value)) return null;
		const proposed = draftStructure(task.draft, project.structure);
		if (!proposed || runtime.activeToolId.value === 'draw-wall') return proposed;
		return validateStructure(proposed, project.structure.boundaries.map(boundary => boundary.roomId)).ok ? proposed : null;
	});
	return computed(() => runtime.curveTask.preview.value?.structure ?? runtime.groupActions?.preview.value?.structure ?? runtime.structureActions.preview.value ?? draftPreview.value ?? project.structure);
}
