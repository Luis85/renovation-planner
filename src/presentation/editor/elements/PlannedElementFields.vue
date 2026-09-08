<script setup lang="ts">
import type { PlannedGeometryDraft } from '../renovation/plannedGeometry';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
const draft = defineModel<PlannedGeometryDraft>('draft', { required: true });
const props = defineProps<{ paused: boolean }>();
function input(index: number, axis: 'x' | 'y', event: Event): void {
	const control = event.target as HTMLInputElement, element = draft.value.element;
	if (!element) return;
	if (props.paused) { control.value = draft.value.elementEdits?.[index]?.[axis] ?? formatMetres(element.points[index][axis]); return; }
	draft.value.elementEdits = element.points.map((_, n) => ({ ...draft.value.elementEdits?.[n], ...(index === n ? { [axis]: control.value } : {}) }));
}
</script>
<template>
	<fieldset
		v-for="(point, index) in draft.element?.points ?? []"
		:key="index"
		class="rp-dialog-fields"
	>
		<legend>{{ tr('editor.area.corner', { n: String(index + 1) }) }}</legend>
		<label
			v-for="axis in ['x', 'y'] as const"
			:key="axis"
		>{{ tr(axis === 'x' ? 'editor.area.x' : 'editor.area.y') }}
			<input
				:name="'planned-' + index + '-' + axis"
				:value="draft.elementEdits?.[index]?.[axis] ?? formatMetres(point[axis])"
				type="text"
				inputmode="decimal"
				:readonly="paused"
				@input="input(index, axis, $event)"
			>
		</label>
	</fieldset>
</template>
