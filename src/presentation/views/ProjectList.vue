<script setup lang="ts">
/**
 * Every project in the vault, one row each, and the way to add another (design slice 16).
 *
 * `ViewRoot` drew four things and no list for three slices, under a comment blaming slice 17
 * — whose document is the error-surfacing decision table and never mentions one. The list was
 * owned by no slice; it is owned here.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id and the VIEW decides what that
 * means. Since design slice 21 that is `context.navigate(id)` — criterion 1 is precisely that
 * a row no longer opens `Project.md` but enters the detail state, from which `Project.md` is
 * a secondary action. This sentence named `context.openProject` for a slice after that
 * stopped being true, which is the defect `ProjectDetail.vue` records having made twice about
 * this same change: a sentence about another commit's behaviour needs re-reading by whoever
 * lands that commit, and the component the sentence is ABOUT is the one nobody re-read.
 */
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

defineProps<{ projects: readonly ProjectSummaryDto[] }>();
defineEmits<{ open: [projectId: string]; create: []; createAsset: []; openLibrary: [] }>();
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
		<!--
			Design slice A10's entry point. It sits on the LIST header rather than inside a
			project, because an Asset is vault-wide since design slice 19 — a catalogue entry
			carries no project id at all — so a per-project button would promise a scoping the
			domain does not have. It leaves with Epic 6's catalogue surface, which is where a
			creation action for a catalogue entry properly belongs.
		-->
		<button
			type="button"
			class="rp-project-list__create-asset"
			@click="$emit('createAsset')"
		>
			{{ tr('view.asset.create') }}
		</button>
		<!--
			§2's own placement: the Assets control, beside `New asset` rather than replacing it
			— this is where a user already is when the thought "have I got a definition for
			this?" arrives. Reveals the singleton library view; it opens and dispatches nothing
			itself, the same rule the row buttons above already follow.
		-->
		<button
			type="button"
			class="rp-project-list__open-library"
			@click="$emit('openLibrary')"
		>
			{{ tr('view.asset-library.door') }}
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
