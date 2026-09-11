<script setup lang="ts">
/**
 * The Inspector's lock row, split out of `RoomInspector.vue` (Task 4) rather than left as two
 * nested `v-if`s there: the nesting pushed that template's cognitive complexity over budget
 * (`npm run analyze`, fallow's template check), the same way this task's own paused-state
 * bindings once did for `pausedAttrs`. `locked` arrives pre-resolved — the caller already folds
 * `overview` possibly being `null` into one flat boolean — so this component owns only the
 * "show the badge or not" branch and nothing about the read that produced its answer.
 */
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import ZoneLockToggle from './ZoneLockToggle.vue';

defineProps<{ zoneId: string; name: string; locked: boolean }>();
</script>

<template>
	<div class="rp-editor-inspector-lock-row">
		<span
			v-if="locked"
			class="rp-editor-inspector-locked"
		>
			<HostIcon name="lock" />{{ tr('editor.input.locked') }}
		</span>
		<ZoneLockToggle
			:zone-id="zoneId"
			:name="name"
			:locked="locked"
		/>
	</div>
</template>
