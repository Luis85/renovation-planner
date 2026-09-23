<script setup lang="ts">
/**
 * Moving, turning and proportionally scaling the whole SELECTION as one body (AD10 item 5, C06).
 *
 * Four "by" fields rather than four absolute ones, and that is the difference between this and the
 * single-part section above it: a set has no centre, no size and no rotation of its own to show, so
 * an absolute field would need a value the selection does not have. Each field applies a RELATIVE
 * change and resets, which is exactly what `DesignerSelectionInspector`'s own Rotate-by row does.
 *
 * The rotation and the scale both act about the centre of the selection's shared box, which
 * `arrangeDetails.aboutCentre` decides — so a set turns as one body rather than each part spinning
 * on its own middle. Scaling is PROPORTIONAL only: a uniform factor keeps every circular arc
 * circular (C04's first sentence), and no per-axis factor is offered here at all.
 *
 * Its own component for the reason `DesignerFieldRow` and `DesignerActionButton` are theirs: fallow
 * scores template complexity per SFC, and the panel that mounts this already carries three button
 * loops and a select.
 *
 * **Closed by default behind its own `<details>`/`<summary>` (AD18-R16 Task 6)**: the boards fold
 * this group as `› Advanced`, and with a detail selected these four fields used to draw open every
 * time, which is most of what made the panel long. `GroupControls.vue`'s bare disclosure is the
 * shape borrowed — no dismissal composable, no persisted state, since C12 (Open state is leaf-local
 * and not persisted) asks for exactly that and nothing more.
 */
import { computed } from 'vue';
import { moveDetails, rotateDetails, scaleDetails } from '../../../domain/asset/arrangeDetails';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import type { ShapeEdit } from '../selection/editShape';
import DesignerFieldRow from './DesignerFieldRow.vue';

const props = defineProps<{
	/** The selected graphics, in selection order. */
	ids: readonly string[];
	/** The leaf's locked graphic ids; a locked participant refuses the whole transform. */
	locked: ReadonlySet<string>;
	commit: (edit: ShapeEdit) => Promise<boolean>;
}>();

interface ByField {
	readonly name: string;
	/** The field's full sentence — `DesignerFieldRow`'s accessible name (AD18-R16 Task 5). */
	readonly label: StringKey;
	/** The field's short visible label — `DesignerFieldRow`'s compact-row text. */
	readonly short: StringKey;
	/** `mm`, `°`, or left out for Scale by, which is a bare factor. */
	readonly unit?: 'mm' | '°';
	/** What the empty field reads as: nothing moves by 0, and nothing scales by 1. */
	readonly resting: number;
	readonly edit: (value: number) => ShapeEdit;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const fields = computed((): readonly ByField[] => {
	const selection = { ids: props.ids, immovable: props.locked };
	return [
		{ name: 'set-move-x', label: 'designer.arrange.move-x', short: 'designer.arrange.move-x.short', unit: 'mm', resting: 0, edit: (value) => (current) => moveDetails(current, { ...selection, by: { dx: value, dy: 0 } }) },
		{ name: 'set-move-y', label: 'designer.arrange.move-y', short: 'designer.arrange.move-y.short', unit: 'mm', resting: 0, edit: (value) => (current) => moveDetails(current, { ...selection, by: { dx: 0, dy: value } }) },
		{ name: 'set-rotate-by', label: 'designer.selection.rotate-by', short: 'designer.selection.rotate-by.short', unit: '°', resting: 0, edit: (value) => (current) => rotateDetails(current, { ...selection, radians: radians(value) }) },
		{ name: 'set-scale-by', label: 'designer.arrange.scale-by', short: 'designer.arrange.scale-by.short', resting: 1, edit: (value) => (current) => scaleDetails(current, { ...selection, factor: value }) },
	];
});

/**
 * An emptied field commits nothing — `valueAsNumber` is already `NaN` for `''` on a number input —
 * and a committed field goes back to its resting value, because the change it described has
 * happened and typing it again would apply it twice.
 *
 * **The RESTING value commits nothing either** (contract C05): a move of zero and a scale of one
 * change nothing, and because the resting value is also the DISPLAYED one, committing it is one blur
 * away at all times. It is caught here rather than in the domain because a rotation of zero builds
 * fresh coordinate objects that are equal to the originals and not identical to them — so the
 * identity comparison the panel makes cannot see it, and this is the one place that can.
 */
async function onNumber(field: ByField, event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const value = input.valueAsNumber;
	if (!Number.isFinite(value) || value === field.resting) return;
	if (await props.commit(field.edit(value))) input.value = String(field.resting);
}
</script>

<template>
	<details class="rp-designer-collapsible">
		<summary>
			<h3 class="rp-designer-panel-title rp-designer-section-title">
				{{ tr('designer.arrange.transform') }}
			</h3>
		</summary>
		<DesignerFieldRow
			v-for="field in fields"
			:key="field.name"
			:name="field.name"
			:label="field.label"
			:short="field.short"
			:unit="field.unit"
			:value="field.resting"
			:on-change="(event: Event) => void onNumber(field, event)"
		/>
	</details>
</template>
