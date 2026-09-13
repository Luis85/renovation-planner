<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { subjectLabel, type RenovationSubject } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { toSpatialRecordDto } from '../../read-models/spatialRecords';
import { formatArea } from '../shell/formatArea';
const props = defineProps<{ item: RenovationSubject }>();
const project = useProjectStore();
const floor = computed(() => props.item.kind === 'floor' ? project.zones.get(props.item.targetId) : undefined);
const emit = defineEmits<{ remove: [id: string, name: string, proposalOnly?: boolean] }>();
const actions = useEditorRuntime().renovation, session = useRenovationSession();
const roomId = computed(() => props.item.roomId ?? '');
const focused = computed(() => session.focusedId === props.item.id);
const description = computed(() => session.mode === 'existing' ? props.item.existing?.description : props.item.planned?.description || props.item.existing?.description);
const condition = computed(() => session.mode === 'existing' ? props.item.existing?.condition : undefined);
const change = computed(() => session.mode === 'planned' ? props.item.planned?.change : undefined);
const removeLabel = computed(() => tr(session.mode === 'planned' ? 'renovation.discard' : 'renovation.delete'));
function edit(): void { actions.edit(session.mode === 'existing' ? 'existing' : 'planned', roomId.value, props.item.id); }
function remove(): void { emit('remove', props.item.id, props.item.existing?.description || subjectLabel(props.item), session.mode === 'planned'); }
</script>
<template>
	<li
		class="rp-subject-row"
		:data-rp-record="item.id"
		:class="{ 'is-selected': focused }"
	>
		<button
			type="button"
			class="rp-record-title"
			@click="actions.focus(roomId, session.mode, item.id)"
		>
			<span class="rp-subject-kind">{{ tr(`renovation.kind.${item.kind}`) }}{{ ' ' }}</span>
			<span class="rp-subject-description">{{ description }}</span>
		</button>
		<p
			v-if="condition"
			class="rp-record-metadata"
		>
			{{ tr('renovation.condition') }}: {{ tr(`renovation.condition.${condition}`) }}
		</p>
		<p
			v-if="change"
			class="rp-record-state"
		>
			{{ tr(`renovation.change.${change}`) }}
		</p>
		<details
			class="rp-record-actions"
			:open="focused"
		>
			<summary>{{ tr('renovation.record.actions') }}</summary>
			<p
				v-if="floor"
				class="rp-record-metadata"
				data-rp-subject-area
			>
				{{ formatArea(toSpatialRecordDto(floor).areaMm2) }} · {{ tr('renovation.calculated') }}
			</p>
			<div class="rp-renovation-row-actions">
				<button
					type="button"
					class="rp-record-secondary-action"
					:disabled="actions.blocked.value"
					data-rp-action="edit-record"
					@click="edit"
				>
					{{ tr('renovation.edit') }}
				</button>
				<button
					v-if="session.mode === 'existing'"
					type="button"
					class="rp-record-secondary-action"
					data-rp-action="plan-record"
					@click="actions.edit('planned', roomId, item.id)"
				>
					{{ tr('renovation.edit.planned') }}
				</button>
				<template v-else>
					<button
						type="button"
						class="rp-record-secondary-action"
						@click="actions.focus(roomId, 'work', item.id)"
					>
						{{ tr('renovation.required-work') }}
					</button>
					<button
						type="button"
						class="rp-record-secondary-action"
						data-rp-action="work-record"
						@click="actions.edit('work', roomId, item.id)"
					>
						{{ tr('renovation.new-work') }}
					</button>
					<button
						v-if="item.existing"
						type="button"
						class="rp-record-secondary-action"
						@click="actions.focus(roomId, 'existing', item.id)"
					>
						{{ tr('renovation.source') }}
					</button>
					<button
						type="button"
						class="rp-record-secondary-action"
						data-rp-action="decision-record"
						@click="actions.edit('decision', roomId, item.id)"
					>
						{{ tr('renovation.decision') }}
					</button>
				</template>
				<button
					type="button"
					class="rp-record-secondary-action"
					:disabled="actions.blocked.value"
					@click="remove"
				>
					{{ removeLabel }}
				</button>
			</div>
			<button
				v-if="context.commands.planning"
				type="button"
				class="rp-record-secondary-action"
				@click="actions.focus(roomId, 'materials', item.id)"
			>
				{{ tr('renovation.materials') }}
			</button>
		</details>
	</li>
</template>
