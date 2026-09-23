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
 * **This does not replace the anchor's numeric fields, on a MEASURED object.**
 * `DesignerSelectionInspector` offers x and y when the anchor itself is selected, and that is the
 * "custom" this panel names rather than a third way of moving the same point: the presets write
 * through the same `moveAnchor` those fields do.
 *
 * **On a PENDING one the two interact, and the first version of this sentence claimed otherwise.**
 * That inspector withholds the anchor's fields while `anchorPending` — they would be placeholder
 * pixels presented as a position — and a preset pressed on an object whose footprint is pending
 * writes exactly that flag. So one press on a traced-and-uncalibrated asset takes the numeric door
 * away until a calibration lands. That is coherent rather than accidental: neither number means
 * millimetres yet, and the preset is the honest way to place an anchor in a space that has no scale
 * — but it is a consequence a reader of the old sentence would not have expected, so it is written
 * here rather than discovered.
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
import type { IconName } from 'obsidian';
import { computed, ref } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { AppError } from '../../../core/errors/AppError';
import { coincident } from '../../../core/geometry/operations';
import { moveAnchor } from '../../../domain/asset/shapeEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import type { EditShape } from '../selection/editShape';
import { anchorPresetPoint, currentAnchorPreset, facingQuarter, type AnchorPreset } from '../../../domain/asset/referenceFrame';
import HostIcon from '../../components/HostIcon.vue';

const props = defineProps<{
	design: AssetDesignDto;
	editShape: EditShape;
	/**
	 * Task 8's `Custom` segment: switches the canvas to the existing `SetAnchorTool` rather than
	 * writing a point itself — the tool's own `pointerDown` is what places one, on whatever the user
	 * clicks next. Threaded from `AssetDesignerRoot` through `DesignerInspector` rather than read off
	 * `useDesignerRuntime()` here, for the reason this file's own header already gives for every
	 * other collaborator: this component is mounted BARE in `designerReferencePanels.test.ts`, and a
	 * runtime injection throws on a mount with no leaf behind it.
	 */
	activateAnchorTool: () => void;
}>();

/** Icons per AD18-R16 Task 8: `crosshair` for the geometric middle, `panel-bottom` for a point on
 * one edge of the box — see the report for why that glyph over another Lucide name. */
const PRESETS: readonly { readonly preset: AnchorPreset; readonly label: StringKey; readonly icon: IconName }[] = [
	{ preset: 'centre', label: 'designer.placement.centre', icon: 'crosshair' },
	{ preset: 'back-centre', label: 'designer.placement.back-centre', icon: 'panel-bottom' },
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
 * The readout and the `v-if` from ONE computed, rather than two each asking whether there is a
 * shape. A shapeless asset has no placement point and no front, so there is one absence here and
 * one guard for it. `preset` used to feed a text readout too (`point: tr(...)`, Task 8 deleted it
 * with the `<dl>` row it filled) and still decides which of the three toggle buttons is pressed —
 * `null` for neither preset, the "custom" the group's third segment answers to.
 */
const view = computed(() => {
	const design = props.design.shape;
	if (design === null) return null;
	const preset = currentAnchorPreset(design.footprint, design.facing, design.anchor);
	return { preset, front: frontLabel(design.facing) };
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
			<dt>{{ tr('designer.placement.front') }}</dt>
			<dd>{{ view.front }}</dd>
		</dl>
		<!--
			Task 8 (AD18-R16): board 01's `Back centre | Centre | Custom` segmented control, replacing
			the old `Placement point: …` text row and its two plain buttons with a NAMED group of three
			toggle buttons. `Custom` dispatches nothing itself — it hands the canvas to the existing
			`SetAnchorTool` the toolbar's own `Set anchor` button already activates, and the user's next
			click is what places the point. It is pressed exactly when `view.preset` is `null`: neither
			preset, which is the same "custom" `designer.placement.custom` already named as a readout.
		-->
		<div
			class="rp-designer-selection-actions rp-designer-placement-modes"
			role="group"
			:aria-label="tr('designer.placement.point')"
		>
			<button
				v-for="entry in PRESETS"
				:key="entry.preset"
				type="button"
				class="rp-designer-selection-button"
				:name="`placement-${entry.preset}`"
				:aria-pressed="view.preset === entry.preset"
				@click="() => void choose(entry.preset)"
			>
				<HostIcon :name="entry.icon" />
				<span>{{ tr(entry.label) }}</span>
			</button>
			<button
				type="button"
				class="rp-designer-selection-button"
				name="placement-custom"
				:aria-pressed="view.preset === null"
				@click="activateAnchorTool()"
			>
				<HostIcon name="anchor" />
				<span>{{ tr('designer.placement.custom') }}</span>
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
