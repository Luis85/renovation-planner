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
const section = context.section ?? 'details';
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

function hydrate(): Promise<void> {
	return detail.hydrate(context.queries, props.projectId, context.indexScanCompleted());
}

async function hydratePrices(): Promise<void> {
	if (disposed) return;
	refreshRequested = false;
	await detail.hydratePrices(context.queries, props.projectId);
	pricesLoading.value = false;
	if (assetPricesError.value === null) savedRefreshFailed.value = false;
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

async function onOpenNote(): Promise<void> {
	if (!(await canLeave())) return;
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
		await hydratePrices();
		savedRefreshFailed.value = assetPricesError.value !== null;
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
	await hydratePrices();
	savedRefreshFailed.value = assetPricesError.value !== null;
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
	// Through the LOADER rather than calling `hydratePrices` directly, so there is ONE mechanism
	// rather than two: a burst arriving while the mount's own read is still in flight then
	// collapses into that read plus one trailing one. Called directly, the mount's read sits
	// OUTSIDE the loader's window and a sync landing on it buys a third scan — measured, the
	// burst case reports 3 where 2 is asserted. `reloadAssetOptions()` in `runtime.ts` is called
	// at setup for the same reason.
	reloadPrices();
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

onBeforeUnmount(context.onCatalogueChanged(reloadPrices));

onBeforeUnmount(
	context.onProjectPricesChanged((projectId) => {
		if (projectId === null || projectId === props.projectId) reloadPrices();
	}),
);
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
		:unreadable-plans="unreadablePlans"
		:empty-state="emptyState"
		:asset-prices="assetPrices"
		:asset-prices-failure="assetPricesFailure"
		:commit-asset-price="commitAssetPrice"
		:logger="context.commands.logger"
		@toggle-guidance="toggleGuidance"
		@prices="context.navigate(projectId, 'prices')"
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
