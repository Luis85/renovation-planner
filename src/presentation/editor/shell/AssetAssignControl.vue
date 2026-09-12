<script setup lang="ts">
/**
 * Assign asset (design slice 10), lifted out of `RoomInspector.vue` in the 2026-09-12 side panels
 * pass so its placeholder and empty-catalogue state did not push that template past fallow's
 * complexity budget. Dispatches through `runtime.commitEdit`, the Inspector store's ONE commit
 * path (§59). The id stays `rp-assign-asset`: several suites find the picker by it.
 *
 * The picker and the button take `aria-disabled` rather than the native `disabled` (side panels
 * spec §3), so the reason they name stays reachable by Tab.
 */
import { computed, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import type { ZoneId } from '../../../domain/zone/ZoneId';

const props = defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
const assetOptions = runtime.assetOptions;
const pickedAssetId = ref('');
const noAssetsId = useId();

/**
 * A paused floor's shared reason wins (design spec §2.9); otherwise an empty catalogue says why
 * the picker and Assign do nothing. Never `aria-disabled="false"`, which is why a live pair gets `{}`.
 */
const assignAttrs = computed((): Record<string, string> => {
	if (runtime.writesBlocked.value) return { 'aria-disabled': 'true', 'aria-describedby': runtime.pausedReasonId };
	return assetOptions.value.length === 0 ? { 'aria-disabled': 'true', 'aria-describedby': noAssetsId } : {};
});

/** An empty pick is inert rather than a command refused for the empty id; a paused floor refuses too. */
function assignSelected(): void {
	if (pickedAssetId.value === '' || runtime.writesBlocked.value) return;
	void runtime.commitEdit({
		kind: 'assign',
		zoneId: props.zoneId as never,
		assetId: pickedAssetId.value as never,
	});
	pickedAssetId.value = '';
}
</script>

<template>
	<div class="rp-editor-requirement-assign">
		<label for="rp-assign-asset">{{ tr('editor.inspector.assign.label') }}</label>
		<select
			id="rp-assign-asset"
			v-model="pickedAssetId"
			v-bind="assignAttrs"
		>
			<option value="">
				{{ tr('editor.inspector.assign.placeholder') }}
			</option>
			<option
				v-for="option in assetOptions"
				:key="option.id"
				:value="option.id"
			>
				{{ option.name }}
			</option>
		</select>
		<button
			type="button"
			v-bind="assignAttrs"
			@click="assignSelected"
		>
			{{ tr('editor.inspector.assign.button') }}
		</button>
		<p
			v-if="assetOptions.length === 0"
			:id="noAssetsId"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.assign.none') }}
		</p>
	</div>
</template>
