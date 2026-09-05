<script setup lang="ts">
import { tr } from '../i18n/strings';
defineProps<{ message: string | null; projectId: string | null }>();
defineEmits<{ retry: []; openProject: [] }>();
</script>

<template>
	<section
		v-if="message !== null"
		class="rp-resume-recovery"
		role="status"
	>
		<p>{{ message }}</p>
		<button
			type="button"
			@click="$emit('retry')"
		>
			{{ tr('view.project.resume-retry') }}
		</button>
		<button
			v-if="projectId !== null"
			type="button"
			@click="$emit('openProject')"
		>
			{{ tr('view.project.resume-open-project') }}
		</button>
	</section>
</template>
