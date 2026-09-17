<script setup lang="ts">
/**
 * WHERE a plan positions this object and WHICH WAY it faces (AD12 item 2, contract C04): the
 * placement point as a named choice — centre, back centre, or a custom point the user placed —
 * and the front direction as a sentence rather than as an angle.
 *
 * **Neither label is copied from a mockup.** C04 requires direction labels to agree with actual
 * placement and AD01 §3 names `set-facing-tool.ts` as the shipped authority; every direction
 * here is computed in `DesignerReferenceFrame.ts` from `AssetShape.facing`, the same number
 * `anchorLayer.facingArrow` draws the arrow from. So "back centre" is the middle of the far side
 * of the facing-frame box, opposite the arrow by construction, at any rotation and after any
 * mirror — there is no second derivation for the two to disagree about.
 *
 * **This does not replace the anchor's numeric fields.** `DesignerSelectionInspector` still
 * offers x and y when the anchor itself is selected, and that is the "custom" this panel names
 * rather than a third way of moving the same point: the presets write through the same
 * `moveAnchor` those fields do.
 *
 * **A preset anchor takes the FOOTPRINT's coordinate space, and says so in what it writes.** The
 * point is derived from the outline, so `anchorPending` becomes `footprintPending` — an anchor
 * computed off a footprint still in sheet pixels IS in sheet pixels. Leaving the flag alone
 * would be exactly C07's silent combination of two coordinate spaces, and the calibration that
 * converts the footprint would then leave the anchor behind.
 *
 * **A press that would change nothing writes nothing** (C05): pressing Centre on an object
 * already anchored at its centre answers `editShape`'s `null`, which dispatches no
 * `SetAssetShape` and pushes no undo entry.
 */
import { computed, ref } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { AppError } from '../../../core/errors/AppError';
import { coincident } from '../../../core/geometry/operations';
import { moveAnchor } from '../../../domain/asset/shapeEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import type { EditShape } from '../selection/editShape';
import { anchorPresetPoint, currentAnchorPreset, facingQuarter, type AnchorPreset } from './DesignerReferenceFrame';

const props = defineProps<{ design: AssetDesignDto; editShape: EditShape }>();

const PRESETS: readonly { readonly preset: AnchorPreset; readonly label: StringKey }[] = [
	{ preset: 'centre', label: 'designer.placement.centre' },
	{ preset: 'back-centre', label: 'designer.placement.back-centre' },
];

/** In quarter order — 0 is +x, and +y renders DOWN the sheet (`Viewport.sceneConfig` never flips it). */
const FRONT_LABELS: readonly StringKey[] = [
	'designer.placement.front.right',
	'designer.placement.front.down',
	'designer.placement.front.left',
	'designer.placement.front.up',
];

const refusal = ref<AppError | null>(null);

/**
 * Both readouts and the `v-if` from ONE computed, rather than three each asking whether there is a
 * shape. A shapeless asset has no placement point and no front, so there is one absence here and
 * one guard for it — three would each carry an arm that only the same state reaches, and two of
 * them would be arms nothing could ever read: a `computed` is lazy, so a null branch behind a
 * `v-if` that never renders is a branch no test can enter.
 */
const view = computed(() => {
	const design = props.design.shape;
	if (design === null) return null;
	const preset = currentAnchorPreset(design.footprint, design.facing, design.anchor);
	const named = PRESETS.find((entry) => entry.preset === preset);
	return { preset, point: tr(named?.label ?? 'designer.placement.custom'), front: frontLabel(design.facing) };
});

/**
 * Where the front points, in words. An off-axis facing falls back to its angle — still not a CAD
 * bearing, because the sentence says what the degrees are measured FROM.
 */
function frontLabel(facing: number): string {
	const quarter = facingQuarter(facing);
	if (quarter === null) {
		return tr('designer.placement.front.angle', { degrees: String(Math.round((facing * 180) / Math.PI)) });
	}
	return tr(FRONT_LABELS[quarter]);
}

async function choose(preset: AnchorPreset): Promise<void> {
	const result = await props.editShape((design) => {
		const point = anchorPresetPoint(design.footprint, design.facing, preset);
		// `null` is a footprint the frame cannot measure, which a validated shape cannot be; it is
		// carried rather than asserted away so this reads as "nothing to do" instead of throwing.
		if (point === null) return null;
		if (coincident(point, design.anchor) && design.anchorPending === design.footprintPending) return null;
		return moveAnchor({ ...design, anchorPending: design.footprintPending }, point);
	});
	refusal.value = result.ok ? null : result.error;
}
</script>

<template>
	<section
		v-if="view !== null"
		class="rp-designer-placement"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.placement') }}
		</h3>
		<dl class="rp-designer-reference-fields">
			<dt>{{ tr('designer.placement.point') }}</dt>
			<dd>{{ view.point }}</dd>
			<dt>{{ tr('designer.placement.front') }}</dt>
			<dd>{{ view.front }}</dd>
		</dl>
		<div class="rp-designer-selection-actions">
			<button
				v-for="entry in PRESETS"
				:key="entry.preset"
				type="button"
				class="rp-designer-selection-button"
				:name="`placement-${entry.preset}`"
				:aria-pressed="view.preset === entry.preset"
				@click="() => void choose(entry.preset)"
			>
				{{ tr(entry.label) }}
			</button>
		</div>
		<p class="rp-designer-field-hint">
			{{ tr('designer.placement.hint') }}
		</p>
		<p
			v-if="refusal !== null"
			role="alert"
			class="rp-designer-selection-error"
		>
			{{ trError(refusal) }}
		</p>
	</section>
</template>
