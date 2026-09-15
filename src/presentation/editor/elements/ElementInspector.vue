<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import { draftingKind } from '../../../domain/spatial/SpatialElement';
import ElementSummaryLine from './ElementSummaryLine.vue';
import LoadBearingSwitch from './LoadBearingSwitch.vue';
import StructureRenovationEntry from '../structure/StructureRenovationEntry.vue';
import HostIcon from '../../components/HostIcon.vue';
import ElementGeometryActions from './ElementGeometryActions.vue';
import ItemColorControl from './ItemColorControl.vue';
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const element = computed(() => project.structure.elements?.find(item => item.id === selection.selectedIds[0]));
const name = computed(() => project.plan?.spatialElements?.find(item => item.id === element.value?.id)?.name ?? element.value?.id ?? '');
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
		<ItemColorControl />
		<LoadBearingSwitch :element="element" />
		<StructureRenovationEntry v-if="!draftingKind(element.kind)" />
		<ElementGeometryActions />
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
