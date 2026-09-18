<script setup lang="ts">
/**
 * **The designer's usage scope** — which plans place the definition this leaf is editing, stated
 * before the user edits it (ruling AD13-R1, C11's *"show impact scope"*).
 *
 * **Why the designer owes this when the library already draws one.** `AssetUsageScope.vue` stands
 * in front of **Duplicate**, and `DuplicateAssetCommand` writes a new definition and touches no
 * plan — so the disclosure that shipped precedes the one gesture on this aggregate that provably
 * changes nothing downstream. The designer is where a shared definition is actually REWRITTEN, and
 * it disclosed nothing. That asymmetry was an accident of which card reached which file, which is
 * why AD13-R1 ruled it rather than leaving it inherited.
 *
 * **A passive STATEMENT, never a confirmation** (AD13-R1 part 2). No dialog, no are-you-sure, no
 * dismiss control: it states the blast radius and stands there while the user works. A scope that
 * had to be dismissed would be read, ignored, then unread — and C12 makes selection the resting
 * mode, so a gesture-blocking panel here would be the control that can only interrupt.
 *
 * **A SECOND CONSUMER of `ListPlansUsingAsset`, never a second query** (part 3). `guardAssetUsage`
 * in `src/plugin/guardedAssetLibrary.ts` composes and guards it once, under the existing
 * `query.listPlansUsingAsset.failed` event name. Its two callers are `guardAssetDuplication` (for
 * `assetLibraryDeps`) and `assetDesignerDeps` directly. The four states below are
 * `AssetUsageScope.vue`'s own — loading, refused, ready, and ready with `unreadable > 0` — and
 * they reuse its STRINGS as well as its shape, so *some plans could not be read* has one spelling
 * across the two surfaces rather than two.
 *
 * **A grep for `new ListPlansUsingAsset` under `src/` returns TWO lines: that construction and
 * this sentence.** The first version of this paragraph said it printed one, which was false the
 * moment it was written, because the line it had not counted was itself. The invariant is still
 * one construction; the sentence about it was not. A claim about what a grep prints has to be
 * written from what the grep printed AFTER the change that makes the claim — which is the shape
 * this repository records as a category, met here from the inside.
 *
 * **NOT ONE NEW STRING, and that is a measurement rather than a preference.** This block was drafted
 * with one designer-only sentence — *editing this asset changes every plan that places it* — in a
 * new locale pair, which the wave-6 lease grants. It cannot be taken: `en.ts` counts exactly 400
 * lines against `max-lines`' 400 and `de.ts` 399, so the one import and one spread each aggregator
 * needs turn `eslint .` red at 402 and 401 (measured on this branch, both watched). The remedy is
 * headroom in two integrator-owned files, so it is an integration change request rather than
 * something to smuggle in by reformatting a budget that has already been spent. What ships instead
 * is the `Used in plans` heading the library's own panel uses, which states the same scope in the
 * same words.
 *
 * **An `h4`, not the `h3` every other inspector section takes.** Those are SIBLINGS of the asset
 * block; this is part of it — it is about the asset whose name sits directly above — and an `h3`
 * here would end the asset block before its own controls. `AssetUsageScope.vue` draws an `h4` too.
 *
 * **The read is GATED on `indexScanCompleted()`, and the gate is this component's rather than the
 * query's.** `ListPlansUsingAsset` refuses when a port refuses, which covers a vault that cannot
 * be read — it does not cover an index that is legitimately EMPTY, because both repositories it
 * walks enumerate `index.getIdsByType` and answer `ok` over an empty one. The initial scan runs
 * from `onLayoutReady`, and a designer leaf is restored from Obsidian's own workspace layout
 * before that, so an ungated read here would draw *no plan places this asset* over a vault full of
 * plans that place it — at the one surface whose entire job is to state a blast radius.
 * `AssetUsageScope.vue`'s header named that exposure exactly: *"the next caller of this query
 * reintroduces the defect silently."* This is that caller, and it asks.
 *
 * **The pre-scan state is ALMOST unreachable through this mount too, and the gate is here for
 * exactly the reason it is there: the property is held by files this one does not own.** The
 * first version of this paragraph said the opposite — *"nothing withholds this panel;
 * `AssetDesignerRoot` draws the inspector from the design read, which is dispatched at mount and
 * does not consult the index at all"* — and both halves of that are false. `AssetDesignerRoot`
 * draws `<DesignerInspector v-if="design !== null">`, and `AssetDesignStore.hydrate` HOLDS a
 * pre-scan `asset.not-found` rather than failing on it (`assetDesignStore.ts`, the
 * `isMissingAsset(found.error) && !options.indexScanCompleted` arm, whose own comment explains
 * that Obsidian restores leaves BEFORE `onLayoutReady`). So this panel is normally created only
 * after the scan — and that `v-if` is also what gives this component a FRESH setup when the
 * design finally lands, which is the whole reason capturing `scanned` once with no watch is safe.
 *
 * **"Almost" is doing real work in that sentence and is not hedging.** The store's arm holds a
 * pre-scan MISS; it does not hold a pre-scan HIT. `indexScanCompleted` is a fact about the initial
 * scan having run, not about the index containing this entry, so a design read answered from an
 * index populated by a vault-change event before `onLayoutReady` would mount this panel with the
 * scan still incomplete. That arm is narrow, it is nobody's else's to keep narrow, and it is
 * precisely the arm this gate covers.
 *
 * **What it draws for that state is the REFUSAL sentence, deliberately reusing it rather than
 * minting a fifth.** *The plans that place this asset could not be read, so the scope below is
 * unknown* is true of a scan that has not run, and the only distinction that matters to a user
 * here is unknown-versus-none: a panel reading *no plan places this asset* invites an edit, and
 * one reading *unknown* does not.
 *
 * **ONE read, at setup, with no watch.** A designer leaf is keyed by `assetId` in Obsidian's own
 * view state and REMOUNTS when that changes (`AssetDesignerContext.assetId` is a plain `string`
 * for exactly that reason, where the library's is a `Ref` because its tree updates in place), so
 * there is no selection change for a watch to answer. `createTicketedSection` is still the
 * mechanism rather than a bare `ref` pair, because its generation rule is what drops an answer
 * that arrives after the leaf has moved on, and a second spelling of that rule is the thing this
 * repository refuses everywhere it has a name for it.
 *
 * **It injects the context rather than taking props, and draws NOTHING when there is none.**
 * `DesignerInspector` is prop-driven and FOUR suites mount it bare to prove its blocks are bound —
 * `grep -rl 'mount(DesignerInspector' tests/presentation/designer` prints five files and the fifth
 * is this block's own, which provides a context — so `useAssetDesignerContext()`, which throws,
 * would make the panel un-mountable outside a leaf: the exact failure `DesignerInspector`'s own
 * `removeBackground` prop docblock records, measured there rather than argued. Absence of an
 * `AssetDesignerContext` MEANS this component is not inside a designer leaf: there is no query to
 * ask and no gate to consult, so a refusal sentence there would assert that a real read failed. In
 * a leaf the context is provided unconditionally by `AssetDesignerView`, so the disclosure cannot
 * go missing in production — and that is a claim with a check rather than a sentence:
 * `designerUsageScope.test.ts` mounts the real `DesignerInspector` with a context provided and
 * requires the block to be there.
 *
 * **No control is drawn.** The rows are not links — opening a plan from here would be a second
 * navigation door beside `DesignerUsePlan`, and a row that looked clickable and did nothing is the
 * dead control this expansion has already shipped three times. No retry either: the refusal is
 * re-run by reopening the leaf, which is the same answer `AssetUsageScope` gives.
 */
import { computed, inject, ref } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { AssetPlanUsage } from '../../../application/queries/ListPlansUsingAsset';
import { ASSET_DESIGNER_CONTEXT } from '../AssetDesignerContext';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { createTicketedSection } from '../../library/ticketedSection';

const context = inject(ASSET_DESIGNER_CONTEXT);

const EMPTY: AssetPlanUsage = { plans: [], unreadable: 0 };
const section = createTicketedSection<AssetPlanUsage, AppError>(EMPTY);

/** Was the index scanned when this panel read — see the header's gate paragraph. */
const scanned = ref(false);

if (context !== undefined) {
	scanned.value = context.indexScanCompleted();
	if (scanned.value) {
		void section.run(() => context.queries.listPlansUsingAsset(context.assetId));
	}
}

/** Whether a designer leaf is behind this mount at all — the header's last paragraph. */
const bound = context !== undefined;

const failureLabel = computed(() =>
	section.error.value === null ? tr('view.asset-library.used-in-plans.failed') : trError(section.error.value),
);

/** Named so no template reads `section.value.value`, which is a ref's value holding a field. */
const unreadable = computed(() => section.value.value.unreadable);

const rows = computed(() =>
	section.value.value.plans.map((plan) => ({
		planId: plan.planId,
		label: tr('view.asset-library.used-in-plans.plan', {
			name: plan.planName,
			count: String(plan.placements),
		}),
	})),
);
</script>

<template>
	<section
		v-if="bound"
		class="rp-designer-usage-scope"
	>
		<h4 class="rp-designer-usage-title">
			{{ tr('view.asset-library.used-in-plans') }}
		</h4>
		<!-- The unknown-scope arm shares the refusal's sentence and its place in the order, so no
		     state below it can draw over a scope nobody could look up. -->
		<p
			v-if="!scanned || section.status.value === 'failed'"
			class="rp-designer-usage-note"
		>
			{{ failureLabel }}
		</p>
		<!--
			`!== 'ready'` rather than `'idle' || 'loading'`, which is what the library's panel spells:
			the two refused statuses are already excluded above, so the only ones left here are idle,
			loading and ready — and `idle` is unreachable once the gate has passed, because `run`
			assigns `'loading'` before its first `await`. One boolean rather than a disjunction whose
			second arm no test could ever reach, which is a branch that can never pay itself back.
		-->
		<p
			v-else-if="section.status.value !== 'ready'"
			class="rp-designer-usage-note"
		>
			{{ tr('view.asset-library.used-in-plans.loading') }}
		</p>
		<template v-else>
			<ul
				v-if="rows.length > 0"
				class="rp-designer-usage-plans"
			>
				<li
					v-for="row in rows"
					:key="row.planId"
					:data-plan-id="row.planId"
				>
					{{ row.label }}
				</li>
			</ul>
			<p
				v-else
				class="rp-designer-usage-note"
			>
				{{ tr('view.asset-library.used-in-plans.none') }}
			</p>
			<p
				v-if="unreadable > 0"
				class="rp-designer-usage-note"
				data-usage-incomplete="true"
			>
				{{ tr('view.asset-library.used-in-plans.unreadable', { count: String(unreadable) }) }}
			</p>
		</template>
	</section>
</template>
