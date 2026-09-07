<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import TransformationSummary from './TransformationSummary.vue';
import RenovationLinkedSummary from './RenovationLinkedSummary.vue';

const props = defineProps<{ room: { readonly id: string; readonly name: string } }>();
const context = usePlanEditorContext(), runtime = useEditorRuntime();
function open(event: Event): Promise<void> {
	return runInspectorAction(event, 'review-open-room', () => Promise.resolve(runtime.renovation.focus(props.room.id, 'overview')));
}
</script>
<template>
	<div :data-rp-review-summary-room="room.id">
		<h4 class="rp-visually-hidden">
			{{ room.name }}
		</h4>
		<TransformationSummary
			:room-id="room.id"
			compact
		/>
		<RenovationLinkedSummary
			v-if="context.commands.planning"
			:room-id="room.id"
		/>
		<button
			type="button"
			class="mod-cta"
			data-rp-action="review-open-room"
			@click="open"
		>
			{{ tr('renovation.review.open-room', { name: room.name }) }}<HostIcon name="arrow-right" />
		</button>
	</div>
</template>
