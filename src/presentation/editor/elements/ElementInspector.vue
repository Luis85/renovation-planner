<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import { elementLength } from '../../../domain/spatial/SpatialElement';
import { area } from '../../../core/geometry/operations';
import { formatArea } from '../shell/formatArea';
import { formatMetres } from '../shell/formatLength';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import ObjectRotationControls from './ObjectRotationControls.vue';
import StructureRenovationEntry from '../structure/StructureRenovationEntry.vue';
import { useRenovationSession } from '../renovation/renovationSession';
const session = useRenovationSession();
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const element = computed(() => project.structure.elements?.find(item => item.id === selection.selectedIds[0]));
const name = computed(() => project.plan?.spatialElements?.find(item => item.id === element.value?.id)?.name ?? element.value?.id ?? '');
const measuredArea = computed(() => element.value ? area({ points: element.value.points }) : null);
async function edit(event: Event): Promise<void> {
	if (!element.value) return;
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.elementActions.edit(element.value.id); await nextTick();
	if (!opener.isConnected && root?.isConnected) (root.querySelector<HTMLElement>('[data-rp-action="edit-element"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]'))?.focus();
}
</script>
<template>
	<section
		v-if="element"
		class="rp-element-inspector"
		:data-rp-id="element.id"
	>
		<h3>{{ name }}</h3><p>{{ tr(zoneTypeLabel(element.kind)) }}</p>
		<p v-if="element.kind === 'object' && measuredArea?.ok">
			{{ formatArea(measuredArea.value) }}
		</p>
		<p v-else>
			{{ formatMetres(elementLength(element)) }} m
		</p>
		<StructureRenovationEntry />
		<ObjectRotationControls
			v-if="element.kind === 'object' && session.perspective === 'plan'"
			:id="element.id"
		/>
		<button
			v-if="session.perspective === 'renovate'"
			type="button"
			data-rp-action="element-plan-geometry"
			@click="runInspectorAction($event, 'edit-element', () => runtime.renovation.perspective('plan'))"
		>
			{{ tr('editor.element.plan-geometry') }}
		</button>
		<div class="rp-dialog-actions">
			<button
				type="button"
				data-rp-action="edit-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="edit"
			>
				{{ tr('editor.element.edit-action') }}
			</button>
			<button
				type="button"
				data-rp-action="delete-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="runtime.elementActions.remove(element.id)"
			>
				{{ tr('editor.element.delete-action') }}
			</button>
		</div>
	</section>
</template>
