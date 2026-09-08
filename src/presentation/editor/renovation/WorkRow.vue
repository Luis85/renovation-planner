<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { blockingWork, type Renovation, type WorkPackage } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
const props = defineProps<{ item: WorkPackage; value: Renovation; index: number }>();
const emit = defineEmits<{ remove: [id: string, name: string] }>();
const actions = useEditorRuntime().renovation, session = useRenovationSession();
function outcomeLabel(id: string) {
	const subject = props.value.subjects.find(item => item.id === id);
	return subject?.planned?.description || subject?.existing?.description;
}
</script>
<template>
	<li
		:data-rp-record="item.id"
		:class="{ 'is-selected': session.focusedId === item.id || item.outcomes.includes(session.focusedId) }"
	>
		<button
			type="button"
			@click="actions.focus(item.roomId, 'work', item.id)"
		>
			{{ index + 1 }}. {{ item.title }}
		</button>
		<p>{{ item.description }}</p>
		<p>{{ tr(`renovation.progress.${item.progress}`) }} · {{ tr(item.responsibility === 'diy' ? 'renovation.diy' : 'renovation.unassigned') }}</p>
		<p v-if="blockingWork(value, item).length">
			{{ tr('renovation.blocked', { names: blockingWork(value, item).map(other => other.title).join(', ') }) }}
		</p>
		<button
			type="button"
			:disabled="actions.blocked.value"
			data-rp-action="work-record"
			@click="actions.edit('work', item.roomId, item.id)"
		>
			{{ tr('renovation.edit') }}
		</button>
		<button
			v-for="id in item.outcomes"
			:key="id"
			type="button"
			@click="actions.focus(item.roomId, 'planned', id)"
		>
			{{ tr('renovation.outcomes') }}: {{ outcomeLabel(id) }}
		</button>
		<button
			type="button"
			:disabled="actions.blocked.value"
			@click="emit('remove', item.id, item.title)"
		>
			{{ tr('renovation.delete') }}
		</button>
		<button
			v-if="context.commands.planning"
			type="button"
			@click="actions.focus(item.roomId, 'materials', item.id)"
		>
			{{ tr('renovation.materials') }}
		</button>
	</li>
</template>
