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
 * **No control is drawn here.** The rows are not links: opening a plan from the library is the
 * designer→plan navigation half of AD13, which is another worker's lease this wave, and a row
 * that looked clickable and did nothing would be exactly the dead control this expansion has
 * already shipped three times. A retry is not offered either — the refusal is re-run by
 * reselecting, which is the same answer `AssetInspectorUsedIn` gives, and the inspector's own
 * retry button covers the sections that have one.
 */
import { computed, watch } from 'vue';
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

watch(
	() => props.assetId,
	(assetId) => {
		// `clear()` first, so a selection CHANGE draws a blank moment rather than one asset's
		// plan list under another asset's name — `createTicketedSection`'s own stated rule for
		// why `run` does not flip a populated section back to `loading`.
		section.clear();
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
		<p
			v-if="section.status.value === 'idle' || section.status.value === 'loading'"
			class="rp-al-note"
		>
			{{ tr('view.asset-library.used-in-plans.loading') }}
		</p>
		<p
			v-else-if="section.status.value === 'failed'"
			class="rp-al-inspector__refusal"
		>
			{{ failureLabel }}
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
