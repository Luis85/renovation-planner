<script setup lang="ts">
/**
 * BP-04's "choose a numbered corner": one numbered row per corner, each carrying that corner's
 * position as text and a control that chooses it, above a live region naming whichever is chosen.
 *
 * **The affordance's shape is `add/AreaCornerEditor.vue`'s, deliberately** — same numbered `<ol>`,
 * same `editor.area.corner-position` row text, same `editor.area.edit-corner` label on the row's
 * control, same `editor.area.corner` in a `role="status"` region. The two are NOT extracted into
 * one component (that is a refactor of its own, across creation and editing); what is refused
 * here is inventing a third differently-shaped corner list in the same plugin.
 *
 * **Its own component rather than markup inside `OutlinePointsForm.vue`**, because that form's
 * template is at fallow's cognitive-complexity threshold and this list's `v-if`, its `v-for` and
 * its per-row bindings pushed it over. Extracted rather than suppressed.
 *
 * It holds NO state. Which corner is chosen lives in the form beside the highlight callback that
 * has to move with it, and a corner number is a transient UI identifier BP-04 forbids persisting.
 */
import type { Point } from '../../../core/geometry/Point';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
import { computed } from 'vue';

const props = defineProps<{ points: readonly Point[]; chosen: number | null }>();
defineEmits<{ choose: [index: number] }>();

/** The resting text names the list rather than a corner, so the region is silent until used. */
const chosenLabel = computed(() => props.chosen === null
	? tr('editor.area.coordinates')
	: tr('editor.area.corner', { n: String(props.chosen + 1) }));
function cornerPosition(point: Point, index: number): string {
	return tr('editor.area.corner-position', { n: String(index + 1), x: formatMetres(point.x), y: formatMetres(point.y) });
}
function chooseLabel(index: number): string { return tr('editor.area.edit-corner', { n: String(index + 1) }); }
</script>
<template>
	<p role="status">
		{{ chosenLabel }}
	</p>
	<ol
		class="rp-dialog-corners"
		data-rp-corner-list
		:aria-label="tr('editor.area.coordinates')"
	>
		<li
			v-for="(point, index) in points"
			:key="index"
		>
			<span>{{ cornerPosition(point, index) }}</span>
			<button
				type="button"
				:aria-label="chooseLabel(index)"
				:aria-pressed="chosen === index"
				data-rp-corner="choose"
				@click="$emit('choose', index)"
			>
				{{ tr('editor.area.edit') }}
			</button>
		</li>
	</ol>
</template>
