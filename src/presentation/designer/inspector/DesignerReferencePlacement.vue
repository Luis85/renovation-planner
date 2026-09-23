<script setup lang="ts">
/**
 * WHERE a plan positions this object and WHICH WAY it faces (AD12 item 2, contract C04): the
 * placement point as a named choice — centre, back centre, or a custom point the user placed —
 * and the front direction as a picker of drawing-relative directions rather than as an angle.
 *
 * **The Front direction picker (AD18-R17, board 01) writes through `editShape` and `setFacing`**,
 * the same pair `DesignerSelectionInspector`'s angle field uses, so a choice is one `SetAssetShape`
 * and one undo entry. It names four directions and `Custom`, and never a degree figure: board 01's
 * `Top (0°)` is the "up = 0 degrees" C04 refuses to copy. `Custom` is selected for any facing
 * between the axes and is DISABLED as a choice — it names no direction to write, and the ways to a
 * custom angle (the Set-facing tool, the facing's own angle field) already exist. A facing owns no
 * pending flag (`SetAssetFacing`'s docblock: an angle survives a rescale), so the picker is offered
 * before calibration exactly as the sentence it replaced was. Its preview is `frontPreview.ts`.
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
import { moveAnchor, setFacing } from '../../../domain/asset/shapeEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import type { EditShape } from '../selection/editShape';
import { anchorPresetPoint, currentAnchorPreset, facingQuarter, type AnchorPreset, type FacingQuarter } from '../../../domain/asset/referenceFrame';
import HostIcon from '../../components/HostIcon.vue';
import { frontPreview } from './frontPreview';

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

/**
 * Icons per AD18-R16 Task 8: `crosshair` for the geometric middle, `panel-bottom` for a point on
 * one edge of the box — see the report for why that glyph over another Lucide name.
 *
 * **`back-centre` FIRST, matching the brief and board 01 panel 5's own order verbatim**
 * (`Back centre | Centre | Custom`) — the fix round's own finding, this array having shipped
 * `centre` first the first time. `designerReferencePanels.test.ts` pins the rendered ORDER,
 * not just each button's presence, so a future re-ordering here is caught the same way.
 */
const PRESETS: readonly { readonly preset: AnchorPreset; readonly label: StringKey; readonly icon: IconName }[] = [
	{ preset: 'back-centre', label: 'designer.placement.back-centre', icon: 'panel-bottom' },
	{ preset: 'centre', label: 'designer.placement.centre', icon: 'crosshair' },
];

/**
 * The picker's four directions, in the brief's up-right-down-left order, each with the QUARTER it
 * writes — 0 is +x, and +y renders DOWN the sheet (`worldToScreen` never flips it), so quarter 3 is
 * the top. `designerFrontDirection.test.ts` checks each against the canvas arrow on screen.
 */
const DIRECTIONS: readonly { readonly value: string; readonly quarter: FacingQuarter; readonly label: StringKey }[] = [
	{ value: 'up', quarter: 3, label: 'designer.placement.front.option.up' },
	{ value: 'right', quarter: 0, label: 'designer.placement.front.option.right' },
	{ value: 'down', quarter: 1, label: 'designer.placement.front.option.down' },
	{ value: 'left', quarter: 2, label: 'designer.placement.front.option.left' },
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
	const quarter = facingQuarter(design.facing);
	const front = DIRECTIONS.find((direction) => direction.quarter === quarter)?.value ?? 'custom';
	return { preset, front, preview: frontPreview(design) };
});

/**
 * One facing edit for the chosen direction, or none. **On Windows Chromium/Electron, arrow keys on a
 * CLOSED select fire `change` at every step**, so stepping from Top to Left is several edits, one
 * undo entry each — the same as every house `<select>` in this inspector, and not specific to this one.
 *
 * `Custom`, and the direction the shape the step was HANDED already faces (C03, C05), both answer
 * `null`, which dispatches nothing.
 *
 * **Nothing here puts the select back after a refused write, and nothing needs to.** Setting
 * `refusal` re-renders this component, and Vue re-patches a `value` binding on EVERY render —
 * compared against the element's live value, not the previous vnode's — so the select returns to
 * the stored direction by itself. Measured: with a hand-written reset removed, the refusal case in
 * `designerFrontDirection.test.ts` still reads the stored direction.
 */
async function chooseFront(select: HTMLSelectElement): Promise<void> {
	const quarter = DIRECTIONS.find((direction) => direction.value === select.value)?.quarter;
	const result = await props.editShape((design) =>
		quarter === undefined || facingQuarter(design.facing) === quarter ? null : setFacing(design, (quarter * Math.PI) / 2),
	);
	refusal.value = result.ok ? null : result.error;
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
		<div class="rp-designer-front">
			<label class="rp-designer-field rp-designer-front__field">
				{{ tr('designer.placement.front') }}
				<select
					name="front-direction"
					:value="view.front"
					@change="(event) => void chooseFront(event.target as HTMLSelectElement)"
				>
					<option
						v-for="direction in DIRECTIONS"
						:key="direction.value"
						:value="direction.value"
					>
						{{ tr(direction.label) }}
					</option>
					<option
						value="custom"
						disabled
					>
						{{ tr('designer.placement.front.option.custom') }}
					</option>
				</select>
			</label>
			<svg
				class="rp-designer-front-preview"
				:viewBox="view.preview.viewBox"
				aria-hidden="true"
			>
				<path
					class="rp-designer-front-preview__footprint"
					:d="view.preview.footprint"
				/>
				<polyline
					class="rp-designer-front-preview__shaft"
					:points="view.preview.shaft.join(' ')"
				/>
				<polygon
					class="rp-designer-front-preview__head"
					:points="view.preview.head.join(' ')"
				/>
			</svg>
		</div>
		<!--
			Task 8 (AD18-R16): board 01's `Back centre | Centre | Custom` segmented control, replacing
			the old `Placement point: …` text row and its two plain buttons with a NAMED group of three
			toggle buttons. `Custom` dispatches nothing itself — it hands the canvas to the existing
			`SetAnchorTool` the toolbar's own `Set anchor` button already activates, and the user's next
			click is what places the point. It is pressed exactly when `view.preset` is `null`: neither
			preset, which is the same "custom" `designer.placement.custom` already named as a readout.

			**NOT `.rp-designer-selection-actions`** (the fix round removed it from this element): that
			class's flex-wrap row is right for the two-button case `DesignerSelectionInspector` still
			uses it for, and wrong for three EQUAL segments in one row — the integrator's browser
			measurement found it wrapping to two rows at this rail's width. `.rp-designer-placement-modes`
			alone carries its own `display: grid` instead (`designer-selection.css`).
		-->
		<div
			class="rp-designer-placement-modes"
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
