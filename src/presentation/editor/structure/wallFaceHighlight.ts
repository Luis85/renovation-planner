import { onBeforeUnmount, readonly, ref, watch } from 'vue';
import type { WallSide } from '../../../domain/spatial/Structure';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorStore } from '../../stores/EditorStore';

/** A read-only visual cue shared by the compact overlay and the complete Details form. */
export function createWallFaceHighlight() {
	const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), editor = useEditorStore();
	const target = ref<{ wallId: string; side: WallSide } | null>(null);
	let alive = true;
	function clear(): void { target.value = null; }
	function show(id: string | null, side: WallSide | null): void {
		if (side === null) { if (id === null || target.value?.wallId === id) clear(); return; }
		if (!alive || id === null || session.perspective !== 'plan' || editor.activeToolId !== 'select' || selection.selectedIds.length !== 1 || selection.selectedIds[0] !== id || !project.structure.walls.some(wall => wall.id === id)) return;
		target.value = { wallId: id, side };
	}
	watch([() => selection.selectedIds.join(), () => session.perspective, () => editor.activeToolId], clear, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; clear(); });
	return { target: readonly(target), show, clear };
}
