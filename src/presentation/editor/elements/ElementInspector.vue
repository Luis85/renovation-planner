<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import { draftingKind } from '../../../domain/spatial/SpatialElement';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import ObjectRotationControls from './ObjectRotationControls.vue';
import ElementSummaryLine from './ElementSummaryLine.vue';
import LoadBearingSwitch from './LoadBearingSwitch.vue';
import StructureRenovationEntry from '../structure/StructureRenovationEntry.vue';
import { useRenovationSession } from '../renovation/renovationSession';
import HostIcon from '../../components/HostIcon.vue';
const session = useRenovationSession();
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const element = computed(() => project.structure.elements?.find(item => item.id === selection.selectedIds[0]));
const name = computed(() => project.plan?.spatialElements?.find(item => item.id === element.value?.id)?.name ?? element.value?.id ?? '');
/** The compound condition below, out of the template for the same threshold. */
const showFlip = computed(() => element.value?.kind === 'section' && session.perspective === 'plan');
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
		<h3>{{ name }}</h3>
		<p class="rp-inspector-subline">
			{{ tr(zoneTypeLabel(element.kind)) }}
		</p>
		<ElementSummaryLine :element="element" />
		<LoadBearingSwitch :element="element" />
		<StructureRenovationEntry v-if="!draftingKind(element.kind)" />
		<ObjectRotationControls
			v-if="session.perspective === 'plan'"
			:id="element.id"
		/>
		<div class="rp-inspector-actions">
			<button
				v-if="showFlip"
				type="button"
				class="rp-inspector-action"
				data-rp-action="flip-section"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="runtime.elementActions.flip(element.id)"
			>
				{{ tr('editor.drafting.flip') }}
			</button>
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
				v-if="element.kind !== 'asset'"
				type="button"
				class="rp-inspector-action"
				data-rp-action="edit-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="edit"
			>
				{{ tr('editor.element.edit-action') }}
			</button>
		</div>
		<!-- The frame's group controls, above Delete so Delete stays the foot of the whole region (side panels spec §3). -->
		<slot name="actions" />
		<div class="rp-inspector-danger">
			<button
				type="button"
				data-rp-action="delete-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="runtime.elementActions.remove(element.id)"
			>
				<HostIcon name="trash" />{{ tr('editor.element.delete-action') }}
			</button>
		</div>
	</section>
</template>
