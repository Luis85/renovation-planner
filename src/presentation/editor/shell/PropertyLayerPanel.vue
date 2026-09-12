<script setup lang="ts">
import ChangeLegend from './ChangeLegend.vue';
import PropertyTree from './PropertyTree.vue';
import StructureList from '../structure/StructureList.vue';
/** Current Project → Floor context and presentation layers, with the non-canvas entity
 * routes disclosed separately. Stores survive modeless panel hiding and reflow. */
import ReferenceAction from '../reference/ReferenceAction.vue';
import { computed } from 'vue';
import { useRenovationSession } from '../renovation/renovationSession';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import type { KonvaLayerId } from '../scene/KonvaLayers';
import type { PlanDto } from '../../read-models/PlanDto';
import { layerCatalogue, type LayerToggle, type LayerToggles } from '../layers/layerCatalogue';
import LayerList from './LayerList.vue';
import RoomSummaryList from './RoomSummaryList.vue';
import { useSpatialRecords } from './useSpatialRecords';

const props = defineProps<{ plan: PlanDto | null }>();
const runtime = useEditorRuntime();
const session = useRenovationSession();
const { stale } = storeToRefs(useProjectStore());
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const records = useSpatialRecords();
// Per-leaf on the runtime so selection mode survives panel reflow.
const toggleSelection = runtime.multiSelectionMode;
const workspace = useWorkspaceStore();
const konva = (layer: KonvaLayerId): LayerToggle => ({
	visible: () => workspace.layerVisibility[layer],
	toggle: () => workspace.toggleLayer(layer),
});
/** Every row's home, in one place: four Konva layers, the session flag, the notes gate. */
const toggles = computed<LayerToggles>(() => ({
	reference: konva('background'),
	rooms: konva('zone'),
	walls: konva('architecture'),
	assets: konva('asset'),
	planned: runtime.renovation.available ? { visible: () => session.visible, toggle: () => { session.visible = !session.visible; } } : null,
	notes: { visible: () => workspace.notesVisible, toggle: workspace.toggleNotes },
}));
/**
 * Review withholds Set scale and Reference options (nothing there is reachable while
 * perspectives are read-only), but the two rows that write NOTHING to the vault — Planned
 * changes and Notes and photos, both pure rendering toggles on `WorkspaceStore`/the session —
 * stay reachable: before the sidebar fold (Task 4) Planned changes sat outside `LayerList`
 * with no perspective gate at all, so Review already showed it (Ruling R13).
 */
const entries = computed(() => {
	const all = layerCatalogue(props.plan, toggles.value, stale.value, hierarchy.value.parentZone !== null);
	return session.perspective === 'review' ? all.filter((entry) => entry.id === 'planned' || entry.id === 'notes') : all;
});
</script>

<template>
	<aside
		class="rp-editor-layers"
		tabindex="-1"
		data-rp-region="layers"
		:aria-label="tr('editor.property-panel')"
	>
		<details
			class="rp-sidebar-section rp-property-context"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.shell.property') }}
			</summary>
			<PropertyTree />
		</details>
		<details
			class="rp-sidebar-section rp-property-layers"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.rail.layers') }}
			</summary>
			<LayerList
				:entries="entries"
				:plan="plan"
				@activate-tool="runtime.setTool"
			/>
			<details
				v-if="session.perspective !== 'review'"
				class="rp-reference-options"
			>
				<summary>{{ tr('editor.shell.reference-options') }}</summary>
				<ReferenceAction />
			</details>
			<ChangeLegend v-if="runtime.renovation.available" />
		</details>
		<details
			class="rp-sidebar-section rp-property-rooms"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.selection.records') }}
			</summary>
			<RoomSummaryList
				v-if="records.length > 0"
				:records="records"
				:heading="tr('editor.selection.records')"
			/>
			<!-- Stays while ON: the mode also governs canvas clicks, so it must never be left unreachable. -->
			<label v-if="records.length > 1 || toggleSelection">
				<input
					v-model="toggleSelection"
					type="checkbox"
					data-rp-action="multiple-selection"
				>
				{{ tr('editor.selection.toggle-mode') }}
			</label>
			<p v-if="records.length > 1">
				{{ tr('editor.selection.hint') }}
			</p>
		</details>
		<details class="rp-sidebar-section rp-property-elements">
			<summary class="rp-editor-panel-title">
				{{ tr('editor.structure.list') }}
			</summary>
			<StructureList />
		</details>
	</aside>
</template>
