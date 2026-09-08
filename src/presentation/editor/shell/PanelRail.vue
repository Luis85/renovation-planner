<script setup lang="ts">
/**
 * The constrained layout's two doors (design spec §5.1/§5.4): what the persistent Property
 * and Inspector panels become when the pane is too narrow to hold three columns.
 *
 * TEXT labels, not icons: this plugin calls `setIcon` nowhere, and an unlabelled glyph rail
 * would be the one control in the editor a screen reader could not name. The two ids are
 * `layers` and `details` while the overlay kinds are `layers` and `inspector` — the rail says
 * what a homeowner is looking for, the store says which component answers, and
 * `ResponsiveEditorShell` holds the one mapping between them.
 *
 * `aria-expanded` is the honest attribute for a button that reveals a panel elsewhere in the
 * document, and it is `false` for BOTH while nothing is open — the one-overlay rule (§5.5)
 * means at most one of them is ever `true`.
 */
import { storeToRefs } from 'pinia';
import { nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

const workspace = useWorkspaceStore();
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
			{{ tr('editor.rail.layers') }}
		</button>
		<button
			type="button"
			class="rp-panel-rail__button"
			data-rp-rail="details"
			:aria-expanded="overlay === 'inspector'"
			@click="open('inspector', $event)"
		>
			{{ tr('editor.rail.details') }}
		</button>
	</div>
</template>
