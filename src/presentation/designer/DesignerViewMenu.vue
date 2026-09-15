<script setup lang="ts">
/**
 * The asset designer's View menu (snapping spec 2026-09-15, §2.6): Grid shows the designer's grid and lets
 * gestures snap to it; Snap to objects turns vertex, edge and alignment snapping on and off. The same two stores the
 * Plan Editor's `EditorViewMenu` drives, per leaf, with its dismissal (`useDisclosureDismissal`); remembered per
 * device by `AssetDesignerRoot`'s `useViewPreferences`. No zoom or fit actions: nothing asked for them here.
 */
import { ref } from 'vue';
import { useDisclosureDismissal } from '../composables/use-disclosure-dismissal';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { useDesignerRuntime } from './runtime';

const editor = useEditorStore(), workspace = useWorkspaceStore();
const runtime = useDesignerRuntime();
const disclosure = ref<HTMLDetailsElement | null>(null);
const escape = useDisclosureDismissal(disclosure);

/** Refused while a press is held — a pan, or a tool's gesture — as `EditorViewMenu` refuses it: a drag's landing must not change under it. */
function toggleSnap(event: Event): void {
	const input = event.target as HTMLInputElement;
	if (editor.dragState === null && !runtime.toolManager.gestureInFlight) editor.snappingEnabled = input.checked;
	input.checked = editor.snappingEnabled;
}
</script>

<template>
	<details
		ref="disclosure"
		class="rp-view-menu"
		@keydown="escape"
	>
		<summary class="rp-designer-tool-button">
			{{ tr('editor.view') }}
		</summary>
		<div class="rp-view-menu__content">
			<label><input
				v-model="workspace.gridVisible"
				type="checkbox"
				data-rp-view="grid"
			>{{ tr('editor.view.grid') }}</label>
			<label><input
				:checked="editor.snappingEnabled"
				type="checkbox"
				data-rp-view="snap"
				@change="toggleSnap"
			>{{ tr('editor.view.snap') }}</label>
		</div>
	</details>
</template>
