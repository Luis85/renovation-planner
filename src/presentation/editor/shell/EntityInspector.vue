<script setup lang="ts">
/**
 * The Inspector FRAME (component library §8): the ONE `<aside>` and `aria-label` for §60's
 * inspector region, and the routing by `selectedIds` — the floor state
 * (`FloorInspector.vue`, Task 7's `buildFloorSummary`) while nothing is selected, the
 * multiple-selection text while several ids are, and the room body (`InspectorPanel.vue`;
 * Task 16 renames it `RoomInspector`) for exactly one. Through Task 14 `InspectorPanel.vue`
 * drew its OWN aside and decided this same routing off `InspectorStore.dto.kind`; a second
 * `<aside class="rp-editor-inspector">` nested inside the first would double the landmark
 * `shell.test.ts` asserts is singular, so Task 15 moved both up here and left the body a
 * body.
 *
 * It also owns the one `role="status"` region that announces "select something" exactly
 * once when a selection clears to nothing (design spec §6.6) — cleared shortly after so a
 * refresh or an idle pointer move over the canvas never re-announces it.
 */
import { nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import FloorInspector from './FloorInspector.vue';
import InspectorPanel from './InspectorPanel.vue'; // Task 16 renames this RoomInspector

const { selectedIds } = storeToRefs(useSelectionStore());
const guidance = ref('');

/**
 * Set SYNCHRONOUSLY, so the very next render paints it, and cleared on a real
 * `setTimeout(…, 0)` rather than on the following `nextTick()`: this store's own `settle()`
 * test helper waits out exactly one such timer, so a `nextTick()`-only clear would already be
 * gone by the time any assertion built on `settle()` ran, and the pair this announcement
 * exists to prove — "shown once, gone before the next unrelated change" — would be
 * unobservable from outside a single tick. The `await nextTick()` before arming the timer is
 * what lets a render see the guidance text before the countdown to clear it begins.
 *
 * Guarded on `previous.length > 0` rather than firing on every empty selection: the very
 * first render (`previous` is always `[]` on this watcher's own creation) must not announce
 * anything, since nothing was ever selected to clear.
 */
watch(selectedIds, async (ids, previous) => {
	if (ids.length === 0 && previous.length > 0) {
		guidance.value = tr('editor.inspector.floor.guidance');
		await nextTick();
		setTimeout(() => {
			guidance.value = '';
		}, 0);
	}
});
</script>

<template>
	<aside
		class="rp-editor-inspector"
		:aria-label="tr('editor.inspector')"
	>
		<h2 class="rp-editor-panel-title">
			{{ tr('editor.inspector') }}
		</h2>
		<p
			class="rp-inspector-guidance"
			role="status"
		>
			{{ guidance }}
		</p>
		<FloorInspector v-if="selectedIds.length === 0" />
		<p
			v-else-if="selectedIds.length > 1"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.multiple') }}
		</p>
		<InspectorPanel v-else />
	</aside>
</template>
