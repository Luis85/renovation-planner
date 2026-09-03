<script setup lang="ts">
/**
 * §60's layers region, replaced by the truthful two-entry catalogue (Task 14): what used to
 * be seven checkboxes for §17's whole Konva stage — four of them layers nothing ever draws
 * into — is the Reference plan and the Rooms, plus Set scale on the reference row, which is
 * Calibrate's only door since Task 13 retired the toolbar.
 *
 * The class stays `rp-editor-layers` (not renamed to match the new content) so
 * `shell.test.ts`'s region assertions and this panel's CSS width survive Task 13's shell
 * split unchanged; only what is INSIDE it changed.
 */
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import type { PlanDto } from '../../read-models/PlanDto';
import { layerCatalogue } from '../layers/layerCatalogue';
import LayerList from './LayerList.vue';

const props = defineProps<{ plan: PlanDto | null }>();
const runtime = useEditorRuntime();
const entries = computed(() => layerCatalogue(props.plan));
// Computed rather than interpolated inline: a plan-less heading (still loading, missing,
// failed) is just the region name, and building that branch in the template needs a nested
// `<template>` that fails `vue/singleline-html-element-content-newline`.
const heading = computed(() => (props.plan === null ? tr('editor.floor') : `${tr('editor.floor')} — ${props.plan.name}`));
</script>

<template>
	<aside
		class="rp-editor-layers"
		:aria-label="tr('editor.property-panel')"
	>
		<h2 class="rp-editor-panel-title">
			{{ heading }}
		</h2>
		<LayerList
			:entries="entries"
			@activate-tool="runtime.setTool"
		/>
	</aside>
</template>
