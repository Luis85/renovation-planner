<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import type { PlanSummaryDto } from '../read-models/PlanDto';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { AssetId } from '../../domain/asset/AssetId';
import { isErr, ok } from '../../core/result/Result';
import { singleFlight } from '../composables/single-flight';
import type { AssetPriceCommitResult, AssetPriceEdit } from './assetPriceEdit';

const props = defineProps<{ projectId: string }>();

const context = useRenovationProjectContext();
const detail = useProjectDetailStore();
const dialogs = useDialogStore();
const {
	project,
	plans,
	unreadablePlans,
	assetPrices,
	assetPricesError,
	status,
	error,
	plansError,
	emptyStateKey,
} = storeToRefs(detail);

const newPlanBusy = ref(false);
const guidanceHidden = ref(context.session?.guidanceHidden ?? false);
const section = context.section === 'prices' ? 'prices' : 'details';
const draftReset = ref(0);
const edits = new Map<string, { dirty: boolean; pending: boolean }>();
const pricesLoading = ref(true);
const savedRefreshFailed = ref(false);
let refreshRequested = false;
let disposed = false;
function onEditState(id: string, dirty: boolean, pending: boolean): void {
	if (dirty || pending) edits.set(id, { dirty, pending });
	else edits.delete(id);
}
async function canLeave(): Promise<boolean> {
	if (Array.from(edits.values()).some((edit) => edit.pending) || dialogs.current !== null) return false;
	if (edits.size === 0) return true;
	const result = await dialogs.openDialog({ kind: 'confirm', title: tr('view.project.draft-title'),
		message: tr('view.project.draft-body'), confirmLabel: tr('view.project.draft-discard'),
		cancelLabel: tr('view.project.draft-stay') });
	if (result !== 'confirm') return false;
	draftReset.value += 1;
	edits.clear();
	return true;
}
if (context.session) context.session.canLeave = canLeave;
onBeforeUnmount(() => {
	disposed = true;
	if (context.session) delete context.session.canLeave;
	detail.reset();
});
function toggleGuidance(): void {
	guidanceHidden.value = !guidanceHidden.value;
	if (context.session) context.session.guidanceHidden = guidanceHidden.value;
}
function back(): void { context.navigate(section === 'prices' ? props.projectId : null); }

/**
 * The plan the entry region names by name, or `null`.
 *
 * Resolved HERE rather than in `ProjectDetail`, because it is a READ: `context.continueContext()`
 * is the same door `ViewRoot.resolveStored` uses, and the design spec's §7 rule for it is
 * "validation is a read, not a subscription" — so it is asked on every hydrate, beside the plan
 * list it has to be resolved against, and never subscribed to.
 */
const lastPlan = ref<PlanSummaryDto | null>(null);

let hydrateTicket = 0;

/**
 * The plan read and the stored-context read, as ONE hydrate.
 *
 * Together rather than in sequence because the second is only meaningful against the first: a
 * stored plan is `lastPlan` when it belongs to THIS project and is in the readable list, so a
 * context resolved against a stale list would name a plan this pane cannot open, and one resolved
 * before the list would have nothing to check against.
 *
 * The ticket is what a `Promise.all` costs: `onProjectsChanged` and `onPlansChanged` both call
 * this and either can land while an earlier one is still in flight, so the LAST caller's answer
 * has to be the one that writes. `disposed` says the same thing about a pane that has gone — the
 * pair `hydratePrices` already states, for the same reason.
 */
async function hydrate(): Promise<void> {
	const ticket = ++hydrateTicket;
	const [, stored] = await Promise.all([
		detail.hydrate(context.queries, props.projectId, context.indexScanCompleted()),
		context.continueContext(),
	]);
	if (disposed || ticket !== hydrateTicket) return;
	lastPlan.value =
		stored === null || stored.projectId !== props.projectId
			? null
			: plans.value.find((plan) => plan.id === stored.planId) ?? null;
}

/**
 * `'superseded'` means "the refs do not describe THIS read", and every caller that decides
 * something from them has to be told: a read the store cancelled on its ticket leaves the shared
 * `assetPricesError` holding a later read's answer, and `disposed` says the same thing about a
 * pane that has gone. Nothing after that point may write, which is why the two checks sit
 * together and why the outcome travels back out rather than being inferred at the call site.
 */
async function hydratePrices(): Promise<'landed' | 'superseded'> {
	if (disposed) return 'superseded';
	refreshRequested = false;
	const outcome = await detail.hydratePrices(context.queries, props.projectId);
	if (disposed || outcome === 'superseded') return 'superseded';
	pricesLoading.value = false;
	if (assetPricesError.value === null) savedRefreshFailed.value = false;
	return 'landed';
}

let writes = 0;
const queuePrices = singleFlight(hydratePrices);
function reloadPrices(): void {
	if (disposed) return;
	if (writes > 0) { refreshRequested = true; return; }
	queuePrices();
}

const emptyState = computed(() => {
	const key = emptyStateKey.value;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.renovationProject[key]);
});

const failureMessage = computed(() => (error.value === null ? null : trError(error.value)));

const assetPricesFailure = computed(() =>
	assetPricesError.value === null ? null : savedRefreshFailed.value ? tr('view.project.price-saved-refresh-failed') : trError(assetPricesError.value),
);

watch(status, (value) => {
	const open = dialogs.current;
	if (value === 'gone' && open !== null) dialogs.resolve(cancelResultFor(open.kind));
});

/**
 * No `canLeave()` here, deliberately (P3): opening the note leaves the pane exactly where it
 * is — no navigation, no unmount — so there is nothing for a draft to be discarded FROM. The
 * confirm dialog's discard arm exists to protect a navigation that would otherwise lose the
 * drafts in `edits`; this action does not cause one, and asking anyway made Stay the only
 * option that did nothing.
 */
async function onOpenNote(): Promise<void> {
	if ((await context.openProject(props.projectId)) === 'missing') await hydrate();
}

let opening = 0;
async function onOpenPlan(planId: string): Promise<void> {
	if (context.readOnly) return;
	const ticket = ++opening;
	if (!(await canLeave()) || disposed || ticket !== opening) return;
	if ((await context.openPlan(planId)) === 'opened' && !disposed && ticket === opening) {
		context.rememberContinue({ projectId: props.projectId, planId });
	}
}

async function onCreatePlan(): Promise<void> {
	if (context.readOnly || dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		// Resolved by the CALLER, never by the dialog — slice 15's rule, and neither half of it
		// is caught by lint, since a descriptor's `title:` is none of `I18N_LITERAL_BAN`'s
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
				// Retiring the form is NOT here. `markGone` settles the status, and the `'gone'`
				// watcher above is what closes an open dialog — for EVERY producer of that
				// status rather than for this one. A `dialogs.resolve` at this call site was the
				// first version of that and it left the READ path open; the watcher's docblock
				// carries the measurement.
				detail.markGone();
			},
		},
		busy: newPlanBusy,
	});
	if (result === 'cancel') return;
	await hydrate();
}

/**
 * The refresh a write owes, and the one place either arm of `writeAssetPrice` decides whether
 * "saved, but could not refresh" is true.
 *
 * DIRECT rather than through `queuePrices`, and that stays deliberate: a write must await ITS OWN
 * read, where the loader's contract is to collapse reads it did not issue — a write handed to it
 * would be answered by somebody else's scan or by none. Sitting outside the loader is what makes
 * the outcome load-bearing: a queued reload can land between this read and its answer, and
 * `'superseded'` is the case where this write's read decides nothing and the shared failure ref
 * speaks for the read that won.
 *
 * One function rather than the same line in both arms, so the superseded case is ONE arm with
 * one test rather than two arms with one test and a copy nothing reaches.
 */
async function refreshAfterWrite(): Promise<void> {
	if ((await hydratePrices()) === 'landed') savedRefreshFailed.value = assetPricesError.value !== null;
}

async function writeAssetPrice(edit: AssetPriceEdit): Promise<AssetPriceCommitResult> {
	const projectId = props.projectId as ProjectId;
	const assetId = edit.assetId as AssetId;
	if (edit.kind === 'clear') {
		const result = await context.commands.clearAssetPriceOverride.execute({
			projectId,
			assetId,
			expected: edit.expected,
		});
		if (isErr(result)) return { dispatch: result, settled: null };
		await refreshAfterWrite();
		// `'absent'` whether or not a note was actually removed: either way the pair now HAS no
		// override, which is what an expectation states. `cleared` is what says whether anything
		// moved, and it is the honest `DispatchOutcome` — a clear on a pair with no override
		// writes nothing and announces nothing, by that command's own design.
		return {
			dispatch: ok(result.value.cleared ? 'wrote' : 'no-write'),
			settled: 'absent',
		};
	}
	const result = await context.commands.setAssetPriceOverride.execute({
		projectId,
		assetId,
		unitCost: edit.unitCost,
		expected: edit.expected,
	});
	if (isErr(result)) return { dispatch: result, settled: null };
	await refreshAfterWrite();
	// `'wrote'` for every accepted set, including the command's own no-op arm (a price re-typed
	// to the value it already holds), which its result does not distinguish from an update:
	// `created` is false for both. Nothing on this surface reads the outcome — there is no save
	// indicator here and `useFieldCommit` asks only whether the `Result` is an error — so the
	// distinction has no consumer to be wrong for, and inventing one from the version would be a
	// second derivation of a fact the command already declines to report.
	return {
		dispatch: ok('wrote'),
		settled: { id: result.value.override.id, version: result.value.version },
	};
}

async function commitAssetPrice(edit: AssetPriceEdit): Promise<AssetPriceCommitResult> {
	writes += 1;
	try { return await writeAssetPrice(edit); }
	finally {
		writes -= 1;
		if (writes === 0 && refreshRequested) reloadPrices();
	}
}

onMounted(() => {
	void hydrate();
});

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

/**
 * The price section's mount read and both of its subscriptions, registered only when the price
 * section is what this mount DRAWS — `ViewRoot.vue:328-332`'s own rule, applied one level down:
 * re-reading a store nothing renders is a vault-wide read answering a question nobody asked, and
 * `listAssetPrices` reads the whole catalogue. The details section took one per open and one per
 * catalogue event for nothing. `onProjectPricesChanged` now carries the three requirement
 * lifecycle events as well (`RenovationProjectContext.ts:170-192`), so this gate is also what
 * stops a requirement created or deleted anywhere in this project from re-listing prices under a
 * details view that draws none.
 *
 * The mount's read goes through the LOADER rather than calling `hydratePrices` directly, so there
 * is ONE mechanism rather than two: a burst arriving while the mount's own read is still in
 * flight then collapses into that read plus one trailing one. Called directly, the mount's read
 * sits OUTSIDE the loader's window and a sync landing on it buys a third scan — measured, the
 * burst case reports 3 where 2 is asserted. `reloadAssetOptions()` in `runtime.ts` is called at
 * setup for the same reason.
 */
if (section === 'prices') {
	onMounted(reloadPrices);

	onBeforeUnmount(context.onCatalogueChanged(reloadPrices));

	onBeforeUnmount(
		context.onProjectPricesChanged((projectId) => {
			if (projectId === null || projectId === props.projectId) reloadPrices();
		}),
	);
}
</script>

<template>
	<ProjectDetail
		v-if="status === 'ready' && project !== null"
		:project="project"
		:draft-reset="draftReset"
		:section="section"
		:read-only="context.readOnly"
		:guidance-hidden="guidanceHidden"
		:plans-failure="plansError === null ? null : trError(plansError)"
		:prices-loading="pricesLoading"
		:plans="plans"
		:last-plan="lastPlan"
		:unreadable-plans="unreadablePlans"
		:empty-state="emptyState"
		:asset-prices="assetPrices"
		:asset-prices-failure="assetPricesFailure"
		:commit-asset-price="commitAssetPrice"
		:logger="context.commands.logger"
		@toggle-guidance="toggleGuidance"
		@prices="context.navigate(projectId, 'prices')"
		@schedule="context.navigate(projectId, 'schedule')"
		@quotes="context.navigate(projectId, 'quotes')"
		@refresh="reloadPrices"
		@retry-plans="hydrate"
		@edit-state="onEditState"
		@back="back"
		@open-note="() => void onOpenNote()"
		@open-plan="onOpenPlan"
		@create-plan="() => void onCreatePlan()"
	/>

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
		<button
			v-if="failureMessage !== null"
			type="button"
			@click="hydrate"
		>
			{{ tr('view.project.resume-retry') }}
		</button>
		<button
			type="button"
			@click="context.navigate(null)"
		>
			{{ tr('view.project.back') }}
		</button>
	</div>
</template>
