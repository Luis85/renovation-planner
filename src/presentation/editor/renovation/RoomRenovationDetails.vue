<script setup lang="ts">
import { usePlanningContext } from '../planning/planningContext';
import PlanningInspector from '../planning/PlanningInspector.vue';
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { EMPTY_RENOVATION, orderedWork } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import type { ZoneDto } from '../../read-models/PlanDto';
import { removeRenovationRecord } from './renovationRemoval';
import { tr } from '../../i18n/strings';
import { formatArea } from '../shell/formatArea';
import { toSpatialRecordDto } from '../../read-models/spatialRecords';
import SubjectRow from './SubjectRow.vue';
import WorkRow from './WorkRow.vue';
import DecisionList from './DecisionList.vue';
import RenovationEntry from './RenovationEntry.vue';
defineProps<{ room: ZoneDto }>();
const planning = usePlanningContext();
const runtime = useEditorRuntime(), project = useProjectStore(), session = useRenovationSession(), actions = runtime.renovation;
const value = computed(() => project.plan?.renovation ?? EMPTY_RENOVATION);
const subjects = computed(() => value.value.subjects.filter(item => item.roomId === session.roomId && item[session.mode === 'existing' ? 'existing' : 'planned']));
const work = computed(() => orderedWork(value.value).filter(item => item.roomId === session.roomId));
const decisions = computed(() => value.value.decisions.filter(item => item.roomId === session.roomId));
const empty = computed(() => !(session.mode === 'work' ? work.value.length : subjects.value.length));
function remove(id: string, name: string, proposalOnly = false): void {
	const materials = planning.baseline.value?.materials.filter(({ entity }) => entity.source?.workId === id || entity.source?.outcomeId === id).map(({ entity }) => planning.baseline.value?.catalogue.find(item => item.asset.id === entity.assetId)?.asset.name ?? entity.id) ?? [];
	const depth = value.value.depth;
	const links = [...materials, ...depth?.costs.filter(item => item.workId === id).map(item => item.title) ?? [], ...depth?.evidence.filter(item => item.workId === id || item.recordId === id).map(item => item.description) ?? [], ...value.value.work.filter(item => item.outcomes.includes(id) || item.dependencies.includes(id)).map(item => item.title), ...value.value.decisions.filter(item => item.subjectId === id).map(item => item.question)];
	void actions.change(read => removeRenovationRecord(read, id, proposalOnly), tr('renovation.delete-impact', { name }) + (links.length ? ` ${tr('renovation.links', { names: links.join(', ') })}` : ''));
}
</script>
<template>
	<p>{{ formatArea(toSpatialRecordDto(room).areaMm2) }} · {{ tr('renovation.calculated') }}</p>
	<RenovationEntry :room-id="room.id" />
	<PlanningInspector v-if="!['existing', 'planned', 'work'].includes(session.mode)" />
	<template v-else>
		<button
			type="button"
			:disabled="actions.blocked.value"
			data-rp-action="new-record"
			@click="actions.edit(session.mode as 'existing' | 'planned' | 'work', room.id)"
		>
			{{ tr(`renovation.edit.${session.mode as 'existing' | 'planned' | 'work'}`) }}
		</button>
		<p v-if="empty">
			{{ tr('renovation.empty') }}
		</p>
		<ol
			v-if="session.mode !== 'work'"
			class="rp-renovation-list"
		>
			<SubjectRow
				v-for="item in subjects"
				:key="item.id"
				:item="item"
				@remove="remove"
			/>
		</ol>
		<ol
			v-else
			class="rp-renovation-list"
		>
			<WorkRow
				v-for="(item, index) in work"
				:key="item.id"
				:item="item"
				:index="index"
				:value="value"
				@remove="remove"
			/>
		</ol>
		<DecisionList
			:decisions="decisions"
			@remove="remove"
		/>
		<button
			type="button"
			@click="runtime.openPlanNote()"
		>
			{{ tr('renovation.note') }}
		</button>
	</template>
</template>
