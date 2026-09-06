<script setup lang="ts">
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { createEntityId } from '../../../core/identity/generateId';
import { tr } from '../../i18n/strings';
const draft = defineModel<PlanningDraft>('draft', { required: true });
defineProps<{ baseline: PlanningBaseline; paused: boolean }>();
function add(): void { draft.value.facts.push({ id: createEntityId('fact'), stage: 'committed', amount: '', description: '', commitmentId: '', cancelled: false }); }
</script>
<template>
	<label>{{ tr('planning.category') }}<select
		v-model="draft.category"
		:disabled="paused"
		name="category"
	><option
		v-for="category in ['material', 'labor', 'other'] as const"
		:key="category"
		:value="category"
	>{{ tr(`planning.${category}`) }}</option></select></label>
	<label>{{ tr('planning.requirement') }}<select
		v-model="draft.requirementId"
		:disabled="paused"
		name="requirement"
	><option value="">{{ tr('planning.unassigned') }}</option><option
		v-for="item in baseline.materials.filter(item => item.entity.origin.zoneId === draft.roomId)"
		:key="item.entity.id"
		:value="item.entity.id"
	>{{ baseline.catalogue.find(asset => asset.asset.id === item.entity.assetId)?.asset.name || item.entity.id }}</option></select></label>
	<label>{{ tr('planning.planned') }} ({{ baseline.currency }})<input
		v-model="draft.planned"
		:readonly="paused"
		name="planned"
		inputmode="decimal"
	></label>
	<p>{{ tr('planning.estimate-default') }}</p>
	<fieldset
		v-for="(fact, index) in draft.facts"
		:key="fact.id"
		class="rp-planning-fact"
	>
		<legend>{{ tr('planning.fact') }} {{ index + 1 }}</legend>
		<label>{{ tr('planning.stage') }}<select
			v-model="fact.stage"
			:disabled="paused"
			name="stage"
		><option value="committed">{{ tr('planning.committed') }}</option><option value="actual">{{ tr('planning.actual') }}</option></select></label>
		<label>{{ tr('planning.amount') }} ({{ baseline.currency }})<input
			v-model="fact.amount"
			:readonly="paused"
			name="amount"
			inputmode="decimal"
		></label>
		<label>{{ tr('planning.description') }}<input
			v-model="fact.description"
			:readonly="paused"
			name="fact-description"
		></label>
		<label v-if="fact.stage === 'actual'">{{ tr('planning.settles') }}<select
			v-model="fact.commitmentId"
			:disabled="paused"
			name="settles"
		><option value="">{{ tr('planning.unassigned') }}</option><option
			v-for="commitment in draft.facts.filter(item => item.stage === 'committed' && !item.cancelled)"
			:key="commitment.id"
			:value="commitment.id"
		>{{ commitment.description }} · {{ commitment.amount }}</option></select></label>
		<label><input
			v-model="fact.cancelled"
			:disabled="paused"
			type="checkbox"
		>{{ tr('planning.cancelled') }}</label>
	</fieldset>
	<button
		type="button"
		:disabled="paused"
		data-rp-add-fact
		@click="add"
	>
		{{ tr('planning.add-fact') }}
	</button>
	<label><input
		v-model="draft.cancelled"
		:disabled="paused"
		type="checkbox"
	>{{ tr('planning.cancel-obligation') }}</label>
	<p>{{ tr('planning.reconciliation-policy') }}</p>
</template>
