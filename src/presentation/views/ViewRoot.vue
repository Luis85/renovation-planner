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
import { isErr } from '../../core/result/Result';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ContinueContext } from '../../application/continueContext';
import type { PlanSummaryDto } from '../read-models/PlanDto';

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
 * The stored context, resolved against the list this mount actually read — §7's "validation is
 * a READ, not a subscription".
 *
 * The PROJECT half is a `computed` over `projects` rather than a second query: it must still
 * exist, and the list in front of us is the freshest answer to that there is. It therefore
 * re-resolves for free on every hydrate, and a project deleted underneath simply stops being
 * found — nothing redirects, nothing announces, nothing is retracted.
 *
 * The PLAN half cannot ride that list, because this surface's list holds projects. It is read by
 * `resolveStored` below and held in `storedPlan`, which is why the two halves are two fields
 * rather than one predicate — and why `resolveStored` runs on every hydrate rather than once at
 * mount. §7 says "resolve the stored ids against the project index AT HYDRATE TIME"; a mount-only
 * read does not do that, and the case it loses is the one Continue exists for. Obsidian restores
 * its leaves BEFORE `onLayoutReady` and the index scan runs FROM it (SDD §47), so a pane restored
 * with the app resolves its plan against an EMPTY index, finds nothing, and pins `storedPlan` to
 * `'gone'` for the life of that mount. The project half self-heals — it is a `computed` over
 * `projects`, which the `ProjectIndexRebuilt` subscription re-hydrates — so the two halves
 * recovered differently and only the one nothing re-ran stayed broken. Continue-across-restart is
 * exactly the flow this feature advertises, so it would have failed in its headline case.
 */
const stored = ref<ContinueContext | null>(null);
/**
 * How the stored context's PLAN resolved: `'none'` when it names no plan, `'gone'` when the
 * plan read did not find it, or the plan itself.
 *
 * **The plan rather than a boolean**, because the row has to NAME it. §7's own Continue diagram
 * is `House Renovation 2026 · Kitchen › Work`, and a first version reduced this read to
 * `true`/`false` — so the row said which project it would resume and not which plan, which on a
 * project with several plans is the one thing a user needs it to say. The read was already being
 * made; only its answer was being thrown away.
 */
const storedPlan = ref<PlanSummaryDto | 'none' | 'gone'>('gone');

const continueProject = computed(() => {
	const resume = stored.value;
	if (resume === null || storedPlan.value === 'gone') return null;
	const project = projects.value.find((candidate) => candidate.id === resume.projectId);
	if (project === undefined) return null;
	return {
		project,
		planId: resume.planId,
		plan: storedPlan.value === 'none' ? null : storedPlan.value,
	};
});

/**
 * **BOTH ids are resolved, which is what §7 asks for**: "resolve the stored ids against the
 * project index at hydrate time, and if EITHER misses, the group does not render."
 *
 * Validating only the project would leave `onResume` calling `openPlan` on a plan that is gone —
 * and `renovationProjectOpenPlan` reveals a Plan Editor leaf for that id, whose `missing` state
 * draws `editor.plan-missing.*` and asks the user to close the tab. So Continue on a deleted
 * plan would open a dead editor. The plan half costs ONE extra read, and only when a stored
 * context names a plan: the query bundle already carries `listPlansByProject`, so nothing new is
 * commissioned for it. A project whose plans could not be read is treated as a miss — the group
 * is an offer, and an offer that might open a dead editor is worse than no offer.
 *
 * Running on every hydrate makes this concurrently callable, which it was not at mount, so it
 * carries the request ticket `store.hydrate` already has: two hydrates can be in flight at once
 * — the create path awaits its own while the rebuild subscription fires — and without the ticket
 * both resolutions end in bare assignments to `stored` and `storedPlan`, so the slower earlier one
 * overwrites the newer. Worse than stale, the two fields are written at different awaits, so an
 * interleaving can leave `storedPlan` describing a different context than `stored` holds — the
 * group then vanishes or offers the wrong work. This is the same shape `ProjectStore.hydrate` and
 * `InspectorStore` already use: a store two things hydrate needs a ticket, or the slower earlier
 * read wins.
 */
let resolveTicket = 0;

async function resolveStored(): Promise<void> {
	// Taken BEFORE the first await, and compared before every assignment below: this runs on
	// every hydrate, and two hydrates can be in flight at once.
	const ticket = ++resolveTicket;
	const resume = await context.continueContext();
	if (ticket !== resolveTicket) return;

	// RESOLVED INTO LOCALS, and both refs committed together at the end. The ticket keeps two
	// concurrent resolutions from interleaving; it does nothing about the window INSIDE one, and
	// assigning `stored` here while leaving the previous `storedPlan` standing across the plan
	// lookup below would describe a context that never existed — project B with plan A — and,
	// worse, clickable: the row emits from `stored`, so a click would resume B's
	// not-yet-validated plan id, opening the dead editor this validation exists to prevent. The
	// pair is one fact and is written once.
	let plan: PlanSummaryDto | 'none' | 'gone';
	if (resume === null) {
		plan = 'gone';
	} else if (resume.planId === null) {
		plan = 'none';
	} else {
		const plans = await context.queries.listPlansByProject(resume.projectId);
		if (ticket !== resolveTicket) return;
		// The matched plan is KEPT, not counted: the row names it.
		plan = (isErr(plans) ? undefined : plans.value.plans.find((p) => p.id === resume.planId)) ?? 'gone';
	}

	stored.value = resume;
	storedPlan.value = plan;
}

/**
 * Continue's own destination, which is the whole of what makes it different from Open: it
 * restores where the user WAS — the plan editor when the context names one — while Open always
 * goes to the project's detail state.
 *
 * It goes through the SAME doors a row already uses. Nothing here reclaims a leaf by identity,
 * which is what makes surviving a restart a non-question rather than a behaviour to design.
 *
 * The `planId` branch is safe to take unguarded ONLY because `resolveStored` established that
 * the plan exists — this function has no fallback of its own and must not grow one, because a
 * fallback here would be a second answer to a question the resolution already owns.
 */
function onResume(resume: ContinueContext): void {
	if (resume.planId === null) {
		context.navigate(resume.projectId);
		return;
	}
	void context.openPlan(resume.planId);
}

/**
 * A project row's plain click, and the one place the LIST state remembers a visit: this is what
 * makes Continue offer a project again after a plan-less navigation. A NAMED function rather
 * than a template arrow doing two things — that is where the second one gets dropped by an edit
 * which only meant to change the first.
 */
function onOpenProject(id: string): void {
	context.rememberContinue({ projectId: id, planId: null });
	context.navigate(id);
}

/**
 * The ONE read this view has, on every occasion it runs — open, after a create, after a row
 * turned out to point at nothing, and after the Project Index was rebuilt underneath it. A
 * second "refresh" path would be a second answer to what this pane is showing;
 * `PlanEditorRoot` states the identical rule about its own.
 *
 * `resolveStored` rides along on every one of those occasions too — §7's own "at hydrate time"
 * — rather than a second refresh path kept beside this one, which is exactly the kind of list
 * of callers that goes stale at the fourth one.
 */
async function hydrate(): Promise<void> {
	await Promise.all([store.hydrate(context.queries), resolveStored()]);
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
 *
 * `initialName` defaults to `''` so `EmptyState`'s `@action` — which emits no payload —
 * keeps calling this with nothing, and the header button's own `create` emit carries the
 * same empty string explicitly. The Home surface's signature interaction (Task 7) is the
 * one caller that supplies a real value: a query that matched no project offers to become
 * one, and the form opens carrying what the user already typed.
 */
async function onCreateProject(initialName = ''): Promise<void> {
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
			initialName,
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
/**
 * The project's own NOTE (Task 8, design spec §7) — the middle-click and modifier-click
 * accelerators on a row. `RenovationProjectDeps.openProject` is what makes this possible from
 * here: `presentation/` may not reach Obsidian's vault and a `ProjectSummaryDto` carries no
 * path, so the composition root already resolves an id to a note.
 *
 * `'missing'` means the row pointed at a project the vault no longer holds, so the list it was
 * drawn from is stale and gets re-read — `ProjectDetailState.onOpenNote` states the identical
 * rule for its own copy of this action. `'failed'` buys no re-read: the fault door has already
 * reported it and nothing about the LIST is known to be wrong.
 */
async function onOpenNote(id: string): Promise<void> {
	if ((await context.openProject(id)) === 'missing') await hydrate();
}

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

/**
 * The ONE member `RenovationProjectView` may call in through — Task 9's `new-project` command,
 * reaching the same `onCreateProject` the pane's own header button and empty-state action
 * already dispatch through. `<script setup>` exposes NOTHING by default, so without this line
 * the view had no route to this handler at all; `RenovationProjectView.mount` casts what
 * `app.mount(...)` returns to the shape this one line puts on it, which is why a second exposed
 * member belongs here rather than at that cast.
 */
defineExpose({ openNewProjectDialog: onCreateProject });
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
						THE SAME FOOT LINE the populated state draws (design spec §5, region 7),
						so a fresh vault can still build a catalogue and the two states are one
						composition rather than two that happen to agree.

						A SIBLING of the empty state rather than a second action ON it, which is
						unchanged: `EMPTY_STATE_CONTENT` is a typed registry whose entries carry
						one action each, so a second one would be a widening every entry inherits
						for the sake of one. The key legend is omitted here — there is no list to
						navigate and no note to open, so a legend would advertise keys that do
						nothing.
					-->
					<p class="rp-project-list__foot rp-view-aside">
						<button
							type="button"
							class="rp-view-aside__create-asset"
							@click="onCreateAsset"
						>
							{{ tr('view.asset.create') }}
						</button>
					</p>
				</template>
				<!--
					`@open` NAVIGATES (design slice 21, criterion 1) rather than opening the
					project's own note, which is what it did for five slices. `Project.md` stays
					reachable from the detail header's Open note action — `ProjectDetailState`'s
					`onOpenNote`, the one caller that still opens one.
				-->
				<!--
					`unreadable` is handed DOWN rather than drawn here. The partial-read notice
					used to render as a sibling AFTER this component, which was right while the
					list was a bare `<ul>` — the Home surface puts the header, the filter, both
					groups and the foot line inside it, so §5's "above the groups" is a position
					only `ProjectList` can express. It is a required prop: an absent one and a
					zero render identically, so a forgotten one would draw no notice and say
					nothing.
				-->
				<ProjectList
					v-else
					:projects="projects"
					:unreadable="unreadable"
					:continue-project="continueProject"
					@open="onOpenProject"
					@open-note="onOpenNote"
					@create="onCreateProject"
					@create-asset="onCreateAsset"
					@resume="onResume"
				/>
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
