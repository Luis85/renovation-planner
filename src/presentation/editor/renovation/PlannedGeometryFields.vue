<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { tr } from '../../i18n/strings';
import { geometryFields, type PlannedGeometryDraft } from './plannedGeometry';
import type { Structure } from '../../../domain/spatial/Structure';
import PlannedElementFields from '../elements/PlannedElementFields.vue';
const draft = defineModel<PlannedGeometryDraft>('draft', { required: true });
defineProps<{ addition: boolean; structure: Structure; paused: boolean }>();
</script>
<template>
	<section class="rp-renovation-fields">
		<PlannedElementFields
			v-if="draft.kind === 'element'"
			:draft="draft"
			:paused="paused"
		/>
		<label v-if="addition && !draft.id">
			{{ tr('renovation.geometry') }}
			<select
				v-model="draft.kind"
				:aria-disabled="paused"
				@change.capture="restoreInoperativeChoice($event, draft.kind)"
			>
				<option value="none">{{ tr('renovation.geometry.none') }}</option>
				<option value="wall">{{ tr('renovation.geometry.wall') }}</option>
				<option value="opening">{{ tr('renovation.geometry.opening') }}</option>
			</select>
		</label>
		<template v-if="draft.kind === 'opening'">
			<label>{{ tr('renovation.host') }}
				<select
					v-model="draft.hostId"
					:aria-disabled="paused"
					@change.capture="restoreInoperativeChoice($event, draft.hostId)"
				>
					<option
						v-for="(wall, index) in structure.walls"
						:key="wall.id"
						:value="wall.id"
					>{{ tr('renovation.geometry.wall') }} {{ index + 1 }}</option>
				</select>
			</label>
			<label>{{ tr('renovation.kind') }}
				<select
					v-model="draft.openingKind"
					:aria-disabled="paused"
					@change.capture="restoreInoperativeChoice($event, draft.openingKind)"
				>
					<option
						v-for="kind in ['door', 'window', 'opening'] as const"
						:key="kind"
						:value="kind"
					>{{ tr(kind === 'opening' ? 'renovation.geometry.opening' : `renovation.kind.${kind}`) }}</option>
				</select>
			</label>
		</template>
		<label
			v-for="field in geometryFields(draft)"
			:key="field"
		>
			{{ tr('renovation.measurement', { field: tr(`renovation.measurement.${field}`) }) }}
			<input
				v-model="draft.text[field]"
				:name="field"
				:readonly="paused"
				inputmode="decimal"
			>
		</label>
		<p v-if="draft.kind !== 'none'">
			{{ tr('renovation.geometry.scope') }}
		</p>
	</section>
</template>
