<script setup lang="ts">
import type { Renovation, RenovationSubject, WorkPackage } from '../../../domain/renovation/Renovation';
import SubjectRow from './SubjectRow.vue';
import WorkRow from './WorkRow.vue';
defineProps<{ mode: string; subjects: readonly RenovationSubject[]; work: readonly WorkPackage[]; value: Renovation }>();
const emit = defineEmits<{ remove: [id: string, name: string, proposalOnly?: boolean] }>();
function remove(id: string, name: string, proposalOnly = false): void { emit('remove', id, name, proposalOnly); }
</script>
<template>
	<ol
		v-if="mode !== 'work'"
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
</template>
