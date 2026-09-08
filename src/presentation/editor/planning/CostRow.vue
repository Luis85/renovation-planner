<script setup lang="ts">
import { computed } from 'vue';
import { formatPlanningMoney } from '../../i18n/planningFormat';
import CostTotals from './CostTotals.vue';
import type { costRows } from './planningProjection';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
const props = defineProps<{ row: ReturnType<typeof costRows>[number] }>();
const planning = usePlanningContext(), session = useRenovationSession();
const selected = computed(() => !!session.focusedId && [props.row.record.id, props.row.record.requirementId].includes(session.focusedId));
</script>
<template>
	<li
		class="rp-cost-row"
		:data-rp-record="row.record.id"
		:aria-current="selected ? 'true' : undefined"
		:class="{ 'is-selected': selected }"
	>
		<h4>{{ row.record.title }} · {{ tr(`planning.${row.record.category}`) }}</h4>
		<p v-if="selected">
			{{ tr('planning.selected') }}
		</p>
		<p class="rp-cost-work-name">
			{{ planning.baseline.value?.plan.entity.renovation?.work.find(work => work.id === row.record.workId)?.title || tr('planning.unassigned') }}
		</p>
		<p v-if="row.record.cancelled">
			{{ tr('planning.cancelled') }}
		</p><p v-if="row.stale">
			{{ tr('planning.stale') }}
		</p>
		<CostTotals
			v-if="row.totals.ok"
			:totals="row.totals.value"
		/>
		<p v-else>
			{{ tr('planning.totals-refused') }}
		</p>
		<p
			v-for="fact in row.record.facts"
			:key="fact.id"
			class="rp-record-metadata"
		>
			{{ tr(`planning.${fact.stage}`) }}: {{ formatPlanningMoney(fact.amount) }} · {{ fact.description }} · {{ row.record.facts.find(item => item.id === fact.commitmentId)?.description }} {{ fact.cancelled ? tr('planning.cancelled') : '' }}
		</p>
		<div class="rp-planning-actions">
			<button
				type="button"
				:disabled="planning.blocked.value"
				@click="planning.edit('cost', row.record.id.startsWith('estimate:') ? row.record.requirementId : row.record.id)"
			>
				{{ tr('renovation.edit') }}
			</button><button
				v-if="row.record.requirementId"
				type="button"
				@click="planning.runtime.renovation.focus(session.roomId, 'materials', row.record.requirementId)"
			>
				{{ tr('renovation.materials') }}
			</button><button
				type="button"
				@click="planning.runtime.renovation.focus(session.roomId, 'documents', row.record.id.startsWith('estimate:') ? row.record.requirementId : row.record.id)"
			>
				{{ tr('renovation.documents') }}
			</button>
		</div>
	</li>
</template>
