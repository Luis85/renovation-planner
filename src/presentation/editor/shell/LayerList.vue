<script setup lang="ts">
/**
 * One labelled checkbox per `LayerEntry`, plus — on the one entry that carries one — a Set
 * scale action button. `entries` is a PROP (the design spec's own two-entry catalogue), not
 * a query this component makes itself, so an overlay elsewhere in the shell can hand it the
 * same list without re-deriving it.
 *
 * A real checkbox with a real `<label for>`, not a styled `<div>` with a click handler — §85
 * wants keyboard-accessible controls and semantic labels, and the platform control already is
 * both.
 */
import { useId } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import type { LayerEntry } from '../layers/layerCatalogue';

defineProps<{ entries: readonly LayerEntry[] }>();
const emit = defineEmits<{ activateTool: [toolId: 'calibrate'] }>();

const workspace = useWorkspaceStore();
const { layerVisibility } = storeToRefs(workspace);

/**
 * A TOTAL record over `LayerEntry['id']`, every id called unconditionally — never derived
 * from `entries` at call time, because `entries` starts as an empty array before the plan
 * has hydrated and grows to two once it has: a length-dependent `useId()` call would answer
 * a different count on the render that adds the rows it needs one for. Three ids per entry
 * rather than two: the checkbox and ITS reason are two elements the checkbox's own
 * `aria-describedby` can target, and `actionReason` is a THIRD, reserved for the one case
 * `actionReasonId` below actually needs a SEPARATE span for — design spec §2.9 gave Set scale
 * a reason that CAN differ from the row's own (`editor.paused.reason` against "no
 * background"), and when it does, the two controls no longer share one. When it does not
 * (no background at all, where both read the same "no background" key), Set scale points at
 * the row's OWN reason id instead and this third one goes unused — reserved rather than
 * removed, because the id has to exist unconditionally for the reason above, whether or not
 * this particular render ends up pointing anything at it.
 */
const ids: Record<LayerEntry['id'], { readonly checkbox: string; readonly reason: string; readonly actionReason: string }> = {
	reference: { checkbox: useId(), reason: useId(), actionReason: useId() },
	rooms: { checkbox: useId(), reason: useId(), actionReason: useId() },
};

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
	return entry.action.reasonKey === entry.reasonKey ? ids[entry.id].reason : ids[entry.id].actionReason;
}
</script>

<template>
	<ul class="rp-layer-list">
		<li
			v-for="entry in entries"
			:key="entry.id"
			class="rp-layer-list__row"
		>
			<input
				:id="ids[entry.id].checkbox"
				type="checkbox"
				:checked="layerVisibility[entry.konvaLayer]"
				:disabled="entry.state === 'supported-empty'"
				:aria-describedby="entry.reasonKey !== null ? ids[entry.id].reason : undefined"
				@change="workspace.toggleLayer(entry.konvaLayer)"
			>
			<label :for="ids[entry.id].checkbox">{{ tr(entry.labelKey) }}</label>
			<span
				v-if="entry.reasonKey !== null"
				:id="ids[entry.id].reason"
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
				v-if="entry.action !== null && !entry.action.enabled && entry.action.reasonKey !== entry.reasonKey"
				:id="ids[entry.id].actionReason"
				class="rp-layer-list__reason"
			>{{ tr(entry.action.reasonKey) }}</span>
		</li>
	</ul>
</template>
