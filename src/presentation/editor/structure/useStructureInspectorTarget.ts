import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';

/** Shared selected-structure state for the inspector shell and its Plan-only action cluster. */
export function useStructureInspectorTarget() {
	const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime(), session = useRenovationSession();
	const id = computed(() => String(selection.selectedIds[0]));
	const wall = computed(() => project.structure.walls.find(candidate => candidate.id === id.value));
	const opening = computed(() => project.structure.openings.find(candidate => candidate.id === id.value));
	const paused = computed(() => runtime.writesBlocked.value || runtime.structureActions.active.value);
	return { project, runtime, session, id, wall, opening, paused };
}
