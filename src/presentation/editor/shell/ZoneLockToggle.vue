<script setup lang="ts">
/**
 * The non-canvas route that locks or unlocks one zone (ADR-0027). It reads the zone's CURRENT
 * version and details and dispatches one `details` edit through the Inspector's one commit path,
 * so a lock is a single undo step with the same conflict and refresh behaviour as a rename.
 *
 * The `locked` prop only draws the state; the forward and inverse values come from the read, so a
 * stale list row cannot dispatch the wrong direction.
 */
import { computed, ref } from 'vue';
import { GetZone } from '../../../application/queries/GetZone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';

const props = defineProps<{ zoneId: string; name: string; locked: boolean }>();
const context = usePlanEditorContext();
const runtime = useEditorRuntime();
const busy = ref(false);
const label = computed(() => tr(props.locked ? 'editor.input.unlock' : 'editor.input.lock', { name: props.name }));

/**
 * Design spec §2.9's pause pairing, same shape as `RoomInspector.vue`'s `pausedAttrs` and the
 * `runtime.writesBlocked.value ? runtime.pausedReasonId : undefined` ternary `AddMenu.vue`,
 * `NewRoomInspector.vue` and `TemporaryToolBanner.vue` already use: `aria-disabled="true"`
 * never travels without `aria-describedby` naming why. `busy` (this toggle's own in-flight
 * guard, not a reason a screen reader can be told) disables the button without describedby —
 * only `paused` pairs the two, which is the one case this finding asks for.
 */
const paused = computed(() => runtime.writesBlocked.value);
const disabled = computed(() => paused.value || busy.value);

async function toggle(): Promise<void> {
	if (busy.value || runtime.writesBlocked.value) return;
	busy.value = true;
	try {
		const zoneId = props.zoneId as ZoneId;
		const loaded = await new GetZone(context.commands.zones).execute({ zoneId });
		if (!loaded.ok) { notifyOperationFailure(loaded.error); return; }
		if (loaded.value === null) return;
		const { entity, version } = loaded.value;
		const details = { name: entity.name, zoneType: entity.zoneType };
		await runtime.commitEdit({
			kind: 'details', zoneId, expected: version,
			forward: { ...details, locked: !entity.locked },
			inverse: { ...details, locked: entity.locked },
		});
	} catch (cause) {
		notifyFault(cause, context.commands.logger, 'editor.zone-lock.failed');
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<button
		type="button"
		class="rp-editor-inspector-lock"
		:data-rp-lock="zoneId"
		:aria-pressed="locked"
		:aria-label="label"
		:aria-disabled="disabled || undefined"
		:aria-describedby="paused ? runtime.pausedReasonId : undefined"
		@click="toggle"
	>
		<HostIcon :name="locked ? 'lock' : 'lock-open'" />
	</button>
</template>
