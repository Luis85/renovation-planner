<script setup lang="ts">
/**
 * **Used in plans** — which plans place this definition, drawn before any impactful change to
 * it (AD13 item 3, C11's *"show impact scope"*).
 *
 * **A SECOND section beside `AssetInspectorUsedIn`, not a widening of it.** That one groups the
 * REQUIREMENTS referencing this asset by project; this one names the PLANS whose geometry
 * places it. An asset can be placed on a plan with no requirement anywhere and required with
 * nothing placed, so neither list is a subset of the other and one section drawing both would
 * be one heading over two different claims.
 *
 * **It owns its own read rather than joining `AssetSelectionStore`, and that is a lease rather
 * than a preference** — the store is integrator-owned this wave. It costs nothing that matters
 * here: the read is a SNAPSHOT taken at selection exactly as *Used in* is, it needs no
 * cross-component sharing, and `createTicketedSection` is the mechanism the store itself uses,
 * so the generation rule that drops a late answer is the same one and not a second spelling of
 * it.
 *
 * **Three states plus an ADDITIVE fourth, and the fourth is the one that earns its place.**
 * Loading, refused and ready are `Used in`'s own three, for its own reason: *I could not find
 * out who uses this* and *nobody uses this* are the difference between a safe change and a
 * blind one. The fourth is `unreadable > 0` on a ready answer — some plans could not be read,
 * so the list is real and incomplete, which is neither a refusal nor a clean scope. Folding it
 * into either would be C08's *"a failed read is not 'asset missing'"* broken at the one surface
 * whose whole job is to state a blast radius.
 *
 * **The read is GATED on `indexScanCompleted()`, and that gate is this section's and not the
 * query's.** `ListPlansUsingAsset` refuses when a port refuses, which covers a vault that
 * cannot be read — it does not cover an index that is legitimately EMPTY, because both
 * repositories it walks enumerate `index.getIdsByType` and answer `ok` over an empty one. The
 * initial scan runs from `onLayoutReady`, so before it there is a real state in which this
 * section would draw *no plan places this asset* over a vault full of plans that place it, at
 * the one surface whose job is to state a blast radius. Asked per read and never captured, for
 * `AssetLibraryDeps.indexScanCompleted`'s own stated reason: it turns true once per session and
 * a section holding `false` would refuse every authoritative answer for the rest of its life.
 *
 * **Today that state is unreachable THROUGH THIS MOUNT, which is why the gate is here rather
 * than nowhere.** `AssetUsageScope` is drawn only inside `AssetUsageDuplicate`, which
 * `AssetInspector` draws only on a `ready` entry, which `AssetLibraryStore.hydrate` withholds
 * until the scan has run — so the property is held today by a different file with nothing tying
 * the two together, and the next caller of this query reintroduces the defect silently. One ask
 * at the dispatch is cheaper than a comment asking the next author to remember.
 *
 * **What it DRAWS is the refusal state, deliberately reusing that sentence rather than minting a
 * fifth one.** *The plans that place this asset could not be read, so the scope below is
 * unknown* is true of a scan that has not run, and the only distinction that matters to a user
 * here is unknown-versus-none: a panel reading *no plan places this asset* invites a change,
 * and one reading *unknown* does not. A dedicated string would add a sixth key to this section
 * and a sixth German line for a state whose remedy — reselect, or wait for the scan — is the
 * refusal's own remedy, and this section's four drawn states are already the most any inspector
 * section has.
 *
 * **No control is drawn here.** The rows are not links: opening a plan from the library is the
 * designer→plan navigation half of AD13, which is another worker's lease this wave, and a row
 * that looked clickable and did nothing would be exactly the dead control this expansion has
 * already shipped three times. A retry is not offered either — the refusal is re-run by
 * reselecting, which is the same answer `AssetInspectorUsedIn` gives, and the inspector's own
 * retry button covers the sections that have one.
 */
import { computed, ref, watch } from 'vue';
import type { AppError } from '../../core/errors/AppError';
import type { AssetPlanUsage } from '../../application/queries/ListPlansUsingAsset';
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { createTicketedSection } from './ticketedSection';

const props = defineProps<{ assetId: AssetId }>();

const context = useAssetLibraryContext();
const EMPTY: AssetPlanUsage = { plans: [], unreadable: 0 };
const section = createTicketedSection<AssetPlanUsage, AppError>(EMPTY);

/** Was the index scanned when this section last read — see the header's gate paragraph. */
const scanned = ref(false);

watch(
	() => props.assetId,
	(assetId) => {
		// `clear()` first, so a selection CHANGE draws a blank moment rather than one asset's
		// plan list under another asset's name — `createTicketedSection`'s own stated rule for
		// why `run` does not flip a populated section back to `loading`.
		section.clear();
		scanned.value = context.indexScanCompleted();
		if (!scanned.value) return;
		void section.run(() => context.commands.listPlansUsingAsset.execute(assetId));
	},
	{ immediate: true },
);

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
	<section class="rp-al-inspector__section">
		<h4 class="rp-al-inspector__title">
			{{ tr('view.asset-library.used-in-plans') }}
		</h4>
		<!-- The unknown-scope arm shares the refusal's sentence and its place in the order, so no
		     state below it can draw over a scope nobody could look up. -->
		<p
			v-if="!scanned || section.status.value === 'failed'"
			class="rp-al-inspector__refusal"
		>
			{{ failureLabel }}
		</p>
		<p
			v-else-if="section.status.value === 'idle' || section.status.value === 'loading'"
			class="rp-al-note"
		>
			{{ tr('view.asset-library.used-in-plans.loading') }}
		</p>
		<template v-else>
			<ul
				v-if="rows.length > 0"
				class="rp-al-used"
			>
				<li
					v-for="row in rows"
					:key="row.planId"
					class="rp-al-used__row"
					:data-plan-id="row.planId"
				>
					<span class="rp-al-used__project">{{ row.label }}</span>
				</li>
			</ul>
			<p
				v-else
				class="rp-al-note"
			>
				{{ tr('view.asset-library.used-in-plans.none') }}
			</p>
			<p
				v-if="unreadable > 0"
				class="rp-al-note"
				data-usage-incomplete="true"
			>
				{{ tr('view.asset-library.used-in-plans.unreadable', { count: String(unreadable) }) }}
			</p>
		</template>
	</section>
</template>
