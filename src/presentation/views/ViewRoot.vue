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
 * beside a `PlanCanvas` stopped being a decision made ahead of its own need. It stays HERE
 * rather than moving into either state, so one host serves both and a navigation cannot leave
 * a dialog with nowhere to open.
 *
 * **Design slice 21 gave this view a second state**, and everything above describes the first
 * one. `openProjectId` decides which: `null` draws the list, a project id hands the whole
 * detail state to `ProjectDetailState`, which owns its own store, its own subscriptions and its
 * own dialog. The split is a seam rather than a file boundary — the list state instantiates
 * none of them — and its own docblock carries the two measurements that produced it.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import ProjectList from './ProjectList.vue';
import ProjectDetailState from './ProjectDetailState.vue';
import NewProjectForm from './NewProjectForm.vue';
import NewAssetForm from './NewAssetForm.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { useRenovationProjectContext } from './RenovationProjectContext';
import { useRenovationProjectStore } from '../stores/RenovationProjectStore';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { AssetId } from '../../domain/asset/AssetId';

const context = useRenovationProjectContext();
const store = useRenovationProjectStore();
const dialogs = useDialogStore();
const { projects, emptyStateKey, status, error, unreadable } = storeToRefs(store);

/**
 * WHICH STATE THIS MOUNT DRAWS, read ONCE — `null` is the list, a string is that project's
 * detail state. Nothing here is reactive on it and there is nothing to make reactive: the view
 * REMOUNTS per navigation (`RenovationProjectView.sync`), so the tree is built from this value
 * and the two cannot disagree.
 *
 * A local rather than `context.projectId` at every site, because it is what narrows: read off
 * the context each time it stays `string | null` and every detail-state use needs an assertion
 * the compiler cannot check.
 */
const openProjectId = context.projectId;

/**
 * `FormDescriptor.busy`'s other end. ONE ref, read and written by TWO places at once: it is
 * handed to `NewProjectForm` as its own `busy` prop (which writes `submitting` into it) and
 * to `openDialog`'s descriptor (which `DialogHost` reads to refuse Escape and disable
 * Cancel). Passing it to only one of the two is this mechanism's most-repeated defect —
 * every line reads as correct and the flag never moves.
 */
const newProjectBusy = ref(false);

/**
 * The same mechanism for design slice A10's form, and a SECOND ref rather than one shared
 * between the two: `busy` is read by `DialogHost` to refuse Escape and disable Cancel while a
 * write is in flight, and only one dialog is ever open, so sharing would work today and would
 * mean two forms writing one flag the moment anything opened them in sequence.
 */
const newAssetBusy = ref(false);

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
 * Design slice A10's hand-off, and `onCreateProject`'s shape exactly — including the
 * `dialogs.current` guard, which is what makes two clicks in one tick reach `openDialog`
 * once rather than throwing `DialogStackingError`.
 *
 * **It does NOT re-hydrate, and that is a difference worth stating rather than an omission.**
 * `hydrate()` re-reads the PROJECT list, and creating an asset changes nothing in it — an
 * Asset is vault-wide and carries no project id at all since design slice 19. Re-reading would
 * be a second answer to what this pane shows, produced by a gesture that did not change it.
 * There is no catalogue list on this surface for the new asset to appear in, which is why
 * what this handler does instead — since Task B9 — is open the designer on what it made:
 * `context.openAsset` is `renovationProjectOpenAsset` at the root, the same door
 * `open-asset-designer`'s palette picker opens through, so a just-created asset and a picked
 * one land in exactly one leaf either way.
 *
 * The two commands are handed down separately because the form's submit is a SEQUENCE over
 * them and it owns the ordering — see `NewAssetForm`'s header for why the pure checks run
 * before the first write and why a retry must not create a second asset.
 *
 * `result.values` is the raw payload `NewAssetForm` emitted (`FormDialogResult`'s own
 * docblock: "typed by the form's own component"), which for this form is the `AssetId` it
 * created — not an object, unlike the shape a caller might expect by analogy with a DTO.
 */
async function onCreateAsset(): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-asset.title'),
		component: NewAssetForm,
		props: {
			createAsset: (input: CreateAssetInput) => context.commands.createAsset.execute(input),
			setFootprintFromDimensions: (input: SetAssetFootprintFromDimensionsInput) =>
				context.commands.setAssetFootprintFromDimensions.execute(input),
			busy: newAssetBusy,
			// The form's own door for a dispatch that THROWS, which both of these being guarded
			// commands means they cannot — but the guard is the ROOT's property, not this call
			// site's, and `useFormCommit` requires the door rather than assuming the caller.
			logger: context.commands.logger,
			defaultCurrency: context.commands.defaultCurrency,
		},
		busy: newAssetBusy,
	});
	if (result === 'cancel') return;
	await context.openAsset(result.values as AssetId);
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


/**
 * Both of the LIST state's reads, and they are registered only when the list is what this mount
 * draws. `ProjectDetailState` owns the detail state's own mount read and its own two
 * subscriptions, so a detail mount takes neither of these — re-reading a store nothing renders
 * is a vault-wide read answering a question nobody asked.
 *
 * The subscription is the index rebuild, and the reason a view that already read needs telling:
 * Obsidian restores its leaves BEFORE `onLayoutReady`, and the index scan runs FROM it (SDD
 * §47). A pane restored with the app therefore hydrates against an empty index, is answered a
 * legitimate empty list, and draws the actionable "no projects yet" state over a vault full of
 * them — permanently, because until this subscription existed neither of the other two
 * hydrations could be reached by anything a rebuild does.
 *
 * Registered at setup and disposed on unmount, the same shape and for the same reason as
 * `PlanEditorRoot`'s `onPlanChanged`: Obsidian reuses a view, so a listener outliving its Vue
 * app would re-hydrate a store nothing renders and stack another on the next open.
 */
if (openProjectId === null) {
	onMounted(() => {
		void hydrate();
	});

	onBeforeUnmount(
		context.onProjectsChanged(() => {
			void hydrate();
		}),
	);
}
</script>

<template>
	<div class="renovation-planner-view">
		<template v-if="openProjectId === null">
			<template v-if="status === 'ready'">
				<template v-if="empty !== null">
					<EmptyState
						v-bind="empty"
						@action="onCreateProject"
					/>
					<!--
						**A fresh vault must still be able to build a catalogue.** The asset
						action lives in `ProjectList`'s header, and the list is the `v-else`
						below — so with no projects it was not mounted at all, and the only
						thing a new vault offered was creating a project. An Asset is
						VAULT-WIDE since design slice 19: it carries no project id and needs
						none.

						A SIBLING of the empty state rather than a second action ON it. The
						empty state's message is "create your first project" and its button is
						that sentence's verb; `EMPTY_STATE_CONTENT` is a typed registry whose
						entries carry one action each, so a second one would be a widening
						every entry inherits for the sake of one. This is an unrelated
						affordance and is drawn as one.

						**§2's Assets control joins it here for the identical reason.** The
						catalogue is vault-wide, so a vault with no projects can hold a full
						library — and `ProjectList`'s own header, where §2 places this control's
						other door, is not mounted in this state either. A vault that can create
						an asset and cannot list one is the same argument left half-applied.
					-->
					<p class="rp-view-aside">
						<button
							type="button"
							class="rp-view-aside__create-asset"
							@click="onCreateAsset"
						>
							{{ tr('view.asset.create') }}
						</button>
						<button
							type="button"
							class="rp-view-aside__open-library"
							@click="context.openAssetLibrary"
						>
							{{ tr('view.asset-library.door') }}
						</button>
					</p>
				</template>
				<!--
					`@open` NAVIGATES (design slice 21, criterion 1) rather than opening the
					project's own note, which is what it did for five slices. `Project.md` stays
					reachable from the detail header's Open note action — `ProjectDetailState`'s
					`onOpenNote`, the one caller that still opens one.
				-->
				<ProjectList
					v-else
					:projects="projects"
					@open="(id) => context.navigate(id)"
					@create="onCreateProject"
					@create-asset="onCreateAsset"
					@open-library="context.openAssetLibrary"
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
		</template>
		<!--
			The whole detail state, in its own component. NOT for the line cap — `max-lines` skips
			blanks and comments and neither file is near it; see `ProjectDetailState`'s own header.
			`projectId` is `string | null` here — `vue-tsc` narrows a `v-if` for a
			direct binding but not inside a template arrow function, so every handler over there
			would have needed an assertion the compiler cannot check. A prop is `string`.
		-->
		<ProjectDetailState
			v-else
			:project-id="openProjectId"
		/>
		<DialogHost />
	</div>
</template>
