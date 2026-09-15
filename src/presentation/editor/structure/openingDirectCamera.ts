import { watch, type Ref } from 'vue';
import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { openingSymbol } from '../../../domain/spatial/openingGeometry';
import type { useEditorStore } from '../../stores/EditorStore';
import { boundsOfZones } from '../viewport/zoneExtent';

/** A dock reserves real canvas space. Frame the complete opening above the taskbar after its resize. */
export function useOpeningDirectCamera(editor: ReturnType<typeof useEditorStore>, target: Ref<string | null>, docked: Readonly<Ref<boolean>>,
	clearance: Ref<number>, geometry: () => { opening: Opening | undefined; wall: Wall | undefined }): void {
	watch([target, () => editor.stageSize, docked, clearance], () => {
		if (!target.value || !docked.value) return;
		const { opening, wall } = geometry(); if (!opening || !wall) return;
		const symbol = openingSymbol(opening, wall), bounds = boundsOfZones([{ points: [...symbol.cut, ...symbol.frame.flat(), ...symbol.leaf, ...symbol.arc] }]);
		const height = Math.max(1, editor.stageSize.height - clearance.value);
		if (bounds) editor.fitTo(bounds, { width: editor.stageSize.width, height }, Math.min(24, height / 8));
	}, { flush: 'post' });
}
