<script setup lang="ts">
import { computed } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import ReferenceLayerAppearance from './ReferenceLayerAppearance.vue';
import type { PlanDto } from '../../read-models/PlanDto';
import { tr } from '../../i18n/strings';
import type { LayerEntry } from '../layers/layerCatalogue';
const props = defineProps<{ entry: LayerEntry; plan?: PlanDto | null; ids: { readonly checkbox: string; readonly reason: string; readonly actionReason: string } }>();
const emit = defineEmits<{ activateTool: [toolId: 'calibrate'] }>();
const separateActionReason = computed(() => {
	const entry = props.entry;
	return entry.action !== null && !entry.action.enabled && entry.action.reasonKey !== entry.reasonKey ? entry.action.reasonKey : null;
});

/**
 * Design spec §2.9: the gate belongs here, not to the attribute alone. A paused Set scale
 * (`!entry.action.enabled`) must still be reachable by keyboard and its reason readable —
 * `aria-disabled`, never `:disabled` — so the click has to ask the same question the
 * attribute answers.
 */
function onSetScale(entry: LayerEntry): void {
	if (entry.action === null || !entry.action.enabled) return;
	emit('activateTool', entry.action.toolId);
}

/**
 * Which element Set scale's `aria-describedby` names — and, by extension, whether the
 * per-action reason span below renders at all. Design spec §2.9 gave the action its OWN
 * reason key so it can read `editor.paused.reason` where the row's own reads "no background",
 * and the two happen to be the SAME key whenever there is no background at all
 * (`layerCatalogue`'s formula answers `editor.layer.reference-plan.none` for the action in
 * that case too) — rendering a second span there repeated one sentence twice under one row,
 * which the first capture of this panel caught as a copy-paste error. Reusing the row's own
 * reason id when the keys agree changes nothing about the accessible description (the text is
 * identical either way); it only stops a second element saying it.
 */
function actionReasonId(entry: LayerEntry): string | undefined {
	if (entry.action === null || entry.action.enabled) return undefined;
	return entry.action.reasonKey === entry.reasonKey ? props.ids.reason : props.ids.actionReason;
}
</script>
<template>
	<li class="rp-layer-list__row">
		<input
			:id="ids.checkbox"
			type="checkbox"
			class="rp-visually-hidden"
			:data-rp-layer="entry.id"
			:checked="entry.visible()"
			:disabled="entry.state === 'supported-empty'"
			:aria-describedby="entry.reasonKey !== null ? ids.reason : undefined"
			@change="entry.toggle()"
		>
		<label
			:for="ids.checkbox"
			class="rp-layer-toggle"
		>
			<HostIcon :name="entry.visible() ? 'eye' : 'eye-off'" />
			<span>{{ tr(entry.labelKey) }}</span>
			<ReferenceLayerAppearance
				v-if="entry.id === 'reference' && plan?.background"
				:background="plan.background"
			/>
		</label>
		<span
			v-if="entry.reasonKey !== null"
			:id="ids.reason"
			class="rp-layer-list__reason"
		>{{ tr(entry.reasonKey) }}</span>
		<button
			v-if="entry.action !== null"
			type="button"
			class="rp-layer-list__action"
			data-rp-action="set-scale"
			:aria-disabled="!entry.action.enabled ? 'true' : undefined"
			:aria-describedby="actionReasonId(entry)"
			@click="onSetScale(entry)"
		>
			{{ tr(entry.action.labelKey) }}
		</button>
		<span
			v-if="separateActionReason !== null"
			:id="ids.actionReason"
			class="rp-layer-list__reason"
		>{{ tr(separateActionReason) }}</span>
	</li>
</template>
