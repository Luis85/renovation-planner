<script setup lang="ts">
/**
 * Every project in the vault, one row each, and the way to add another (design slice 16).
 *
 * `ViewRoot` drew four things and no list for three slices, under a comment blaming slice 17
 * — whose document is the error-surfacing decision table and never mentions one. The list was
 * owned by no slice; it is owned here.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, and the view calls
 * `context.openProject`, which the composition root supplied because `presentation/` may not
 * reach Obsidian's vault and a `ProjectSummaryDto` carries no path.
 */
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

defineProps<{ projects: readonly ProjectSummaryDto[] }>();
defineEmits<{ open: [projectId: string]; create: [] }>();
</script>

<template>
	<div class="rp-project-list__header">
		<h2 class="rp-project-list__title">
			{{ tr('view.project.list-title') }}
		</h2>
		<button
			type="button"
			class="rp-project-list__create"
			@click="$emit('create')"
		>
			{{ tr('view.project.create') }}
		</button>
	</div>
	<ul class="rp-project-list">
		<li
			v-for="project in projects"
			:key="project.id"
		>
			<button
				type="button"
				class="rp-project-list__row"
				@click="$emit('open', project.id)"
			>
				<span class="rp-project-list__name">{{ project.name }}</span>
				<span class="rp-project-list__status">{{ statusLabel(project.status) }}</span>
			</button>
		</li>
	</ul>
</template>
