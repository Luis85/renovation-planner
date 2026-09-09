<script setup lang="ts">
import type { ProjectSection } from '../../application/navigation/ProjectDestination';
import ProjectDetailState from './ProjectDetailState.vue';
import ProjectWorkState from './work/ProjectWorkState.vue';
import QuoteComparisonState from './quotes/QuoteComparisonState.vue';
defineProps<{ projectId: string; section?: ProjectSection; readOnlyReasonId?: string }>();
</script>
<template>
	<ProjectWorkState
		v-if="section === 'schedule'"
		:project-id="projectId"
	/>
	<QuoteComparisonState
		v-else-if="section === 'quotes'"
		:project-id="projectId"
	/>
	<ProjectDetailState
		v-else
		:project-id="projectId"
		:read-only-reason-id="readOnlyReasonId"
	/>
</template>
