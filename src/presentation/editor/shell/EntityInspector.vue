<script setup lang="ts">
/**
 * The Inspector FRAME (component library §8): the ONE `<aside>` and `aria-label` for §60's
 * inspector region, and the routing by `selectedIds` — the floor state
 * (`FloorInspector.vue`, Task 7's `buildFloorSummary`) while nothing is selected, the
 * multiple-selection text while several ids are, and the room body (`RoomInspector.vue`,
 * `InspectorPanel.vue` through Task 15) for exactly one. Through Task 14 that body
 * drew its OWN aside and decided this same routing off `InspectorStore.dto.kind`; a second
 * `<aside class="rp-editor-inspector">` nested inside the first would double the landmark
 * `shell.test.ts` asserts is singular, so Task 15 moved both up here and left the body a
 * body.
 *
 * **The `role="status"` return-to-floor announcement (design spec §6.6) lives in
 * `SelectionGuidance.vue` now, not here (R15, 2026-09-04).** `ResponsiveEditorShell` mounts
 * this aside in `constrained` layout only while its drawer is open, so a watcher living here
 * would hear nothing about a selection cleared while the drawer is closed — see
 * [[Selection clearing is silent while the constrained Inspector is closed]]. This component
 * is responsible only for visible Inspector content.
 *
 * **`tabindex="-1"` and `data-rp-region="inspector"` make this aside PROGRAMMATICALLY focusable
 * and nothing else** (R10). A pane growing from `constrained` back to `full` closes the drawer
 * that stood in for this region — the drawer draws this very component inside itself — and the
 * rail button a close would normally return focus to is removed by the same transition, so
 * `ResponsiveEditorShell.measure` focuses this region instead of leaving the keyboard user on
 * `<body>`. `-1` rather than `0` because that is the whole of it: this is a surviving TARGET,
 * not a new Tab stop, and the Inspector's own controls are what a user tabs to.
 */
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import FloorInspector from './FloorInspector.vue';
import RoomInspector from './RoomInspector.vue';

const { selectedIds } = storeToRefs(useSelectionStore());
</script>

<template>
	<aside
		class="rp-editor-inspector"
		tabindex="-1"
		data-rp-region="inspector"
		:aria-label="tr('editor.inspector')"
	>
		<h2 class="rp-editor-panel-title">
			{{ tr('editor.inspector') }}
		</h2>
		<FloorInspector v-if="selectedIds.length === 0" />
		<p
			v-else-if="selectedIds.length > 1"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.multiple') }}
		</p>
		<RoomInspector v-else />
	</aside>
</template>
