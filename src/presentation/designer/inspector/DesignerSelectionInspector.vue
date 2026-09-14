<script setup lang="ts">
/**
 * The inspector for ONE selected part (asset designer symbols spec, "Inspector for the selection",
 * and Amendment 1): a detail's name, line, centre, size and a rotate-by field, with ordering,
 * duplicate and delete; the footprint's size and Fit to details; the clearance's delete; the
 * anchor's position; the facing's angle.
 *
 * **Every control is one `editShape` call over a pure domain edit**, so a field, a button and a
 * canvas gesture reach the vault through the same `SetAssetShape` door with the same `expected`
 * version (Decision 10). It holds no store and dispatches nothing itself — `DesignerInspector`
 * hands it the design, the selection and the two doors — which is what lets its test mount it bare.
 *
 * Numbers show whole millimetres and whole degrees and commit on `change` (blur or Enter). A typed
 * Width or Depth lands the typed CURVE-AWARE extent (`resizeToExtent`), which a plain factor does not
 * on an arc. A refusal `editShape` answers is shown in ONE alert and cleared by the next commit that
 * lands. Rotate-by applies and resets to 0: a detail stores no rotation to show.
 *
 * A detail's name is a stable key (Decision 8): the field shows its `designer.detail.<name>` label
 * where one exists and the stored name otherwise, and a typed name is written as typed.
 *
 * A part the shape lacks renders nothing (PBI extension 2a). The store prunes such a selection on
 * its next read; this guard covers the frame between the two.
 */
import { computed, ref } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Result } from '../../../core/result/Result';
import type { DetailLine } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import {
	deleteDetail,
	duplicateDetail,
	DUPLICATE_OFFSET_MM,
	fitFootprintToDetails,
	nextDetailId,
	reorderDetail,
	updateDetail,
} from '../../../domain/asset/detailEdits';
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
import { hasLocaleKey, trError } from '../../i18n/toUserMessage';
import { selectionExists, type DesignerSelection } from '../selection/designerSelection';
import { partBox, resizeToExtent } from '../selection/partExtent';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

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
}

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

/** One write; the refusal it answers is shown, and a write that lands clears the last one. */
async function commit(edit: ShapeEdit): Promise<boolean> {
	const result = await props.editShape(edit);
	refusal.value = result.ok ? null : result.error;
	return result.ok;
}

/** The part's curve-aware box. `outlineOf` answers an outline here because `exists` holds. */
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
		{ name: 'centre-x', label: 'designer.selection.centre-x', value: centre.x, edit: (value) => (current) => moveOutline(current, part, { dx: value - centre.x, dy: 0 }) },
		{ name: 'centre-y', label: 'designer.selection.centre-y', value: centre.y, edit: (value) => (current) => moveOutline(current, part, { dx: 0, dy: value - centre.y }) },
		...sizeFields(part),
		{ name: 'rotate-by', label: 'designer.selection.rotate-by', value: 0, edit: (value) => (current) => rotateOutline(current, part, radians(value), centre), resets: true },
	];
}

function anchorFields(): NumberField[] {
	const { x, y } = shape.value.anchor;
	return [
		{ name: 'position-x', label: 'designer.selection.position-x', value: x, edit: (value) => (current) => moveAnchor(current, { x: value, y }) },
		{ name: 'position-y', label: 'designer.selection.position-y', value: y, edit: (value) => (current) => moveAnchor(current, { x, y: value }) },
	];
}

const fields = computed((): readonly NumberField[] => {
	const selection = props.selection;
	switch (selection.kind) {
		case 'detail':
			return detailFields(selection);
		case 'footprint':
			return sizeFields(selection);
		case 'clearance':
			return [];
		case 'anchor':
			return anchorFields();
		default: // the facing
			return [{ name: 'angle', label: 'designer.selection.angle', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
	}
});

/** The selected detail as a one-item list, so the template's closures see it without a narrowing to lose. */
const selectedDetails = computed(() =>
	shape.value.details.filter((item) => props.selection.kind === 'detail' && item.id === props.selection.id),
);

function detailLabel(name: string): string {
	const key = `designer.detail.${name}`;
	return hasLocaleKey(key) ? tr(key) : name;
}

/** The copy's id is read from the shape the edit is handed — the one the write is conditional on. */
async function duplicate(id: string): Promise<void> {
	let copy = '';
	const landed = await commit((current) => {
		copy = nextDetailId(current);
		return duplicateDetail(current, id, { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM });
	});
	if (landed) props.select({ kind: 'detail', id: copy });
}

function detailActions(id: string): Action[] {
	const details = shape.value.details;
	const index = details.findIndex((item) => item.id === id);
	return [
		{ name: 'bring-forward', label: 'designer.selection.bring-forward', disabled: index === details.length - 1, run: () => void commit((current) => reorderDetail(current, id, 'forward')) },
		{ name: 'send-backward', label: 'designer.selection.send-backward', disabled: index === 0, run: () => void commit((current) => reorderDetail(current, id, 'backward')) },
		{ name: 'duplicate', label: 'designer.selection.duplicate', disabled: false, run: () => void duplicate(id) },
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

/** An emptied field commits nothing; `Number('')` would otherwise write a zero nobody typed. */
async function onNumber(field: NumberField, event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const value = input.value.trim() === '' ? Number.NaN : Number(input.value);
	if (!Number.isFinite(value)) return;
	if ((await commit(field.edit(value))) && field.resets === true) input.value = '0';
}
</script>

<template>
	<section
		v-if="exists"
		class="rp-designer-selection"
		:data-kind="selection.kind"
	>
		<h3 class="rp-designer-panel-title">
			{{ tr(`designer.selection.${selection.kind}`) }}
		</h3>
		<template
			v-for="item in selectedDetails"
			:key="item.id"
		>
			<label class="rp-designer-field">
				{{ tr('designer.selection.name') }}
				<input
					type="text"
					name="detail-name"
					:value="detailLabel(item.name)"
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
		<label
			v-for="field in fields"
			:key="field.name"
			class="rp-designer-field"
		>
			{{ tr(field.label) }}
			<input
				type="number"
				:name="field.name"
				step="any"
				inputmode="decimal"
				:value="Math.round(field.value)"
				@change="(event: Event) => void onNumber(field, event)"
			>
		</label>
		<div
			v-if="actions.length > 0"
			class="rp-designer-selection-actions"
		>
			<button
				v-for="action in actions"
				:key="action.name"
				type="button"
				class="rp-designer-selection-button"
				:name="action.name"
				:disabled="action.disabled"
				@click="action.run()"
			>
				{{ tr(action.label) }}
			</button>
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
