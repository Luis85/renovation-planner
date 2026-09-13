<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import ObjectRotationControls from './ObjectRotationControls.vue';

const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const element = computed(() => project.structure.elements?.find(item => item.id === selection.selectedIds[0]));

async function edit(event: Event): Promise<void> {
	if (!element.value) return;
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.elementActions.edit(element.value.id); await nextTick();
	if (!opener.isConnected && root?.isConnected) (root.querySelector<HTMLElement>('[data-rp-action="edit-element"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]'))?.focus();
}
</script>
<template>
	<template v-if="element">
		<ObjectRotationControls
			v-if="session.perspective === 'plan'"
			:id="element.id"
		/>
		<div class="rp-inspector-actions">
			<button
				v-if="session.perspective === 'renovate'"
				type="button"
				class="rp-inspector-action"
				data-rp-action="element-plan-geometry"
				@click="runInspectorAction($event, 'edit-element', () => runtime.renovation.perspective('plan'))"
			>
				{{ tr('editor.element.plan-geometry') }}
			</button>
			<button
				v-if="element.kind !== 'asset' && session.perspective === 'plan'"
				type="button"
				class="rp-inspector-action"
				data-rp-action="edit-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="edit"
			>
				{{ tr('editor.element.edit-action') }}
			</button>
		</div>
	</template>
</template>
