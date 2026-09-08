<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { subjectLabel, type RenovationSubject } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
defineProps<{ item: RenovationSubject }>();
const emit = defineEmits<{ remove: [id: string, name: string, proposalOnly?: boolean] }>();
const actions = useEditorRuntime().renovation, session = useRenovationSession();
</script>
<template>
	<li
		class="rp-subject-row"
		:data-rp-record="item.id"
		:class="{ 'is-selected': session.focusedId === item.id }"
	>
		<button
			type="button"
			class="rp-record-title"
			@click="actions.focus(item.roomId, session.mode, item.id)"
		>
			{{ session.mode === 'existing' ? item.existing?.description : item.planned?.description || item.existing?.description }}
		</button>
		<p
			v-if="session.mode === 'existing' && item.existing"
			class="rp-record-metadata"
		>
			{{ tr(`renovation.condition.${item.existing.condition}`) }} · {{ tr('renovation.manual') }}
		</p>
		<p
			v-if="session.mode === 'planned' && item.planned"
			class="rp-record-state"
		>
			{{ tr(`renovation.change.${item.planned.change}`) }}
		</p>
		<div class="rp-renovation-row-actions">
			<button
				type="button"
				class="rp-record-secondary-action"
				:disabled="actions.blocked.value"
				data-rp-action="edit-record"
				@click="actions.edit(session.mode === 'existing' ? 'existing' : 'planned', item.roomId, item.id)"
			>
				{{ tr('renovation.edit') }}
			</button>
			<button
				v-if="session.mode === 'existing'"
				type="button"
				class="rp-record-secondary-action"
				data-rp-action="plan-record"
				@click="actions.edit('planned', item.roomId, item.id)"
			>
				{{ tr('renovation.edit.planned') }}
			</button>
			<template v-else>
				<button
					type="button"
					class="rp-record-secondary-action"
					@click="actions.focus(item.roomId, 'work', item.id)"
				>
					{{ tr('renovation.required-work') }}
				</button>
				<button
					type="button"
					class="rp-record-secondary-action"
					data-rp-action="work-record"
					@click="actions.edit('work', item.roomId, item.id)"
				>
					{{ tr('renovation.new-work') }}
				</button>
				<button
					v-if="item.existing"
					type="button"
					class="rp-record-secondary-action"
					@click="actions.focus(item.roomId, 'existing', item.id)"
				>
					{{ tr('renovation.source') }}
				</button>
				<button
					type="button"
					class="rp-record-secondary-action"
					data-rp-action="decision-record"
					@click="actions.edit('decision', item.roomId, item.id)"
				>
					{{ tr('renovation.decision') }}
				</button>
			</template>
			<button
				type="button"
				class="rp-record-secondary-action"
				:disabled="actions.blocked.value"
				@click="emit('remove', item.id, item.existing?.description || subjectLabel(item), session.mode === 'planned')"
			>
				{{ tr(session.mode === 'planned' ? 'renovation.discard' : 'renovation.delete') }}
			</button>
		</div>
		<button
			v-if="context.commands.planning"
			type="button"
			class="rp-record-secondary-action"
			@click="actions.focus(item.roomId, 'materials', item.id)"
		>
			{{ tr('renovation.materials') }}
		</button>
	</li>
</template>
