<script setup lang="ts">
/**
 * The inspector for ONE selected part (asset designer symbols spec, "Inspector for the selection",
 * and Amendments 1 and 2): a detail's name, line, centre, size and a rotate-by field, with ordering,
 * duplicate and delete; the footprint's size and Fit to details; the clearance's delete; the anchor's
 * position; the facing's angle. A PENDING part's lengths — a footprint's size, a detail's centre and size,
 * the anchor's position — are placeholder pixels, so they are withheld.
 *
 * **Every control is one `editShape` call over a pure domain edit**, so a field, a button and a
 * canvas gesture reach the vault through the same `SetAssetShape` door with the same `expected`
 * version (Decision 10). It holds no store and dispatches nothing itself — `DesignerInspector`
 * hands it the design, the selection and the two doors — which is what lets its test mount it bare.
 *
 * **Every edit reads what it needs from the shape it is HANDED, never from this render.** `editShape`
 * hands each edit the shape the previous write left, while these props refresh only once that write
 * resolves — so a centre, an anchor axis or a rotation origin captured at render would quietly undo a
 * commit still in flight. The render supplies only what the fields SHOW.
 *
 * Numbers show whole millimetres and whole degrees and commit on `change` (blur or Enter). A typed
 * Width or Depth lands the typed CURVE-AWARE extent (`resizeToExtent`), which a plain factor does not
 * on an arc — and on a curved part it can move the other extent too, since its arcs keep their bulges
 * (Decision 9). A refusal `editShape` answers is shown in ONE alert and cleared by the next commit that
 * lands. Rotate-by applies and resets to 0: a detail stores no rotation to show.
 *
 * A detail's name is a stable key (Decision 8): the field shows its `designer.detail.<name>` label
 * where one exists and the stored name otherwise, and a typed name is written as typed.
 *
 * A part the shape lacks renders nothing (PBI extension 2a). The store prunes such a selection on
 * its next read; this guard covers the frame between the two.
 */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { DetailLine } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { deleteDetail, fitFootprintToDetails, reorderDetail, updateDetail } from '../../../domain/asset/detailEdits';
import {
	moveAnchor,
	moveOutline,
	outlineOf,
	removeClearance,
	rotateOutline,
	setFacing,
	type OutlinePart,
} from '../../../domain/asset/shapeEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { duplicateAndSelect } from '../designerKeys';
import type { ShapeEdit } from '../selection/editShape';
import { selectionExists, type DesignerSelection } from '../selection/designerSelection';
import { partBox, resizeToExtent, withPartBox } from '../selection/partExtent';
import { semanticLabel } from '../parts/partNames';
import DesignerFieldRow from './DesignerFieldRow.vue';
import DesignerActionButton from './DesignerActionButton.vue';

const props = defineProps<{
	design: AssetDesignDto;
	selection: DesignerSelection;
	editShape: (edit: ShapeEdit) => Promise<DispatchResult>;
	select: (next: DesignerSelection | null) => void;
}>();

interface NumberField {
	readonly name: string;
	readonly label: StringKey;
	readonly value: number;
	readonly edit: (value: number) => ShapeEdit;
	readonly resets?: true;
	/** A one-line description drawn under the field and linked by `aria-describedby`; only the facing's angle has one. */
	readonly hint?: StringKey;
}

/**
 * `disabled` marks an action with nothing to do here — Bring forward on the topmost detail, Send backward on
 * the bottom one. It is drawn `aria-disabled` and its press runs nothing, never `:disabled`: pressing Send
 * backward until the detail is last would otherwise disable the very button that has focus, and Chromium
 * drops focus to `<body>` (selection polish critique, finding 11). `NewAssetForm.vue`'s paused controls take
 * the same split, and `EmptyState.vue`'s action the same no-op press.
 */
interface Action {
	readonly name: string;
	readonly label: StringKey;
	readonly disabled: boolean;
	readonly run: () => void;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const exists = computed(() => selectionExists(props.design.shape, props.selection));
/** Read only inside the `exists` guard, which answers false for a shapeless design — hence the cast. */
const shape = computed(() => props.design.shape as AssetShape);
const refusal = ref<AppError | null>(null);

/** The section's own element; `null` only while `exists` is false and the section renders nothing. */
const root = ref<HTMLElement | null>(null);

/**
 * **A browser drops focus to `<body>` when the focused control unmounts** (spec Amendment 2), and both
 * inspector actions that change the selection unmount this section under the button that was pressed:
 * Delete's write prunes the selection, and Duplicate selects the copy, which re-keys the section. So focus
 * goes to the inspector's `<aside>` — `tabindex="-1"`, a surviving target and not a Tab stop — and the next
 * Tab continues from the inspector rather than from the top of the pane. `NewRoomInspector`'s hand-off on
 * the plan editor, on the next tick for the same reason: the aside outlives this section.
 *
 * `closest` answers `null` for a section mounted outside the inspector, and focus elsewhere leaves focus
 * alone; a section that drew nothing (`root` is `null`) has nothing to ask.
 */
onBeforeUnmount(() => {
	const section = root.value;
	const aside = section !== null && section.contains(document.activeElement) ? section.closest<HTMLElement>('aside') : null;
	if (aside !== null) void nextTick(() => aside.focus());
});

/** One write's outcome: the refusal it answers is shown, and a write that lands clears the last one. */
async function show(written: Promise<DispatchResult>): Promise<boolean> {
	const result = await written;
	refusal.value = result.ok ? null : result.error;
	return result.ok;
}

function commit(edit: ShapeEdit): Promise<boolean> {
	return show(props.editShape(edit));
}

/**
 * The part's curve-aware box, for DISPLAY.
 *
 * The cast stands on TWO guards now, and the second is newer than this function: `exists` keeps a
 * part the shape has not got from mounting the section at all, and `openGraphic` below keeps every
 * caller of this away from an open graphic, which is the other thing `outlineOf` answers `null`
 * for. This comment used to name only the first, which was true while a path could not be selected.
 */
function boxOf(part: OutlinePart): ReturnType<typeof partBox> {
	return partBox(outlineOf(shape.value, part) as CurvedPolygon);
}

function sizeFields(part: OutlinePart): NumberField[] {
	const { width, depth } = boxOf(part);
	return [
		{ name: 'width', label: 'designer.preset.field.width', value: width, edit: (value) => (current) => resizeToExtent(current, part, 'width', value) },
		{ name: 'depth', label: 'designer.preset.field.depth', value: depth, edit: (value) => (current) => resizeToExtent(current, part, 'depth', value) },
	];
}

function detailFields(part: OutlinePart): NumberField[] {
	const { centre } = boxOf(part);
	return [
		{ name: 'centre-x', label: 'designer.selection.centre-x', value: centre.x, edit: (value) => (current) => withPartBox(current, part, (box) => moveOutline(current, part, { dx: value - box.centre.x, dy: 0 })) },
		{ name: 'centre-y', label: 'designer.selection.centre-y', value: centre.y, edit: (value) => (current) => withPartBox(current, part, (box) => moveOutline(current, part, { dx: 0, dy: value - box.centre.y })) },
		...sizeFields(part),
		{ name: 'rotate-by', label: 'designer.selection.rotate-by', value: 0, edit: (value) => (current) => withPartBox(current, part, (box) => rotateOutline(current, part, radians(value), box.centre)), resets: true },
	];
}

function anchorFields(): NumberField[] {
	const { x, y } = shape.value.anchor;
	return [
		{ name: 'position-x', label: 'designer.selection.position-x', value: x, edit: (value) => (current) => moveAnchor(current, { x: value, y: current.anchor.y }) },
		{ name: 'position-y', label: 'designer.selection.position-y', value: y, edit: (value) => (current) => moveAnchor(current, { x: current.anchor.x, y: value }) },
	];
}

/** The selected detail as a one-item list, so the template's closures see it without a narrowing to lose. */
const selectedDetails = computed(() =>
	shape.value.details.filter((item) => props.selection.kind === 'detail' && item.id === props.selection.id),
);

/**
 * A detail or the anchor captured before a scale existed (spec Amendment 2): its numbers are placeholder
 * pixels that calibration later multiplies, so a millimetre typed beside them would be rescaled too. Its
 * length fields are withheld as a pending footprint's are, and one line says why. Rotation stays — it
 * commutes with calibration's uniform scale — and so do the name, the line and every action.
 *
 * The footprint is not asked here: its warning is `DesignerInspector`'s Dimensions block. The facing has
 * no pending flag, and `selectedDetails` is empty for every kind but a detail.
 */
const pendingPart = computed(() =>
	props.selection.kind === 'anchor' ? shape.value.anchorPending : selectedDetails.value.some((item) => item.pending),
);

/**
 * An OPEN graphic (AD04), which has no interior and therefore no box to measure, move or resize.
 *
 * Its section still draws — `selectionExists` counts it as a part that is there, which is what the
 * Parts panel makes selectable — so the withholding is HERE rather than at the mount: the name, the
 * line and the four ordering actions ask nothing about an area and are kept. Every numeric field
 * below reads `outlineOf`, which answers `null` for a path on purpose, so drawing them threw.
 *
 * They come back when AD11 builds an open graphic's own gestures; until then this is the same
 * refusal `outlineOf` already makes, said where the user can see the consequence.
 */
const openGraphic = computed(() => selectedDetails.value.some((item) => item.kind === 'open'));

const fields = computed((): readonly NumberField[] => {
	const selection = props.selection;
	switch (selection.kind) {
		case 'detail':
			if (openGraphic.value) return [];
			return pendingPart.value ? detailFields(selection).filter((field) => field.name === 'rotate-by') : detailFields(selection);
		case 'footprint':
			// A pending footprint's numbers are placeholder pixels; the Dimensions block below says so.
			return props.design.dimensionsUnscaled ? [] : sizeFields(selection);
		case 'clearance':
			return [];
		case 'anchor':
			return pendingPart.value ? [] : anchorFields();
		default: {
			// Exhaustive at compile time: a new kind of selection reaches this line and fails to narrow.
			const _facing: 'facing' = selection.kind;
			return [{ name: 'angle', label: 'designer.selection.angle', hint: 'designer.selection.angle.hint', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
		}
	}
});

function detailActions(id: string): Action[] {
	const details = shape.value.details;
	const index = details.findIndex((item) => item.id === id);
	return [
		{ name: 'bring-forward', label: 'designer.selection.bring-forward', disabled: index === details.length - 1, run: () => void commit((current) => reorderDetail(current, id, 'forward')) },
		{ name: 'send-backward', label: 'designer.selection.send-backward', disabled: index === 0, run: () => void commit((current) => reorderDetail(current, id, 'backward')) },
		{ name: 'duplicate', label: 'designer.selection.duplicate', disabled: false, run: () => void show(duplicateAndSelect(props.editShape, id, props.select)) },
		{ name: 'delete', label: 'designer.selection.delete', disabled: false, run: () => void commit((current) => deleteDetail(current, id)) },
	];
}

const actions = computed((): readonly Action[] => {
	const selection = props.selection;
	if (selection.kind === 'detail') return detailActions(selection.id);
	if (selection.kind === 'footprint') {
		return shape.value.details.length > 0
			? [{ name: 'fit-to-details', label: 'designer.selection.fit-to-details', disabled: false, run: () => void commit(fitFootprintToDetails) }]
			: [];
	}
	if (selection.kind === 'clearance') {
		return [{ name: 'delete', label: 'designer.selection.delete', disabled: false, run: () => void commit(removeClearance) }];
	}
	return [];
});

function onName(id: string, event: Event): void {
	const name = (event.target as HTMLInputElement).value;
	void commit((current) => updateDetail(current, id, { name }));
}

function onLine(id: string, event: Event): void {
	const line = (event.target as HTMLSelectElement).value as DetailLine;
	void commit((current) => updateDetail(current, id, { line }));
}

/** An emptied field commits nothing; `valueAsNumber` is already `NaN` for `''` on a `type="number"` input. */
async function onNumber(field: NumberField, event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const value = input.valueAsNumber;
	if (!Number.isFinite(value)) return;
	if ((await commit(field.edit(value))) && field.resets === true) input.value = '0';
}
</script>

<template>
	<section
		v-if="exists"
		ref="root"
		class="rp-designer-selection"
		:data-kind="selection.kind"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr(`designer.selection.${selection.kind}`) }}
		</h3>
		<p
			v-if="pendingPart"
			class="rp-designer-unscaled"
		>
			{{ tr('designer.selection.unscaled') }}
		</p>
		<template
			v-for="item in selectedDetails"
			:key="item.id"
		>
			<label class="rp-designer-field">
				{{ tr('designer.selection.name') }}
				<input
					type="text"
					name="detail-name"
					:value="semanticLabel(item.name)"
					@change="onName(item.id, $event)"
				>
			</label>
			<label class="rp-designer-field">
				{{ tr('designer.selection.line') }}
				<select
					name="detail-line"
					:value="item.line"
					@change="onLine(item.id, $event)"
				>
					<option value="solid">
						{{ tr('designer.selection.line.solid') }}
					</option>
					<option value="dashed">
						{{ tr('designer.selection.line.dashed') }}
					</option>
				</select>
			</label>
		</template>
		<DesignerFieldRow
			v-for="field in fields"
			:key="field.name"
			:name="field.name"
			:label="field.label"
			:value="field.value"
			:hint="field.hint"
			:on-change="(event: Event) => void onNumber(field, event)"
		/>
		<div
			v-if="actions.length > 0"
			class="rp-designer-selection-actions"
		>
			<DesignerActionButton
				v-for="action in actions"
				:key="action.name"
				:name="action.name"
				:label="action.label"
				:disabled="action.disabled"
				:on-run="action.run"
			/>
		</div>
		<p
			v-if="refusal !== null"
			role="alert"
			class="rp-designer-selection-error"
		>
			{{ trError(refusal) }}
		</p>
	</section>
</template>
