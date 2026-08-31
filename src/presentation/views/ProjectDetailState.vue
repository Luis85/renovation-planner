<script setup lang="ts">
/**
 * The Renovation Project view's DETAIL state (design slice 21): one project, its plans, and
 * the four intents that state raises — back to the list, open the project's note, open a plan,
 * create a plan.
 *
 * **Extracted from `ViewRoot` rather than written beside it, and the reason is the COMPILER, not
 * the line count.** An earlier draft of this comment said the combined file "measured 414 lines
 * against `max-lines`'s 400". That was `wc -l`, and `max-lines` is configured with
 * `skipBlankLines` and `skipComments` — these two files measure 77 and 98 EFFECTIVE lines, so
 * the cap was never close and the extraction cannot rest on it. Found by this task's reviewer,
 * and it is the ordinary shape of a false claim: a real number, measured with the wrong
 * instrument, attributed to a rule that counts something else.
 *
 * What does hold: the detail state's `projectId` is a `string | null` on `ViewRoot`: `vue-tsc` narrows a `v-if` for
 * a direct binding but not inside a template's arrow function, so every handler there needed a
 * non-null assertion the compiler could not check. A PROP is `string`, so the assertions
 * disappear rather than being written down — which is the same trade `PlanEditorRoot` makes
 * against its own shell components.
 *
 * It owns its store, its subscription and its dialog, which is what makes the split a seam
 * rather than a file boundary: the list state instantiates none of them, and `ViewRoot` keeps
 * exactly what the list state needs.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one. The classes below are
 * `styles/`-owned, assembled into one sheet.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import EmptyState from '../components/EmptyState.vue';
import ProjectDetail from './ProjectDetail.vue';
import NewPlanForm from './NewPlanForm.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { useRenovationProjectContext } from './RenovationProjectContext';
import { useProjectDetailStore } from '../stores/ProjectDetailStore';
import { cancelResultFor, useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import type { CreatePlanInput } from '../../application/commands/plan/CreatePlan';

/**
 * WHICH project this mount draws. A prop rather than a read of `context.projectId`, and never
 * reactive: the view REMOUNTS per navigation (`RenovationProjectView.sync`), so this component
 * exists for exactly one project and the two cannot disagree.
 */
const props = defineProps<{ projectId: string }>();

const context = useRenovationProjectContext();
const detail = useProjectDetailStore();
const dialogs = useDialogStore();
const {
	project,
	plans,
	status,
	error,
	emptyStateKey,
} = storeToRefs(detail);

/**
 * `FormDescriptor.busy`'s other end. ONE ref, read and written by TWO places at once: it is
 * handed to `NewPlanForm` as its own `busy` prop (which writes `submitting` into it) and to
 * `openDialog`'s descriptor (which `DialogHost` reads to refuse Escape and disable Cancel).
 * Passing it to only one of the two is this mechanism's most-repeated defect — every line reads
 * as correct and the flag never moves.
 */
const newPlanBusy = ref(false);

/**
 * The ONE read this state has, on every occasion it runs — mount, a rebuilt index, a plan
 * changed anywhere in this project, and after a successful create. A second "refresh" path
 * would be a second answer to what this pane is showing; `ViewRoot.hydrate` and
 * `PlanEditorRoot` both state the identical rule about their own.
 */
function hydrate(): Promise<void> {
	return detail.hydrate(context.queries, props.projectId, context.indexScanCompleted());
}

/**
 * `null` for a normal render — `PlanList` drawing this project's plans — or the resolved props
 * for the one key this state can be in (`renovationProject.noPlans`).
 *
 * `EMPTY_STATE_CONTENT.renovationProject` is keyed to match `selectProjectDetailEmptyState`'s
 * own return type, so a widened selector fails here at the type of this lookup rather than at a
 * runtime `undefined`. It is handed DOWN to `ProjectDetail`, which draws it inside its plans
 * region: an empty state replacing the whole detail state would take the Back and Open note
 * controls with it, which is slice 14's own rule about a region and the thing it exists to show.
 */
const emptyState = computed(() => {
	const key = emptyStateKey.value;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.renovationProject[key]);
});

/**
 * Non-null exactly when the read failed: `hydrate` clears `error` before every read and `fail`
 * is its only writer. Branching on the error rather than on the status keeps this to one arm,
 * exactly as `ViewRoot`'s `failure` does for the list.
 *
 * The mapped SENTENCE and no retry, which is where this deliberately stops short of slice 17's
 * `ViewFailure`: that component's headline copy names the LIST ("Projects could not be
 * loaded"), so giving the detail state a failure state of its own is a surface with its own
 * copy rather than a line of wiring here. `.rp-view-message` is the region the loading line
 * already lives in, and the two are the same kind of claim about a read.
 */
const failureMessage = computed(() => (error.value === null ? null : trError(error.value)));

/**
 * The detail header's **Open note** action, and the one gesture here that has to do more than
 * it says. It is what is left of `ViewRoot.onOpenProject`: criterion 1 makes a project row a
 * NAVIGATION, so the list no longer opens `Project.md` at all and this is the only surface that
 * does.
 *
 * `'missing'` means the id resolved to nothing, so what is drawn is stale — and THIS state is
 * what re-reads, never the list. That read answers `ok(null)`, settles `'gone'`, and the pane
 * draws the screen that says so. Re-reading the LIST from here would refresh something nobody is
 * looking at, which is what an earlier draft of this slice's plan specified: the user would have
 * sat on a project whose note is gone with no correction coming.
 *
 * `'failed'` is not a stale id — the composition root has already put a notice in front of the
 * user for it, and what is behind the action is not stale.
 */
async function onOpenNote(): Promise<void> {
	if ((await context.openProject(props.projectId)) === 'missing') await hydrate();
}

/**
 * The plans region's hand-off, from BOTH controls that raise it — the empty state's action and
 * `PlanList`'s own header button — for the reason `ViewRoot.onCreateProject` states about its
 * own two: one handler, never two independently-decided ways to open the same form.
 *
 * `dialogs.openDialog` THROWS `DialogStackingError` while a dialog is already open, so the guard
 * is the same `dialogs.current` check that sibling uses: the first call sets `current` before
 * its own `await` yields, so two clicks in one synchronous tick still only ever reach it once.
 *
 * The form OWNS its dispatch (`NewPlanForm`'s own docblock says why), so this awaits the
 * dialog's result and re-reads on a submit: without that, a created plan is written and never
 * appears, which is indistinguishable from a create that silently failed.
 */
async function onCreatePlan(): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		// Resolved by the CALLER, never by the dialog — slice 15's rule, and neither half of it
		// is caught by lint, since a descriptor's `title:` is none of `I18N_LITERAL_BAN`'s four
		// call sites.
		title: tr('form.new-plan.title'),
		component: NewPlanForm,
		props: {
			projectId: props.projectId,
			dispatch: (input: CreatePlanInput) => context.commands.createPlan.execute(input),
			busy: newPlanBusy,
			// `useFormCommit` has one door no guard stands behind — a dispatch that THROWS —
			// where the unmapped cause is the only detail that exists at all.
			logger: context.commands.logger,
			/**
			 * A mounted component's EMIT, reached from a descriptor: `FormDialog` spreads
			 * `descriptor.props` onto the component with `v-bind`, and Vue reads an `onXxx` prop
			 * as the listener for `xxx`. Verified by driving this path end to end
			 * (`viewRootProjectDetail.test.ts`) rather than by reading the spread, because a
			 * forwarding that silently did not happen looks exactly like a refusal that never
			 * fired.
			 */
			onProjectGone: () => {
				// The one `CreatePlanCommand` refusal that reaches the user through neither of
				// `useFormCommit`'s doors — and since the `'gone'` state stopped redirecting, it
				// reaches them through the SCREEN rather than through a notice. `markGone`
				// settles the state the command is authoritative about (the store's own docblock
				// carries why a re-read is the weaker answer), and the `v-else-if` below draws
				// it.
				//
				// **The notice that used to sit here was `notifyWarning(tr('view.project.gone'))`
				// — the same key the screen's headline resolves — so the two said one sentence
				// twice, at once, in two surfaces.** That is slice 17's double-report shape, and
				// the channel to keep is the one that stays: the screen persists with a way back,
				// where a notice is a remark about a gesture. Dropping it narrows criterion 4,
				// which is recorded in `docs/tasks/21` rather than left to be rediscovered.
				detail.markGone();
				// The form is now moot, and nothing else retires it: with the redirect gone there
				// is no remount for `DialogHost.onBeforeUnmount` to settle it from, so it would
				// otherwise float over the screen saying its project does not exist. Resolved
				// from the OPENER — see `dialog-store.ts`'s `resolve` for why that is a different
				// actor from the kind components the single-settle rule is about.
				dialogs.resolve(cancelResultFor('form'));
			},
		},
		busy: newPlanBusy,
	});
	if (result === 'cancel') return;
	await hydrate();
}

onMounted(() => {
	void hydrate();
});

/**
 * Two subscriptions, one disposal each. `onProjectsChanged` is the index rebuild — a leaf
 * restored BEFORE `onLayoutReady` read an empty index and would otherwise draw a project that
 * "does not exist" forever — and `onPlansChanged` is this project's own plans moving under it,
 * which is what a plan created in another leaf, a sync, or a hand-edited note produces.
 *
 * Registered at setup and disposed on unmount, the same shape and for the same reason as
 * `PlanEditorRoot`'s `onPlanChanged`: Obsidian REUSES a view, so a listener outliving its Vue
 * app would re-hydrate a store nothing renders and stack another on the next open.
 */
onBeforeUnmount(
	context.onProjectsChanged(() => {
		void hydrate();
	}),
);

onBeforeUnmount(
	context.onPlansChanged(props.projectId, () => {
		void hydrate();
	}),
);
</script>

<template>
	<ProjectDetail
		v-if="status === 'ready' && project !== null"
		:project="project"
		:plans="plans"
		:empty-state="emptyState"
		@back="context.navigate(null)"
		@open-note="() => void onOpenNote()"
		@open-plan="(planId) => void context.openPlan(planId)"
		@create-plan="() => void onCreatePlan()"
	/>
	<!--
		**`'gone'` is a SCREEN, and since this task it is the only answer to a project that is not
		there.** It shipped as a fallback under a `watch(status)` that navigated back to the list
		on `'gone'`; that watcher is retired, and the argument is a history entry nobody asked
		for. `RenovationProjectView.setState` sets `ViewStateResult.history` for any accepted,
		changed state and cannot tell a deliberate navigation from a correction — measured, all
		three of list→project, project→list (corrective) and a back-arrow-shaped restore answer
		`true` — so the redirect put the DEAD project on the back stack, and Back restored it,
		re-read it, found it still gone and bounced forward again.

		Two candidate fixes were raised on PR 42. Threading a `corrective` flag from the caller
		down to `setState` keeps the redirect and adds a context seam, a mutable one-shot flag on
		a view instance, and a lifetime question (`navigateToProject` DROPS a superseded write, so
		a flag set and never consumed poisons the next navigation) — and every claim about what it
		buys lives in Obsidian's history semantics, which `FakeLeaf` cannot answer. Retiring the
		watcher instead removes the entry, the bounce and a mechanism, and what it leaves behind
		is checkable right here: Back restores the dead project and this screen draws, which is a
		true and actionable picture rather than a redirect that looks like nothing happened.

		What it costs is stated where it is paid: the user is no longer moved for them. This
		screen is what makes that the better half — it names what happened and its action is a
		DELIBERATE navigation, so the entry Obsidian records for it is one the user asked for.

		**No `heading-level`, so this takes `EmptyState`'s default `<h2>`** — and that is the
		component's own rule rather than a preference: an empty state that REPLACES a region
		inherits that region's heading level, and one EMBEDDED in a section takes the section's.
		This one replaces the whole view, so `ProjectDetail` and its project `<h2>` are not
		rendered at all and an `<h3>` here would announce a subsection with no parent. The
		no-plans state a few lines away is the embedded case and does pass `3`.

		The first version of this branch passed `3`, one commit after that rule was written into
		`EmptyState`'s docblock — the prop added to tell those two cases apart, applied to the
		wrong one. Reported by a review bot.
	-->
	<EmptyState
		v-else-if="status === 'gone'"
		:headline="tr('view.project.gone')"
		:body="tr('view.project.gone-body')"
		:action-label="tr('view.project.back')"
		@action="context.navigate(null)"
	/>
	<div
		v-else
		class="rp-view-message"
	>
		<p v-if="failureMessage !== null">
			{{ failureMessage }}
		</p>
		<p v-else>
			{{ tr('view.project.loading') }}
		</p>
	</div>
</template>
