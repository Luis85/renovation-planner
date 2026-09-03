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
import { computed, nextTick, ref, watch } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { ContinueContext } from '../../application/continueContext';
import ProjectRow from './ProjectRow.vue';
import ProjectFilter from './ProjectFilter.vue';
import ContinueRow from './ContinueRow.vue';
import { isCompleted, nameCollator, orderProjects } from './projectOrder';
import { matchesQuery } from './projectFilter';
import { currentLanguage, tr } from '../i18n/strings';
import { useRovingFocus, type RovingFocus } from './useRovingFocus';
import { modifierLabel } from './platformModifier';

/**
 * `unreadable` is REQUIRED rather than optional, and the reason is the one
 * `ProjectSummaryDto.libraryOverlap` already gives one layer up: an absent field and a zero
 * read identically at the site that renders them, so an optional one that a mount forgot would
 * draw no partial-read notice and nothing anywhere would say so. There is one production mount
 * (`ViewRoot`), which is what makes the compiler's check cheap.
 */
const props = defineProps<{
	projects: readonly ProjectSummaryDto[];
	unreadable: number;
	/**
	 * The resolved continue context, or absent. RESOLVED by the view, not by this component:
	 * §7's rule is that the group renders only when the stored context points at something that
	 * still exists, and only the view can ask.
	 */
	continueProject?: {
		project: ProjectSummaryDto;
		planId: string | null;
		plan: PlanSummaryDto | null;
	} | null;
}>();
/**
 * `create` widened to carry the typed query (Task 7, design spec §3/§9's `Filtered to
 * nothing` row): the header button emits `''`, and the no-match block's own action emits
 * whatever the user had typed, so a query that matched nothing becomes the fastest path to
 * the project that did not exist yet.
 */
defineEmits<{
	open: [projectId: string];
	/** The project's own NOTE (Task 8, design spec §7) — re-emitted from a row unchanged. */
	openNote: [projectId: string];
	create: [initialName: string];
	createAsset: [];
	/** Task 11's Continue row, re-emitted with the context it names rather than left bare. */
	resume: [context: ContinueContext];
}>();

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
 * THE FOOT LINE's key legend (design spec §5, region 7), resolved once per mount like the
 * collator: the platform does not change under a running app, and `{mod}` is a fact about the
 * machine rather than about the language, which is why it is a hole in the locale string rather
 * than a baked-in `⌘`/`Ctrl`.
 */
const keyLegend = tr('view.project.keys', { mod: modifierLabel() });

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

/**
 * ONE ROVING CONTROLLER PER ROW LIST (Task 8, design spec §7), because the tab sequence names
 * both `Projects` and the expanded `Completed` group as ONE stop each. `Completed` having its
 * own is not symmetry for its own sake: without it every completed project keeps `ProjectRow`'s
 * default `tabindex="0"`, so a vault with twenty finished projects costs twenty tabs to walk
 * past — the exact cost roving exists to remove, reintroduced in the group most likely to be
 * long.
 */
const activeList = ref<HTMLElement | null>(null);
const completedList = ref<HTMLElement | null>(null);
const activeRoving = useRovingFocus(activeList, '.rp-project-list__row');
const completedRoving = useRovingFocus(completedList, '.rp-project-list__row');

/**
 * EACH GROUP CLAMPS AGAINST ITS OWN ROWS, never against the filter's total match count.
 *
 * The two differ the moment a query matches a completed project and not an active one: with one
 * active row and two completed matches, a cursor at index 2 clamped against `matching.length`
 * (3) would not move, leaving the sole active row at `tabindex="-1"` — so Tab would skip the
 * `Projects` group for the rest of the mount, silently.
 *
 * The same watcher also clears `completedOpen` when the group empties: the disclosure is
 * recreated COLLAPSED (it sits under a `v-if` on `completed.length > 0`), so a query that
 * removes the last completed project and a later one that brings one back would otherwise mount
 * a fresh, closed element while this ref still said `true` — and `focusFirstRow` would then
 * treat rows inside a collapsed disclosure as reachable.
 */
watch(active, (rows) => activeRoving.reconcile(rows.map((row) => row.id)));
watch(completed, (rows) => {
	completedRoving.reconcile(rows.map((row) => row.id));
	if (rows.length === 0) completedOpen.value = false;
});

/** The filter's own input, so a printable character typed at a list can move focus into it. */
const filterInput = ref<InstanceType<typeof ProjectFilter> | null>(null);

/**
 * The launcher's keyboard ENTRY, and the reason no autofocus is needed: a printable character
 * typed at the list moves focus to the filter and SEEDS it with that character. Bound to both
 * lists' `@keydown`, alongside `roving.onKeydown` for the arrows.
 *
 * Seeds rather than only focusing — a user typing `cellar` must not lose the `c`.
 *
 * `Space` is CARVED OUT: `' '.length === 1`, so a bare printable-character test would admit it,
 * and a row is a `<button>` whose native activation is Enter AND Space — seeding from it would
 * either suppress that activation or do both at once. Nothing is lost, because a query never
 * usefully begins with a space.
 *
 * A modified keystroke is left alone too: `Ctrl+P` is Obsidian's command palette, and seeding
 * from it would swallow every host shortcut a user presses while a row has focus.
 */
function onListKeydown(event: KeyboardEvent, roving: RovingFocus): void {
	if (roving.onKeydown(event)) {
		event.preventDefault();
		return;
	}
	if (event.key === ' ') return;
	if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
	event.preventDefault();
	query.value = event.key;
	void nextTick(() => {
		filterInput.value?.focus();
	});
}

/**
 * Move focus to the first row the user can actually reach, and say whether there was one.
 *
 * `Projects` first, then `Completed` only while it is EXPANDED — arrowing into rows the user
 * cannot see would move focus somewhere invisible, which is worse than not moving. Falling
 * through to `Completed` is not symmetry: it is the only way into a vault whose projects are
 * all finished, or into a query that matches only completed ones. `false` means there is
 * nowhere to go — an empty vault, or a query filtered to nothing.
 *
 * A FUNCTION rather than the same two branches written twice: both `onFilterKeydown` and
 * `onFilterCancel` ask this identical question, and a second hand-written copy is exactly how
 * one of them ends up asking a narrower one by accident.
 */
function focusFirstRow(): boolean {
	if (active.value.length > 0) {
		activeRoving.focusFirst();
		return true;
	}
	if (completedOpen.value && completed.value.length > 0) {
		completedRoving.focusFirst();
		return true;
	}
	return false;
}

/**
 * The arrows work from the FILTER as well as from a list — §7's table says `filter or list`,
 * and bound to the lists alone a keyboard user reaches the field and cannot get out of it into
 * the results.
 */
function onFilterKeydown(event: KeyboardEvent): void {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
	if (focusFirstRow()) event.preventDefault();
}

/**
 * Escape's TWO meanings, which is why `ProjectFilter` emits rather than deciding: with a query
 * it clears and the caret stays; with none it hands focus to the first row — and when there is
 * no row to hand it to (filtered to nothing, or an empty vault) it does nothing at all rather
 * than dropping focus to `<body>`.
 */
function onFilterCancel(): void {
	if (query.value.length > 0) {
		query.value = '';
		return;
	}
	focusFirstRow();
}

/**
 * Named rather than left as the template's own inline expression, so the fix below and the
 * `v-if` it repairs cannot drift into asking two different questions.
 */
const filteredToNothing = computed(
	() => query.value.trim().length > 0 && matching.value.length === 0,
);

/**
 * **Both no-match actions live inside a block that UNMOUNTS the instant either one succeeds**
 * — `Clear filter` empties the query and restores every row; `New project named "…"` opens a
 * dialog whose successful create re-hydrates the list, and the created project (named from
 * this very query, by default) then matches it too. Neither button's own click handler runs
 * again after that removal, so nothing on either path moves focus — and a focused element
 * removed from the document is left on `<body>` (Chromium's own behaviour, which jsdom
 * matches), from which the next Tab restarts at the top of the document rather than at the
 * filter this block sits below.
 *
 * `flush: 'post'`, checked AFTER the unmount has actually happened: only then is `<body>` a
 * fact about what the removal DID, not a guess about what it will do. The `=== document.body`
 * test is deliberately unconditional on WHICH action fired: the create path resolves through
 * `DialogHost`'s own focus-restore, which may or may not have already run by the time this
 * watcher does (`DialogHost`'s own docblock: restoring to a removed element is "a no-op, not a
 * fallback" it declines to compensate for) — either way the observable symptom is identical
 * orphaned focus, and that is what this repairs rather than which mechanism produced it. The
 * `nextTick` wrap matches `onListKeydown`'s own hand-off to this same input further up this
 * file — harmless here, since `flush: 'post'` has already settled the DOM this watcher reads,
 * and it keeps every focus-into-the-filter call in this component the same shape.
 */
watch(
	filteredToNothing,
	(isFilteredToNothing, wasFilteredToNothing) => {
		if (wasFilteredToNothing && !isFilteredToNothing && document.activeElement === document.body) {
			void nextTick(() => {
				filterInput.value?.focus();
			});
		}
	},
	{ flush: 'post' },
);
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
	</div>
	<!--
		REGION 2, guarded on "at least one project loaded" — the spec's own condition, and
		load-bearing rather than defensive. `selectRenovationProjectEmptyState` answers `null` on
		`unreadable > 0` BEFORE it looks at the length, so a vault whose every project note
		refused mounts this component with `projects: []`. Unguarded the line would state
		`0 projects` about a vault that demonstrably holds projects this build could not read —
		the notice below it contradicted by the line above it.

		`@cancel` and `@keydown` are Task 8's: Escape's two meanings, and the arrows working
		from the field as well as from a list (§7's table says "filter or list").
	-->
	<ProjectFilter
		v-if="projects.length > 0"
		ref="filterInput"
		:query="query"
		:shown="matching.length"
		:total="projects.length"
		@update:query="query = $event"
		@cancel="onFilterCancel"
		@keydown="onFilterKeydown"
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
	<!--
		ZERO OR ONE ROW, and absent rather than empty when there is nothing to resume — not a
		placeholder, not a disabled button. With no stored context the most recently worked
		project is simply the first row of `Projects`, which is where it would be anyway.

		The project ALSO appears in `Projects` below, and the duplicate is correct: Continue
		is an action and Projects is the index, so hiding a project from the index because it
		happens to be resumable would make the index lie.
	-->
	<section
		v-if="continueProject"
		class="rp-project-list__group rp-project-list__continue"
	>
		<h3 class="rp-project-list__group-title">
			{{ tr('view.project.group.continue') }}
		</h3>
		<!--
			INSIDE a `.rp-project-list` `<ul>`, exactly like the other two groups, and that is
			load-bearing rather than tidy: every shared row declaration in `list-row.css` and
			`forms.css` is scoped `.rp-project-list .rp-project-list__row` — the descendant
			selector that beats Obsidian's own `button:not(.clickable-icon)` — so a row
			rendered outside that ancestor gets none of `display: flex`, the width, the
			padding, the 24px minimum height or the name's truncation, and the "same armature
			as every other row" claim would be false in the one place it is made.

			It also puts the row inside the container query, so the Continue row narrows with
			its siblings instead of being the one row that does not.

			A list of ONE is the right shape rather than a concession: the group is zero-or-one
			by design, and `<li>` is what `<ul>` may contain.
		-->
		<ul class="rp-project-list">
			<li>
				<ContinueRow
					:project="continueProject.project"
					:plan="continueProject.plan"
					@resume="$emit('resume', { projectId: continueProject.project.id, planId: continueProject.planId })"
					@open="$emit('open', continueProject.project.id)"
					@open-note="$emit('openNote', continueProject.project.id)"
				/>
			</li>
		</ul>
	</section>
	<section
		v-if="active.length > 0"
		class="rp-project-list__group rp-project-list__group--projects"
	>
		<h3 class="rp-project-list__group-title">
			{{ tr('view.project.group.projects') }}
		</h3>
		<ul
			ref="activeList"
			class="rp-project-list"
			@keydown="(e) => onListKeydown(e, activeRoving)"
			@focusin="activeRoving.syncFromFocus"
		>
			<li
				v-for="(project, index) in active"
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
					:tabbable="index === activeRoving.activeIndex.value"
					@open="(id) => $emit('open', id)"
					@open-note="(id) => $emit('openNote', id)"
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
		<ul
			ref="completedList"
			class="rp-project-list"
			@keydown="(e) => onListKeydown(e, completedRoving)"
			@focusin="completedRoving.syncFromFocus"
		>
			<li
				v-for="(project, index) in completed"
				:key="project.id"
			>
				<ProjectRow
					:project="project"
					:collator="collator"
					:query="query"
					:tabbable="index === completedRoving.activeIndex.value"
					@open="(id) => $emit('open', id)"
					@open-note="(id) => $emit('openNote', id)"
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
		v-if="filteredToNothing"
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
	<!--
		THE FOOT LINE (design spec §5, region 7). Present in BOTH the empty state and the
		populated one, which is what removes today's duplication: the list header's own
		`New asset` button and `ViewRoot`'s `.rp-view-aside` were two independently-decided
		homes for one action and are now one.

		BELOW the no-match block, deliberately: Task 7's review established that block as the
		last thing in the list region, and the foot has to respect that rather than reopen it.

		Its EXIT CONDITION, recorded so it is not rediscovered: this action leaves the
		surface when Epic 6's catalogue surface exists, which is where a creation action for
		a vault-wide catalogue entry belongs. Until then it is here, quiet, at the foot.
	-->
	<p class="rp-project-list__foot rp-view-aside">
		<span class="rp-project-list__keys">{{ keyLegend }}</span>
		<button
			type="button"
			class="rp-view-aside__create-asset"
			@click="$emit('createAsset')"
		>
			{{ tr('view.asset.create') }}
		</button>
	</p>
</template>
