<script setup lang="ts">
/** Named panel doors share the existing one-overlay and focus restoration paths. */
import HostIcon from '../../components/HostIcon.vue';
import { storeToRefs } from 'pinia';
import { nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

const workspace = useWorkspaceStore();
const { overlay } = storeToRefs(workspace);
const panels = { layers: '.rp-overlay-panel', inspector: '.rp-inspector-drawer' };
/**
 * Property and Layers remain one mounted panel. The narrow rail only names the existing
 * expandable destinations, so it does not create another navigation state to keep in sync.
 */
async function open(kind: 'layers' | 'inspector', event: MouseEvent, section?: 'context' | 'layers'): Promise<void> {
	const shell = (event.currentTarget as HTMLElement).closest('.rp-editor-shell') as HTMLElement;
	workspace.openOverlay(kind);
	await nextTick();
	const panel = shell.querySelector<HTMLElement>(panels[kind]);
	const destination = section === undefined ? null : panel?.querySelector<HTMLDetailsElement>(`[data-rp-section="${section}"]`);
	if (destination) {
		destination.open = true;
		destination.querySelector<HTMLElement>('summary')?.focus();
		return;
	}
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
			@click="open('layers', $event, 'context')"
		>
			<HostIcon name="house" /><span>{{ tr('editor.shell.property') }}</span>
		</button>
		<button
			type="button"
			class="rp-panel-rail__button"
			data-rp-rail-section="layers"
			:aria-expanded="overlay === 'layers'"
			@click="open('layers', $event, 'layers')"
		>
			<HostIcon name="layers" /><span>{{ tr('editor.rail.layers') }}</span>
		</button>
		<button
			type="button"
			class="rp-panel-rail__button"
			data-rp-rail="details"
			:aria-expanded="overlay === 'inspector'"
			@click="open('inspector', $event)"
		>
			<HostIcon name="panels-top-left" /><span>{{ tr('editor.rail.details') }}</span>
		</button>
	</div>
</template>
