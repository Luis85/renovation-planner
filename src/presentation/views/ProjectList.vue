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
import { isProjectStatus } from '../../domain/project/ProjectStatus';
import { PROJECT_STATUS_LABELS } from './projectStatusLabels';
import { tr } from '../i18n/strings';

defineProps<{ projects: readonly ProjectSummaryDto[] }>();
defineEmits<{ open: [projectId: string]; create: [] }>();

/**
 * `ProjectSummaryDto.status` is typed `string`, not `ProjectStatus` — a project note this
 * build cannot recognise the lifecycle stage of is still a project this list must draw a row
 * for, so this cannot refuse the way `PROJECT_STATUS_LABELS[status]` alone would (an index
 * outside `Record<ProjectStatus, StringKey>`'s domain, `undefined` at runtime through the
 * type system's back). A recognised status resolves through the same label table
 * `NewProjectForm` uses, via `tr`; an unrecognised one renders as the raw value it actually
 * is, deliberately, rather than inventing a locale key for a value nothing in the domain
 * can produce today (`Project.create` refuses any `status` that fails `isProjectStatus`) —
 * the fallback exists for a note this build cannot fully make sense of, not for a value this
 * build itself would ever write.
 */
function statusLabel(status: string): string {
	return isProjectStatus(status) ? tr(PROJECT_STATUS_LABELS[status]) : status;
}
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
				<!--
					PRD §83's only surface. A MARK and a WORD, never one: the CSS-drawn triangle
					lives on the class's `::before` and the translated sentence is the element's
					own text, so the row says what is wrong to a reader who cannot see the colour
					and to one who cannot see the glyph alike.
				-->
				<span
					v-if="project.libraryOverlap"
					class="rp-project-list__overlap"
				>{{ tr('view.project.library-overlap') }}</span>
			</button>
		</li>
	</ul>
</template>
