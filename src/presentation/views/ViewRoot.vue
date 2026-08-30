<script setup lang="ts">
/**
 * The Vue root of the Renovation Project view — one isolated app per Obsidian `ItemView`
 * (ADR-004, SDD §12).
 *
 * It draws real content now: an empty state when the vault holds no projects (design slice
 * 14), the project list itself once one exists (design slice 16's `ProjectList`), the mapped
 * failure message when the read refused, a loading line while it is in flight, and a warning
 * strip when some project notes could not be read. For every slice before slice 14 it drew
 * nothing at all, and that used to be the increment's stated success criterion rather than an
 * omission — "an empty Renovation Planner view opens reliably inside Obsidian". That claim
 * stopped being true then, so it stopped being said here.
 *
 * The empty state is not one of those: a failed read is not "legitimately nothing yet", and
 * `emptyStateKey` is `null` from any status but `'ready'`, so the two can never be drawn
 * together. The warning strip is the one additive one — a partial read still shows what
 * loaded.
 *
 * **Failure and loading used to share one region and no longer do** (design slice 17). They
 * are different claims — "this could not be read" against "this is being read" — and the
 * failure now carries a retry, which a loading line must never grow. Sharing the region had
 * kept them one edit apart from each other.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled
 * into one sheet. The class below is that sheet's only entry point into this view.
 *
 * Slice 15's `DialogHost` mounts here too, not only in the Plan Editor — this is one of the
 * two ItemView-scoped Vue apps SDD §12 has the dialog framework mount into. Design slice 16
 * gave it its first caller in this tree: `renovationProject.noProjects`'s action opens
 * `NewProjectForm` in a `FormDialog`, which is why the host mounting here rather than only
 * beside a `PlanCanvas` stopped being a decision made ahead of its own need.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import ProjectList from './ProjectList.vue';
import NewProjectForm from './NewProjectForm.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { useRenovationProjectContext } from './RenovationProjectContext';
import { useRenovationProjectStore } from '../stores/RenovationProjectStore';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';

const context = useRenovationProjectContext();
const store = useRenovationProjectStore();
const dialogs = useDialogStore();
const { projects, emptyStateKey, status, error, unreadable } = storeToRefs(store);

/**
 * `FormDescriptor.busy`'s other end. ONE ref, read and written by TWO places at once: it is
 * handed to `NewProjectForm` as its own `busy` prop (which writes `submitting` into it) and
 * to `openDialog`'s descriptor (which `DialogHost` reads to refuse Escape and disable
 * Cancel). Passing it to only one of the two is this mechanism's most-repeated defect —
 * every line reads as correct and the flag never moves.
 */
const newProjectBusy = ref(false);

/**
 * The ONE read this view has, on every occasion it runs — open, after a create, after a row
 * turned out to point at nothing, and after the Project Index was rebuilt underneath it. A
 * second "refresh" path would be a second answer to what this pane is showing;
 * `PlanEditorRoot` states the identical rule about its own.
 */
function hydrate(): Promise<void> {
	return store.hydrate(context.queries);
}

/**
 * The empty state's hand-off, and (since Task 8) the project list header's — ONE handler
 * for both, never two independently-decided ways to open the same form. `createProject`
 * is passed as `NewProjectForm`'s own `dispatch`: the form owns its dispatch so a rejection
 * renders under the field it is about and keeps the dialog OPEN, which matters because
 * `openDialog` throws if a dialog is already open — a caller that dispatched only after
 * this one resolved could never reopen it to show an error.
 *
 * `dialogs.openDialog` THROWS `DialogStackingError` while a dialog is already open, so a
 * caller has to make it impossible to enter twice concurrently rather than trust that
 * nobody double clicks; `EmptyState`'s button has no disabled state of its own, so the guard
 * here is a plain `dialogs.current` check before the dialog is even opened — cheap enough
 * that two clicks landing in the same synchronous tick still only ever reach `openDialog`
 * once, since the first call sets `current` before its own `await` yields control back.
 *
 * The re-hydrate is not optional politeness: without it a created project is written and
 * never appears, which is indistinguishable from a create that silently failed.
 */
async function onCreateProject(): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-project.title'),
		component: NewProjectForm,
		props: {
			dispatch: (input: CreateProjectInput) => context.commands.createProject.execute(input),
			busy: newProjectBusy,
			// The form's own door for a dispatch that THROWS, which `createProject` being a
			// guarded command means it cannot — but the guard is the ROOT's property, not this
			// call site's, and `useFormCommit` requires the door rather than assuming the caller.
			logger: context.commands.logger,
		},
		busy: newProjectBusy,
	});
	if (result === 'cancel') return;
	await hydrate();
}

/**
 * A project row's click, and the one case that has to do more than open a note.
 *
 * A project note deleted after this pane was opened leaves its row on screen: the vault-change
 * pipeline drops the index entry silently, and `store.hydrate` has no listener to be woken by
 * — its two callers are `onMounted` and `onCreateProject`. So the row went on being drawn, did
 * nothing at all when clicked, and told the user nothing until the view was reopened. Reported
 * in review, against a comment in `openProjectNote` claiming the list was "re-read on the next
 * hydrate anyway", of which there was none.
 *
 * `'missing'` is that row saying so, and the re-read is what removes it. `'failed'` is not:
 * the composition root has already put a notice in front of the user for it, and the list
 * behind the row is not stale.
 */
async function onOpenProject(projectId: string): Promise<void> {
	if ((await context.openProject(projectId)) === 'missing') await hydrate();
}

/**
 * `null` for no empty state — a normal render, `ProjectList` drawing the vault's projects —
 * or the resolved props for the one key this slice's registry declares
 * (`renovationProject.noProjects`). `EMPTY_STATE_CONTENT.renovationProject` is keyed to
 * match `selectRenovationProjectEmptyState`'s own return type, so a widened selector fails
 * here at the type of this lookup rather than at a runtime `undefined`.
 */
const empty = computed(() => {
	const key = emptyStateKey.value;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.renovationProject[key]);
});

/**
 * The whole in-place failure state, or `null` when there is nothing to fail about — design
 * slice 17's answer to the case slice 14 deferred here.
 *
 * Non-null exactly when `status === 'failed'`: `hydrate` clears `error` before every read and
 * `fail` is its only writer. Branching on the error rather than on the status keeps this to
 * one arm instead of two.
 *
 * `trError` is what turns the stored `AppError` into the sentence for its own code — so
 * unrecovered settings say one thing and a vault fault says another — rather than one generic
 * line standing in for both. That was already true of the message; what slice 17 adds is that
 * the ACTION differs too.
 *
 * **The retry is withheld from a bootstrap failure, and that is the whole difference between
 * the two states this returns.** `surfaceFor` answers `session-failure` for a session that
 * composed no query services at all, and re-running a query that was never wired would do
 * nothing while looking like it might — the "live control that does nothing" slice 14's own
 * amendment refuses. Slice 1 settled the recovery: fix `data.json` and reload. The settings
 * tab is where that is said, and this surface exists so a user is not left staring at a blank
 * pane wondering why.
 *
 * ONE computed rather than three, because the headline, the body and the action are three
 * answers to one question and splitting them would let a later edit give a session failure a
 * retry while its headline still said it could not start.
 */
const failure = computed(() => {
	if (error.value === null) return null;
	const session =
		surfaceFor(error.value, viewHydrationOrigin(error.value)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'view.project.failed.headline'),
		body: trError(error.value),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

onMounted(() => {
	void hydrate();
});

/**
 * The index rebuild, and why a view that already read needs telling.
 *
 * Obsidian restores its leaves BEFORE `onLayoutReady`, and the index scan runs FROM it (SDD
 * §47). A pane restored with the app therefore hydrates against an empty index, is answered a
 * legitimate empty list, and draws the actionable "no projects yet" state over a vault full
 * of them — permanently, because until this subscription existed neither of the other two
 * hydrations could be reached by anything a rebuild does.
 *
 * Registered at setup and disposed on unmount, the same shape and for the same reason as
 * `PlanEditorRoot`'s `onPlanChanged`: Obsidian reuses a view, so a listener outliving its Vue
 * app would re-hydrate a store nothing renders and stack another on the next open.
 */
onBeforeUnmount(
	context.onProjectsChanged(() => {
		void hydrate();
	}),
);
</script>

<template>
	<div class="renovation-planner-view">
		<template v-if="status === 'ready'">
			<EmptyState
				v-if="empty !== null"
				v-bind="empty"
				@action="onCreateProject"
			/>
			<ProjectList
				v-else
				:projects="projects"
				@open="(id) => void onOpenProject(id)"
				@create="onCreateProject"
			/>
			<p
				v-if="unreadable > 0"
				class="rp-view-notice"
				role="status"
			>
				{{ tr('view.project.some-unreadable') }}
			</p>
		</template>
		<ViewFailure
			v-else-if="failure !== null"
			v-bind="failure"
			@action="() => void hydrate()"
		/>
		<div
			v-else
			class="rp-view-message"
		>
			<p>{{ tr('view.project.loading') }}</p>
		</div>
		<DialogHost />
	</div>
</template>
