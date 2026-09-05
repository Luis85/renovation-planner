<script setup lang="ts">
/**
 * §3.5 section 2 — **Shape**: everything §3.4 sends here because it is mush at 20px.
 *
 * | Row | Shows | Absent |
 * | --- | --- | --- |
 * | Footprint | the extent derived from the outline | omitted |
 * | Clearance | its own extent | `None` |
 * | Spec sheet | the file's name | omitted |
 *
 * plus a pending warning **per coordinate group** — `AssetShape` carries `footprintPending`
 * and `clearancePending` independently, so a typed footprint can sit beside a clearance traced
 * before a scale existed and each row withholds its own unit.
 *
 * **The anchor and the facing are NOT here**, reversing what §3.4 once promised: an anchor
 * coordinate answers nothing about finding an asset, correcting its price or seeing where it
 * is used, and the Asset designer DRAWS them one click away where they can be read rather than
 * parsed.
 *
 * **THREE STATES, because `GetAssetDesign` returns the sidecar's error rather than a DTO** and
 * §4's whole-catalogue failure row cannot cover it — replacing the panel because a sidecar will
 * not parse would hide a name, a price and a supplier that are fine.
 *
 * **Neither the in-flight state nor the refused one may state an ABSENCE.** `None` is only
 * true once a read has ANSWERED; a `None` drawn while the read is out reports *this asset has
 * no clearance boundary* on evidence nothing returned. So Footprint and Clearance are inside
 * the answered branch and nowhere else. **The spec sheet survives both**, because its reference
 * rides on `CatalogueEntryDto` from the catalogue read, which succeeded — and it is the one
 * thing a user can act on when a shape will not parse.
 *
 * The refusal wording is **keyed on the CODE, never on the union arm** (§3.5's own table): the
 * arms cannot make the distinction, since `AssetGeometryStore` raises all four damaged-sidecar
 * failures as `PersistenceError`/`ValidationError` while `GeometryError` reaches the query from
 * `dimensionsOf` and is not a damaged file at all.
 *
 * `Open designer` lives in the panel's Actions row rather than here — see `AssetInspector.vue`,
 * which withdraws it for every refusal this section can report.
 */
import AssetMark from './AssetMark.vue';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import { computed } from 'vue';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { AssetBackgroundRef } from '../../domain/asset/Asset';
import type { Dimensions } from '../../domain/asset/AssetShape';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import type { SectionStatus } from './ticketedSection';

const props = defineProps<{
	design: AssetDesignDto | null;
	status: SectionStatus;
	error: AssetDesignError | null;
	/** From the CATALOGUE read, never from the design one — which is what lets this row survive
	 *  a sidecar that refused. */
	background: AssetBackgroundRef | null;
}>();

/**
 * The spec sheet's own name, from the reference's path.
 *
 * §3.5 asks for the file's NAME and omits the row when there is none, so the basename is the
 * whole of what this computes and the `page` a PDF reference carries is deliberately dropped —
 * that page is what the designer needs to open the right sheet, and printing it here would be
 * inventing a row the inventory does not ask for. `split('/')` rather than a path helper: an
 * Obsidian vault path is `/`-separated on every platform, which is the one thing
 * `normalizePath` guarantees about it.
 */
const specSheet = computed((): string | null => {
	const path = props.background?.path;
	if (path === undefined) return null;
	return path.slice(path.lastIndexOf('/') + 1);
});

/**
 * `1200 × 190 mm`, or the same figures with the unit WITHHELD while the group is pending —
 * §3.4's own rule, so nothing recites a placeholder number as a measurement. Raw and unrounded,
 * matching `DesignerInspector.vue`'s established convention for this exact value.
 */
function extentText(extent: Dimensions, pending: boolean): string {
	return `${String(extent.width)} × ${String(extent.depth)}${pending ? '' : ' mm'}`;
}

/** The design ONLY once the read has answered — `null` through both unanswered states, which is
 *  what keeps every row below from stating an absence nothing returned. */
const answered = computed((): AssetDesignDto | null =>
	props.status === 'ready' ? props.design : null,
);

/**
 * One flag per COORDINATE GROUP, resolved once. A shape that has not been read has neither
 * pending, which is why both fall back to `false` rather than to a shape-level state — a single
 * one would print `1200 × 700 mm` over placeholder-space coordinates for the group that is not
 * pending.
 */
const pending = computed(() => {
	const shape = answered.value?.shape ?? null;
	return {
		footprint: shape?.footprintPending ?? false,
		clearance: shape?.clearancePending ?? false,
	};
});

const footprint = computed((): string | null => {
	const design = answered.value;
	if (design === null || design.dimensions === null) return null;
	return extentText(design.dimensions, pending.value.footprint);
});

/** `None` is a real absence and is drawn ONLY from the answered branch (§3.5). */
const clearance = computed((): string | null => {
	const design = answered.value;
	if (design === null) return null;
	if (design.clearanceExtent === null) return tr('view.asset-library.none');
	return extentText(design.clearanceExtent, pending.value.clearance);
});

/** One warning per coordinate group, never one per shape. The footprint's reuses the designer's
 *  own key — both surfaces ask about the identical fact, and a second translation of one
 *  sentence is a second place for the two to drift apart. */
const warnings = computed((): readonly string[] => {
	const notes: string[] = [];
	if (pending.value.footprint) notes.push(tr('designer.inspector.dimensions.unscaled'));
	// No `clearance !== null` conjunct beside it: `validateAssetShape` refuses an ABSENT
	// clearance still marked pending, so the pair this guard would exclude cannot be STORED —
	// a defensive arm no fixture can reach reads as checked and is not.
	if (pending.value.clearance) notes.push(tr('view.asset-library.clearance.unscaled'));
	return notes;
});

/**
 * §3.5's refusal table, keyed on the code.
 *
 * `asset.not-found` is narrower than the panel-level *gone* state: this is the shape read alone
 * finding no such asset. `asset-geometry.unusable-id` is split out of the damaged-sidecar group
 * because `AssetGeometryStore.pathFor` refuses it BEFORE looking for a sidecar at all — so
 * there is no file that could not be read and no path to name, and telling the user otherwise
 * would be a wrong sentence rather than a missing one. A `Geometry` category is `dimensionsOf`
 * overflowing on a sidecar that READ perfectly well. Everything else — every other
 * `asset-geometry.*`, and every domain `asset.*`/`calibration.*` code from a sidecar that
 * parsed and failed validation — names the sidecar from the read model's own `sidecarPath`,
 * which is the only structured place that path exists.
 */
const refusal = computed((): string | null => {
	const error = props.error;
	if (props.status !== 'failed' || error === null) return null;
	if (error.code === 'asset.not-found') return tr('view.asset-library.shape.gone');
	if (error.code === 'asset-geometry.unusable-id') return tr('view.asset-library.shape.unusable-id');
	if (error.category === 'Geometry') return tr('view.asset-library.shape.extent-overflow');
	if (error.sidecarPath !== undefined) {
		return tr('view.asset-library.shape.read-failed', { path: error.sidecarPath });
	}
	// A vault read that failed before any sidecar was named: the mapped sentence for its own
	// code, rather than a fabricated path.
	return trError(error);
});
const outline = computed((): AssetOutline | null => {
	const design = answered.value;
	if (design === null) return null;
	if (design.shape === null || design.dimensions === null) return { kind: 'none' };
	return { kind: design.dimensionsUnscaled ? 'unscaled' : 'measured',
		points: design.shape.footprint.points, extent: design.dimensions };
});
</script>

<template>
	<section class="rp-al-inspector__section">
		<h4 class="rp-al-inspector__title">
			{{ tr('view.asset-library.shape') }}
		</h4>
		<p
			v-if="status === 'idle' || status === 'loading'"
			class="rp-al-note"
		>
			{{ tr('view.asset-library.shape.loading') }}
		</p>
		<p
			v-else-if="refusal !== null"
			class="rp-al-inspector__refusal"
		>
			{{ refusal }}
		</p>
		<div
			v-if="outline !== null"
			class="rp-al-shape-preview"
		>
			<AssetMark :outline="outline" />
			<p
				v-if="outline.kind === 'none'"
				class="rp-al-note"
			>
				{{ tr('view.asset-library.shape.none') }}
			</p>
		</div>
		<dl class="rp-al-fields">
			<template v-if="footprint !== null">
				<dt class="rp-al-fields__key">
					{{ tr('view.asset-library.footprint') }}
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ footprint }}
				</dd>
			</template>
			<template v-if="clearance !== null">
				<dt class="rp-al-fields__key">
					{{ tr('view.asset-library.clearance') }}
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ clearance }}
				</dd>
			</template>
			<template v-if="specSheet !== null">
				<dt class="rp-al-fields__key">
					{{ tr('view.asset-library.spec-sheet') }}
				</dt>
				<dd class="rp-al-fields__value">
					{{ specSheet }}
				</dd>
			</template>
		</dl>
		<p
			v-for="note in warnings"
			:key="note"
			class="rp-al-note"
		>
			{{ note }}
		</p>
	</section>
</template>
