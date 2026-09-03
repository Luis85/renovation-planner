<script setup lang="ts">
/**
 * Every project in the vault, ordered and split into two groups, and the way to add another
 * (design slices 16 and this task's §8/§5).
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
import { computed, ref } from 'vue';
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import ProjectRow from './ProjectRow.vue';
import { isCompleted, nameCollator, orderProjects } from './projectOrder';
import { currentLanguage, tr } from '../i18n/strings';

const props = defineProps<{ projects: readonly ProjectSummaryDto[] }>();
defineEmits<{ open: [projectId: string]; create: []; createAsset: [] }>();

/**
 * ONE collator for this mount, built once rather than per comparison: `Intl.Collator`'s
 * construction is the expensive half and its `compare` is the cheap one, and a sort over
 * thirty rows would otherwise build thirty of them.
 *
 * Not reactive on the language, deliberately. `currentLanguage()` reads Obsidian's own setting
 * and this view remounts per navigation, so a language changed mid-session is picked up at the
 * next open — the same bound every other `tr` call on this surface has.
 */
const collator = nameCollator(currentLanguage());

/**
 * The per-mount sort keys — see `orderProjects`. A plain `Map` rather than a `ref`: it is read
 * inside the computed and never rendered, and making it reactive would re-run the sort on the
 * very writes the freeze exists to ignore.
 */
const sortKeys = new Map<string, string | null>();

const ordered = computed(() => orderProjects(props.projects, collator, sortKeys));
const active = computed(() => ordered.value.filter((project) => !isCompleted(project)));
const completed = computed(() => ordered.value.filter(isCompleted));

/**
 * The `Completed` group's disclosure state. Declared here rather than read from the `<details>`
 * element on demand, because Task 8 needs it to drive roving focus into whichever group is
 * actually open — deliberately NOT persisted across a remount, which is every navigation,
 * exactly like the filter's own query (Task 6).
 */
const completedOpen = ref(false);
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
	</div>
	<section
		v-if="active.length > 0"
		class="rp-project-list__group rp-project-list__group--projects"
	>
		<h3 class="rp-project-list__group-title">
			{{ tr('view.project.group.projects') }}
		</h3>
		<ul class="rp-project-list">
			<li
				v-for="project in active"
				:key="project.id"
			>
				<!--
					What a row IS lives in `ProjectRow.vue` from here on, and this file knows only
					that there is one per project. The Home surface grows four more regions around
					this list, and a row spelled out here would be edited by every one of them.

					It re-emits rather than handling: `ViewRoot` owns the one handler, which is design
					slice 16's division and slice 21's navigation, both unchanged by the extraction.
				-->
				<ProjectRow
					:project="project"
					@open="(id) => $emit('open', id)"
				/>
			</li>
		</ul>
	</section>
	<!--
		A native `<details>`/`<summary>`, so the disclosure state is announced by the HOST
		rather than reimplemented with ARIA — and its expanded state is deliberately NOT
		persisted: it resets on remount, which is every navigation, exactly like the filter's
		own query.
	-->
	<details
		v-if="completed.length > 0"
		class="rp-project-list__completed"
		@toggle="completedOpen = ($event.target as HTMLDetailsElement).open"
	>
		<!--
			An `<h3>` INSIDE the `<summary>`, which is what keeps both contracts: §11 asks for
			an `<h3>` per group heading and this group had only a `<summary>`, so it vanished
			from assistive-technology heading navigation while `Projects` and `Continue` were
			both listed — the one group whose contents are hidden by default being also the
			one a user could not navigate to. `<summary>` takes flow content, so the native
			disclosure and its announcement are untouched.
		-->
		<summary>
			<h3 class="rp-project-list__group-title">
				{{ tr('view.project.group.completed', { count: String(completed.length) }) }}
			</h3>
		</summary>
		<ul class="rp-project-list">
			<li
				v-for="project in completed"
				:key="project.id"
			>
				<ProjectRow
					:project="project"
					@open="(id) => $emit('open', id)"
				/>
			</li>
		</ul>
	</details>
</template>
