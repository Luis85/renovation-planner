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
import ProjectFilter from './ProjectFilter.vue';
import { isCompleted, nameCollator, orderProjects } from './projectOrder';
import { matchesQuery } from './projectFilter';
import { currentLanguage, tr } from '../i18n/strings';

/**
 * `unreadable` is REQUIRED rather than optional, and the reason is the one
 * `ProjectSummaryDto.libraryOverlap` already gives one layer up: an absent field and a zero
 * read identically at the site that renders them, so an optional one that a mount forgot would
 * draw no partial-read notice and nothing anywhere would say so. There is one production mount
 * (`ViewRoot`), which is what makes the compiler's check cheap.
 */
const props = defineProps<{ projects: readonly ProjectSummaryDto[]; unreadable: number }>();
/**
 * `create` widened to carry the typed query (Task 7, design spec §3/§9's `Filtered to
 * nothing` row): the header button emits `''`, and the no-match block's own action emits
 * whatever the user had typed, so a query that matched nothing becomes the fastest path to
 * the project that did not exist yet.
 */
defineEmits<{ open: [projectId: string]; create: [initialName: string]; createAsset: [] }>();

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

/**
 * NOT PERSISTED, per §7 — it resets on remount, which is every navigation. A query surviving a
 * round trip into a project would have the pane come back showing a filtered vault the user has
 * no memory of typing.
 */
const query = ref('');

const ordered = computed(() => orderProjects(props.projects, collator, sortKeys));

/**
 * The filter applies ABOVE the group split, so both groups narrow together. Filtering each
 * group separately would work identically today and would be a second answer to what is being
 * shown the moment §5's Continue group arrives — and the `Completed ({count})` summary would
 * then claim a row the filter had excluded.
 */
const matching = computed(() =>
	ordered.value.filter((project) => matchesQuery(project.name, query.value, collator)),
);
const active = computed(() => matching.value.filter((project) => !isCompleted(project)));
const completed = computed(() => matching.value.filter(isCompleted));

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
			@click="$emit('create', '')"
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
	<!--
		REGION 2, guarded on "at least one project loaded" — the spec's own condition, and
		load-bearing rather than defensive. `selectRenovationProjectEmptyState` answers `null` on
		`unreadable > 0` BEFORE it looks at the length, so a vault whose every project note
		refused mounts this component with `projects: []`. Unguarded the line would state
		`0 projects` about a vault that demonstrably holds projects this build could not read —
		the notice below it contradicted by the line above it.

		`@cancel` is deliberately unhandled until Task 8, which is where Escape's two meanings
		(clear a query, or hand focus to the first row when there is none) are built.
	-->
	<ProjectFilter
		v-if="projects.length > 0"
		:query="query"
		:shown="matching.length"
		:total="projects.length"
		@update:query="query = $event"
	/>
	<!--
		REGION 6, and it lives HERE rather than in `ViewRoot` because that is where §5 puts it.
		`ViewRoot` rendered it AFTER `<ProjectList>`, which was correct while the list was a bare
		`<ul>` — this task and the four after it move the header, the filter, both groups and the
		foot line inside, so left where it was the sentence saying some projects could not be
		read would sit under thirty rows of the ones that could.
	-->
	<p
		v-if="unreadable > 0"
		class="rp-view-notice"
		role="status"
	>
		{{ tr('view.project.some-unreadable') }}
	</p>
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
					:collator="collator"
					:query="query"
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
					:collator="collator"
					:query="query"
					@open="(id) => $emit('open', id)"
				/>
			</li>
		</ul>
	</details>
	<!--
		THE SIGNATURE INTERACTION (design spec §3). A query that matches nothing offers to
		become a project: the dead end is turned into the fastest path to the thing the user
		was looking for and did not have. It is what a launcher is FOR, and it is why this
		block carries an action rather than only a sentence.

		Never the empty state. `renovationProject.noProjects` is a claim about the VAULT and
		this is a claim about the QUERY — a vault with fifty projects can be here.
	-->
	<div
		v-if="query.trim().length > 0 && matching.length === 0"
		class="rp-project-list__no-match"
	>
		<p class="rp-project-list__no-match-line">
			{{ tr('view.project.filter.none', { query: query.trim() }) }}
		</p>
		<button
			type="button"
			class="rp-project-list__clear-filter"
			@click="query = ''"
		>
			{{ tr('view.project.filter.clear') }}
		</button>
		<button
			type="button"
			class="rp-project-list__create-named"
			@click="$emit('create', query.trim())"
		>
			{{ tr('view.project.create-named', { query: query.trim() }) }}
		</button>
	</div>
</template>
