<script setup lang="ts">
import { computed } from 'vue';
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { hasRoomContext } from '../../../domain/renovation/SharedLinks';
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { tr } from '../../i18n/strings';
const draft = defineModel<PlanningDraft>('draft', { required: true });
const props = defineProps<{ baseline: PlanningBaseline; frozen: boolean }>();
const targets = computed(() => [...new Set([draft.value.roomId, ...props.baseline.geometry.document.structure?.elements?.map(item => item.id) ?? [], ...props.baseline.geometry.document.intended?.elements?.map(item => item.id) ?? [], ...props.baseline.geometry.document.structure?.walls.map(item => item.id) ?? [], ...props.baseline.geometry.document.structure?.openings.map(item => item.id) ?? [], ...props.baseline.geometry.document.intended?.walls.map(item => item.id) ?? [], ...props.baseline.geometry.document.intended?.openings.map(item => item.id) ?? []])]);
</script>
<template>
	<label>{{ tr('planning.target') }}<select
		v-model="draft.targetId"
		:aria-disabled="frozen"
		name="target"
		@change.capture="restoreInoperativeChoice($event, draft.targetId)"
	><option
		v-for="target in targets"
		:key="target"
		:value="target"
	>{{ target === draft.roomId ? tr('renovation.room-target') : target }}</option></select></label>
	<label>{{ tr('renovation.work') }}<select
		v-model="draft.workId"
		:aria-disabled="frozen"
		name="work"
		@change.capture="restoreInoperativeChoice($event, draft.workId)"
	><option value="">{{ tr('planning.unassigned') }}</option><option
		v-for="work in baseline.plan.entity.renovation?.work.filter(item => hasRoomContext(item, draft.roomId))"
		:key="work.id"
		:value="work.id"
	>{{ work.title }}</option></select></label>
</template>
