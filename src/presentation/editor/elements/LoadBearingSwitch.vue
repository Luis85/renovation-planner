<script setup lang="ts">
import { computed } from 'vue';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
const props = defineProps<{ element: SpatialElement }>();
const runtime = useEditorRuntime(), session = useRenovationSession();
/** Only a post or a beam carries the fact, and it is edited as plan geometry. */
const shown = computed(() => (props.element.kind === 'post' || props.element.kind === 'beam') && session.perspective === 'plan');
function toggle(event: Event): void {
	// The saved projection answers the checked state once the write lands; a refused write leaves it unchanged.
	event.preventDefault();
	if (!runtime.elementActions.blocked.value) void runtime.elementActions.setLoadBearing(props.element.id, props.element.loadBearing !== true);
}
</script>
<template>
	<label
		v-if="shown"
		class="rp-dialog-field"
	>
		<input
			type="checkbox"
			name="load-bearing"
			:checked="element.loadBearing === true"
			:aria-disabled="runtime.elementActions.blocked.value"
			@click="toggle"
		>
		{{ tr('editor.structural.load-bearing') }}
	</label>
</template>
