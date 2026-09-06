<script setup lang="ts">
import { formatPlanningNumber } from '../../i18n/planningFormat';
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { QUANTITY_RULES } from '../../../domain/requirement/RequirementSource';
import { tr } from '../../i18n/strings';
const draft = defineModel<PlanningDraft>('draft', { required: true });
defineProps<{ baseline: PlanningBaseline; paused: boolean }>();
</script>
<template>
	<label>{{ tr('planning.catalogue') }}
		<select
			v-model="draft.assetId"
			:disabled="paused"
			name="asset"
		>
			<option value="">{{ tr('planning.choose') }}</option>
			<option
				v-for="item in baseline.catalogue"
				:key="item.asset.id"
				:value="item.asset.id"
			>{{ item.asset.name }} · {{ item.asset.unit }} · {{ formatPlanningNumber(item.price.amount) }} {{ item.price.currency }}</option>
		</select>
	</label>
	<label>{{ tr('planning.rule') }}
		<select
			v-model="draft.source.rule"
			:disabled="paused"
			name="rule"
		><option
			v-for="rule in QUANTITY_RULES"
			:key="rule"
			:value="rule"
		>{{ tr(`planning.rule.${rule}`) }}</option></select>
	</label>
	<label>{{ tr('planning.state') }}
		<select
			v-model="draft.source.state"
			:disabled="paused"
			name="state"
		><option value="current">{{ tr('planning.current') }}</option><option value="intended">{{ tr('planning.intended') }}</option></select>
	</label>
	<label v-if="draft.source.rule === 'manual'">{{ tr('planning.manual') }}<input
		v-model="draft.source.manual"
		:readonly="paused"
		name="manual"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.waste') }}<input
		v-model="draft.waste"
		:readonly="paused"
		name="waste"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.coverage') }}<input
		v-model="draft.source.coverage"
		:readonly="paused"
		name="coverage"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.lot') }}<input
		v-model="draft.source.lot"
		:readonly="paused"
		name="lot"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.minimum') }}<input
		v-model="draft.source.minimum"
		:readonly="paused"
		name="minimum"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.override') }}<input
		v-model="draft.override"
		:readonly="paused"
		name="override"
		inputmode="decimal"
	></label>
	<label>{{ tr('planning.outcome') }}<select
		v-model="draft.source.outcomeId"
		:disabled="paused"
		name="outcome"
	><option value="">{{ tr('planning.unassigned') }}</option><option
		v-for="item in baseline.plan.entity.renovation?.subjects.filter(item => item.roomId === draft.roomId && item.planned)"
		:key="item.id"
		:value="item.id"
	>{{ item.planned?.description || item.existing?.description }}</option></select></label>
	<p>{{ tr('planning.geometry-policy') }}</p>
</template>
