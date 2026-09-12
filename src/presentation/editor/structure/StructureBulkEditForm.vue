<script setup lang="ts">
import { computed, ref, type Ref } from 'vue';
import { nativeSubmitKey as keydown } from '../forms/nativeSubmitKey';
import type { Opening, Structure } from '../../../domain/spatial/Structure';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { DIMENSION_FIELDS, dimensionTargets, editDimensions, sharedDimension, type DimensionChanges, type DimensionField, type DimensionKind } from '../../../domain/spatial/structureDimensions';
import { tr } from '../../i18n/strings';
import { formatMetres, parseCoordinateMetres, parseMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
import { useStructureReview } from './useStructureReview';
const props = defineProps<{ structure: Structure; ids: readonly string[]; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; dispatch: (structure: Structure) => Promise<DispatchResult>; preview: (structure: Structure | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const HEADINGS = { wall: 'editor.structure.bulk.walls', window: 'editor.structure.bulk.windows', door: 'editor.structure.bulk.doors' } as const;
/** A field starts at the value every item of its kind shares, or empty when they differ; empty leaves each item's own. */
function section<K extends DimensionField>(kind: DimensionKind, items: readonly Readonly<Record<NoInfer<K>, number>>[], fields: readonly K[]) {
	return { kind, count: items.length, fields: fields.map(field => {
		const shared = sharedDimension(items, field);
		return { field, name: `${kind}-${field}`, initial: shared === null ? '' : formatMetres(shared) };
	}) };
}
const targets = dimensionTargets(props.structure, props.ids);
const sections = [section('wall', targets.wall, DIMENSION_FIELDS.wall), section('window', targets.window, DIMENSION_FIELDS.window), section('door', targets.door, DIMENSION_FIELDS.door)].filter(item => item.count > 0);
const text = ref<Record<string, string>>(Object.fromEntries(sections.flatMap(item => item.fields.map(field => [field.name, field.initial]))));
const proposal = computed(() => {
	const changes: DimensionChanges = {};
	for (const { kind, fields } of sections) for (const { field, name, initial } of fields) {
		const value = text.value[name];
		if (value.trim() === '' || value === initial) continue;
		const parsed = field === 'sill' ? parseCoordinateMetres(value) : parseMetres(value);
		if (!parsed.ok) return null;
		changes[kind] = { ...changes[kind], [field]: parsed.mm };
	}
	return editDimensions(props.structure, props.ids, changes);
});
const { formEl, errorId, numericId, error, invalid, reviewed, conflict, paused, unavailable, describedBy, edited, submit } = useStructureReview(props, proposal, () => emit('submit'));
function differs<T>(before: readonly T[], after: readonly T[]): T[] {
	return after.filter((item, index) => JSON.stringify(item) !== JSON.stringify(before[index]));
}
function impact(next: Structure): string {
	const openings: readonly Opening[] = differs(props.structure.openings, next.openings);
	return tr('editor.structure.bulk.impact', { walls: String(differs(props.structure.walls, next.walls).length),
		windows: String(openings.filter(item => item.kind === 'window').length), doors: String(openings.filter(item => item.kind === 'door').length) });
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p>{{ tr('editor.structure.bulk.hint') }}</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
		>
			{{ spatialMessage(error) }}
		</p>
		<p
			v-if="invalid"
			:id="numericId"
			role="alert"
		>
			{{ tr('editor.structure.error.numeric') }}
		</p>
		<p
			v-if="conflict"
			role="status"
		>
			{{ tr('editor.structure.conflict') }}
		</p>
		<fieldset
			v-for="item in sections"
			:key="item.kind"
			class="rp-dimension-fields"
		>
			<legend>{{ tr(HEADINGS[item.kind], { count: String(item.count) }) }}</legend>
			<label
				v-for="field in item.fields"
				:key="field.name"
				class="rp-dialog-field"
			>{{ tr(`editor.structure.${field.field}`) }}
				<input
					v-model="text[field.name]"
					:name="field.name"
					type="text"
					inputmode="decimal"
					:placeholder="field.initial ? undefined : tr('editor.structure.bulk.mixed')"
					:readonly="paused"
					:aria-invalid="invalid || error !== null"
					:aria-describedby="describedBy"
					@input="edited"
				>
			</label>
		</fieldset>
		<p
			v-if="reviewed && proposal"
			role="status"
		>
			{{ impact(proposal) }}
		</p>
		<button
			type="submit"
			:aria-disabled="unavailable"
		>
			{{ tr(reviewed ? 'editor.structure.apply' : 'editor.structure.preview') }}
		</button>
	</form>
</template>
