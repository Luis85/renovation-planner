<script setup lang="ts">
/** Named panel doors share the existing one-overlay and focus restoration paths. */
import HostIcon from '../../components/HostIcon.vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSpatialRecords } from './useSpatialRecords';
import { structureRecords } from '../structure/structureRecords';
import { storeToRefs } from 'pinia';
import { computed, nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

const workspace = useWorkspaceStore();
const project = useProjectStore(), selection = useSelectionStore();
const rooms = useSpatialRecords();
const detailsLabel = computed(() => {
	if (selection.selectedIds.length > 1) return tr('editor.rail.details');
	const records = [...rooms.value, ...structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements)];
	const name = records.find(record => record.id === selection.selectedIds[0])?.name ?? project.plan?.name;
	return name ? tr('editor.shell.details', { name }) : tr('editor.rail.details');
});
const { overlay } = storeToRefs(workspace);
const panels = { layers: '.rp-overlay-panel', inspector: '.rp-inspector-drawer' };
async function open(kind: 'layers' | 'inspector', event: MouseEvent): Promise<void> {
	const shell = (event.currentTarget as HTMLElement).closest('.rp-editor-shell') as HTMLElement;
	workspace.openOverlay(kind);
	await nextTick();
	const panel = shell.querySelector<HTMLElement>(panels[kind]);
	if (panel && !panel.contains(panel.ownerDocument.activeElement)) panel.focus();
}
</script>

<template>
	<div class="rp-panel-rail">
		<button
			type="button"
			class="rp-panel-rail__button"
			data-rp-rail="layers"
			:aria-expanded="overlay === 'layers'"
			@click="open('layers', $event)"
		>
			<HostIcon name="layers" /><span>{{ tr('editor.property-panel') }}</span>
		</button>
		<button
			type="button"
			class="rp-panel-rail__button"
			data-rp-rail="details"
			:aria-expanded="overlay === 'inspector'"
			@click="open('inspector', $event)"
		>
			<HostIcon name="panels-top-left" /><span>{{ detailsLabel }}</span>
		</button>
	</div>
</template>
