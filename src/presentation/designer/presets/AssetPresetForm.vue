<script setup lang="ts">
/**
 * The preset picker "Start from preset" opens (asset designer symbols spec, Decision 8). Mounted
 * inside `FormDialog` under the existing `kind: 'form'`; it lives here, not in
 * `presentation/dialogs/`, because that directory holds no field knowledge.
 *
 * It dispatches nothing: `submit` hands the built `AssetShape` to `AssetDesignerRoot`, which writes
 * it through the reversible `setShape` edit — the split `AssetDimensionsDialog` already draws.
 */
import { computed, ref, shallowRef } from 'vue';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { ASSET_PRESETS, PRESET_GROUPS } from '../../../domain/asset/presets/catalogue';
import { defaultValues, type AssetPreset, type PresetFieldKey } from '../../../domain/asset/presets/presetGeometry';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { presetPreview } from './presetPreview';

defineProps<{ replaces: boolean }>();
const emit = defineEmits<{ submit: [shape: AssetShape] }>();

const groups = PRESET_GROUPS.map((group) => ({ group, presets: ASSET_PRESETS.filter((item) => item.group === group) }));
// `[0]`, not `.at(0)`: `lib` is ES2021 and `Array.prototype.at` is ES2022.
const preset = shallowRef<AssetPreset | undefined>(ASSET_PRESETS[0]);

/** `string | number` for the reason `KnownDistanceForm` gives: `v-model` on a number input yields either. */
const typed = ref<Partial<Record<PresetFieldKey, string | number>>>(preset.value === undefined ? {} : { ...defaultValues(preset.value) });

function choose(id: string): void {
	const next = ASSET_PRESETS.find((item) => item.id === id);
	if (next === undefined) return;
	preset.value = next;
	typed.value = { ...defaultValues(next) };
}

const built = computed(() => {
	const current = preset.value;
	if (current === undefined) return null;
	return current.build(Object.fromEntries(current.fields.map((field) => [field.key, Number(String(typed.value[field.key] ?? '').trim())])));
});
const preview = computed(() => (built.value?.ok === true ? presetPreview(built.value.value) : null));
const refusal = computed(() => (built.value === null || built.value.ok ? null : trError(built.value.error)));

function onSubmit(): void {
	if (built.value?.ok === true) emit('submit', built.value.value);
}
</script>

<template>
	<form
		class="rp-dialog-form rp-asset-preset-form"
		@submit.prevent="onSubmit"
	>
		<p
			v-if="replaces"
			class="rp-dialog-warning"
		>
			{{ tr('designer.preset.replaces') }}
		</p>
		<label class="rp-dialog-field">
			{{ tr('designer.preset.picker') }}
			<select
				name="preset"
				:value="preset?.id"
				@change="choose(($event.target as HTMLSelectElement).value)"
			>
				<optgroup
					v-for="entry in groups"
					:key="entry.group"
					:label="tr(`designer.preset.group.${entry.group}`)"
				>
					<option
						v-for="item in entry.presets"
						:key="item.id"
						:value="item.id"
					>
						{{ tr(`preset.${item.id}`) }}
					</option>
				</optgroup>
			</select>
		</label>
		<template v-if="preset !== undefined">
			<label
				v-for="field in preset.fields"
				:key="`${preset.id}-${field.key}`"
				class="rp-dialog-field"
			>
				{{ tr(`designer.preset.field.${field.key}`) }}
				<input
					v-model="typed[field.key]"
					type="number"
					:name="field.key"
					:min="field.min"
					:max="field.max"
					:step="field.kind === 'count' ? 1 : 'any'"
					inputmode="decimal"
				>
			</label>
		</template>
		<svg
			v-if="preview !== null"
			class="rp-asset-preset-preview"
			:viewBox="preview.viewBox"
			role="img"
			:aria-label="tr('designer.preset.preview')"
		>
			<path
				class="rp-asset-preset-preview__footprint"
				:d="preview.footprint"
			/>
			<path
				v-for="(detail, index) in preview.details"
				:key="index"
				class="rp-asset-preset-preview__detail"
				:class="{ 'rp-asset-preset-preview__detail--dashed': detail.dashed }"
				:d="detail.d"
			/>
		</svg>
		<p
			v-if="refusal !== null"
			class="rp-dialog-warning"
		>
			{{ refusal }}
		</p>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="built === null || !built.ok"
			>
				{{ tr('designer.preset.apply') }}
			</button>
		</div>
	</form>
</template>
