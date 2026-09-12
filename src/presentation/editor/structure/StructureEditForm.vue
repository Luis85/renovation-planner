<script setup lang="ts">
import OpeningSwingFields from './OpeningSwingFields.vue';
import { parseSwingDraft, swingDraft, type OpeningSwingDraft } from './openingSwingDraft';
import { openingOffsetAt } from '../../../domain/spatial/openingGeometry';
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { computed, ref, type Ref } from 'vue';
import type { Opening, Structure, Wall } from '../../../domain/spatial/Structure';
import { endForWallLength, wallLength } from '../../../domain/spatial/Structure';
import { editWall } from '../../../domain/spatial/structureGeometry';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { tr } from '../../i18n/strings';
import { formatMetres, parseCoordinateMetres, parseMetres } from '../shell/formatLength';
import StructureReviewNotices from './StructureReviewNotices.vue';
import { useStructureReview } from './useStructureReview';
const props = defineProps<{ structure: Structure; id: string; end?: Point; openingPoint?: Point; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; roomNames: readonly string[]; dispatch: (structure: Structure) => Promise<DispatchResult>; preview: (structure: Structure | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const wall = props.structure.walls.find(candidate => candidate.id === props.id), opening = props.structure.openings.find(candidate => candidate.id === props.id) as Opening;
const initialWall: Wall | undefined = wall && props.end ? { ...wall, end: props.end } : wall;
const openingHost = opening && props.structure.walls.find(host => host.id === opening.hostId);
const initialOffset = openingHost && props.openingPoint ? openingOffsetAt(openingHost, props.openingPoint, opening.width) : opening?.offset;
const swing = ref<OpeningSwingDraft | null>(opening && opening.kind !== 'opening' ? swingDraft(opening) : null), swingEdited = ref(false);
const initial = initialWall ? { length: wallLength(initialWall), height: initialWall.height, thickness: initialWall.thickness } : { offset: initialOffset ?? opening.offset, width: opening.width, height: opening.height, sill: opening.sill };
const fields = Object.keys(initial) as (keyof typeof initial)[];
const text = ref(Object.fromEntries(fields.map(field => [field, formatMetres(initial[field] as number)])));
const proposal = computed(() => {
	const values: Record<string, number> = {};
	for (const field of fields) {
		const parsed = field === 'offset' || field === 'sill' ? parseCoordinateMetres(text.value[field]) : parseMetres(text.value[field]);
		if (!parsed.ok) return null;
		values[field] = text.value[field] === formatMetres(initial[field] as number) ? initial[field] as number : parsed.mm;
	}
	const parsedSwing = swing.value ? parseSwingDraft(swing.value) : undefined;
	if (parsedSwing === null) return null;
	if (initialWall) return editWall(props.structure, { ...initialWall, height: values.height, thickness: values.thickness, end: endForWallLength(initialWall, values.length) });
	return { ...props.structure, openings: props.structure.openings.map(item => item.id === props.id ? { ...item, ...values, ...(swingEdited.value && parsedSwing ? { swing: parsedSwing } : {}) } : item) };
});
const invalidTarget = () => swing.value && !parseSwingDraft(swing.value) ? '[name="opening-angle"]' : '[aria-invalid="true"]';
const { formEl, errorId, numericId, error, invalid, reviewed, conflict, paused, unavailable, describedBy, edited, submit } = useStructureReview(props, proposal, () => emit('submit'), invalidTarget);
const impact = computed(() => {
	if (!wall) return tr('editor.structure.opening-impact');
	const walls = proposal.value?.walls.filter((item, index) => JSON.stringify(item) !== JSON.stringify(props.structure.walls[index])).length ?? 0;
	return tr('editor.structure.impact', { walls: String(walls), openings: String(props.structure.openings.filter(item => item.hostId === props.id).length) });
});
function changeSwing(value: OpeningSwingDraft): void {
	if (paused.value || conflict.value) return;
	swing.value = value; swingEdited.value = true; edited();
}

</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p v-if="wall">
			{{ tr('editor.structure.anchor') }}
		</p>
		<p v-if="roomNames.length">
			{{ tr('editor.structure.room-impact', { rooms: roomNames.join(', ') }) }}
		</p>
		<StructureReviewNotices
			:error="error"
			:invalid="invalid"
			:conflict="conflict"
			:error-id="errorId"
			:numeric-id="numericId"
		/>
		<label
			v-for="field in fields"
			:key="field"
			class="rp-dialog-field"
		>{{ tr(`editor.structure.${field}`) }}
			<input
				v-model="text[field]"
				:name="field"
				type="text"
				inputmode="decimal"
				:readonly="paused"
				:aria-invalid="invalid || error !== null"
				:aria-describedby="describedBy"
				@input="edited"
			>
		</label>
		<OpeningSwingFields
			v-if="swing"
			:model-value="swing"
			:disabled="paused || conflict"
			@update:model-value="changeSwing"
		/>
		<p
			v-if="reviewed"
			role="status"
		>
			{{ impact }}
		</p>
		<button
			type="submit"
			:aria-disabled="unavailable"
		>
			{{ tr(reviewed ? 'editor.structure.apply' : 'editor.structure.preview') }}
		</button>
	</form>
</template>
