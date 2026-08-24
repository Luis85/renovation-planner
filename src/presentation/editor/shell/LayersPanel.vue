<script setup lang="ts">
/**
 * §60's layers region — and the one shell region this slice fills with real behaviour,
 * because layer visibility is a pure RENDERING concern: hiding the zone layer changes
 * nothing persisted, so it needs no command, no undo entry and no write.
 *
 * A real checkbox with a real `<label for>`, not a styled `<div>` with a click handler:
 * §85 wants keyboard-accessible controls and semantic labels, and the platform control
 * already is both. `tests/harness/accessibility.test.ts` checks the labelling.
 */
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import { KONVA_LAYER_IDS, type KonvaLayerId } from '../scene/KonvaLayers';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

/**
 * A total `Record` over the layer ids, so a layer added to §17's list is a COMPILE error
 * here until it has a label — rather than a panel row reading `editor.layer.whatever`.
 * That is also why the key is not built by interpolation: `tr` takes a `StringKey`, and a
 * template string would defeat the check that makes this table exhaustive.
 */
const LABEL_KEYS: Readonly<Record<KonvaLayerId, StringKey>> = {
	background: 'editor.layer.background',
	architecture: 'editor.layer.architecture',
	zone: 'editor.layer.zone',
	construction: 'editor.layer.construction',
	asset: 'editor.layer.asset',
	annotation: 'editor.layer.annotation',
	interaction: 'editor.layer.interaction',
};

const workspace = useWorkspaceStore();
const { layerVisibility } = storeToRefs(workspace);
</script>

<template>
	<aside
		class="rp-editor-layers"
		:aria-label="tr('editor.layers')"
	>
		<h2 class="rp-editor-panel-title">
			{{ tr('editor.layers') }}
		</h2>
		<ul class="rp-editor-layer-list">
			<li
				v-for="layerId in KONVA_LAYER_IDS"
				:key="layerId"
				class="rp-editor-layer-row"
			>
				<input
					:id="`rp-layer-${layerId}`"
					type="checkbox"
					:checked="layerVisibility[layerId]"
					@change="workspace.toggleLayer(layerId)"
				>
				<label :for="`rp-layer-${layerId}`">{{ tr(LABEL_KEYS[layerId]) }}</label>
			</li>
		</ul>
	</aside>
</template>
