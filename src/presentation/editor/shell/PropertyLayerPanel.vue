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
 *
 * **`tabindex="-1"` and `data-rp-region="layers"` make this aside PROGRAMMATICALLY focusable
 * and nothing else** (R10). A pane growing from `constrained` back to `full` closes the
 * overlay that stood in for this region — the overlay draws this very component inside itself
 * — and the rail button a close would normally return focus to is removed by the same
 * transition, so `ResponsiveEditorShell.measure` focuses this region instead of leaving the
 * keyboard user on `<body>`. `-1` rather than `0` because that is the whole of it: this is a
 * surviving TARGET, not a new Tab stop, and the panel's own controls are what a user tabs to.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import type { PlanDto } from '../../read-models/PlanDto';
import { layerCatalogue } from '../layers/layerCatalogue';
import LayerList from './LayerList.vue';

const props = defineProps<{ plan: PlanDto | null }>();
const runtime = useEditorRuntime();
/**
 * Design spec §2.9's `writesBlocked`, read directly from `ProjectStore` rather than from
 * `runtime.writesBlocked` — the same call `StatusBar.vue`'s own header makes for the
 * identical reason: this component is discoverable and mountable STANDALONE by the harness
 * index (every real `.vue` under `src/presentation/` is), and injecting the runtime there
 * throws with no `PlanEditorRoot` above it to provide one.
 */
const { stale } = storeToRefs(useProjectStore());
const entries = computed(() => layerCatalogue(props.plan, stale.value));
// Computed rather than interpolated inline: a plan-less heading (still loading, missing,
// failed) is just the region name, and building that branch in the template needs a nested
// `<template>` that fails `vue/singleline-html-element-content-newline`.
const heading = computed(() => (props.plan === null ? tr('editor.floor') : `${tr('editor.floor')} — ${props.plan.name}`));
</script>

<template>
	<aside
		class="rp-editor-layers"
		tabindex="-1"
		data-rp-region="layers"
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
