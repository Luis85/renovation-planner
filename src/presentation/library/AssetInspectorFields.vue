<script setup lang="ts">
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import { ASSET_CATEGORY_LABELS, MEASUREMENT_UNIT_LABELS } from '../views/assetLabels';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import { ASSET_CATEGORIES } from '../../domain/asset/AssetCategory';
import { UNIT_KIND } from '../../core/units/MeasurementUnit';
import FieldError from '../components/FieldError.vue';
import { tr } from '../i18n/strings';
import { DEFINITION_LABELS, type DefinitionDraft } from './definitionDraft';
import { useDefinitionDraft } from './useDefinitionDraft';

const props = defineProps<{ entry: CatalogueEntryDto }>();
const form = useDefinitionDraft(() => props.entry);
const selectFields = new Set<keyof DefinitionDraft>(['category', 'unit']);
const fields = Object.keys(DEFINITION_LABELS) as (keyof DefinitionDraft)[];
/**
 * The declared vocabulary, plus the baseline's OWN value when it is outside it (D04: an
 * unknown category is shown, never coerced). Without that option a `<select>` bound to an
 * undeclared value renders EMPTY, and the first save of any other field would carry whatever
 * the browser picked. The option is labelled with the raw value because no locale key exists
 * for a word this build does not declare; the parser side of that PBI is separate.
 */
function options(key: keyof DefinitionDraft): readonly string[] {
	const declared: readonly string[] = key === 'category' ? ASSET_CATEGORIES : Object.keys(UNIT_KIND);
	const own = props.entry[key === 'category' ? 'category' : 'unit'];
	return declared.includes(own) ? declared : [own, ...declared];
}
function optionLabel(key: keyof DefinitionDraft, option: string): string {
	if (key === 'category') return (ASSET_CATEGORIES as readonly string[]).includes(option) ? tr(ASSET_CATEGORY_LABELS[option as AssetCategory]) : option;
	return option in UNIT_KIND ? tr(MEASUREMENT_UNIT_LABELS[option as MeasurementUnit]) : option;
}
function fieldLabel(key: keyof DefinitionDraft): string {
	const suffix: Partial<Record<keyof DefinitionDraft, string>> = { unitCost: ` (${props.entry.currency})`, waste: ' (%)', height: ' (mm)' };
	return tr(DEFINITION_LABELS[key]) + (suffix[key] ?? '');
}
</script>

<template>
	<form
		class="rp-al-definition"
		@submit.prevent="form.save()"
	>
		<p
			v-if="form.conflict.value"
			class="rp-al-inspector__refusal"
			role="alert"
		>
			{{ tr('view.asset-library.draft.conflict') }}
		</p>
		<ul
			v-if="form.differences.value.length"
			class="rp-al-differences"
		>
			<li
				v-for="difference in form.differences.value"
				:key="difference.key"
			>
				{{ tr(DEFINITION_LABELS[difference.key]) }}: {{ difference.before }} → {{ difference.current }}
			</li>
		</ul>
		<p
			v-if="form.banner.value"
			class="rp-al-inspector__refusal"
			role="alert"
		>
			{{ form.banner.value }}
		</p>
		<dl class="rp-al-fields">
			<template
				v-for="key in fields"
				:key="key"
			>
				<dt class="rp-al-fields__key">
					{{ fieldLabel(key) }}
				</dt>
				<dd class="rp-al-fields__value">
					<FieldError
						v-slot="{ aria }"
						:message="form.errors.value[key] ?? null"
					>
						<select
							v-if="selectFields.has(key)"
							v-bind="aria"
							v-model="form.values.value[key]"
							class="rp-al-fields__select"
							:data-field="key"
							:aria-label="fieldLabel(key)"
							:disabled="form.locked.value"
						>
							<option
								v-for="option in options(key)"
								:key="option"
								:value="option"
							>
								{{ optionLabel(key, option) }}
							</option>
						</select>
						<input
							v-else
							v-bind="aria"
							v-model="form.values.value[key]"
							type="text"
							class="rp-al-fields__input"
							:data-field="key"
							:aria-label="fieldLabel(key)"
							:readonly="form.locked.value"
						>
					</FieldError>
				</dd>
			</template>
		</dl>
		<div class="rp-al-draft-actions">
			<span
				role="status"
				aria-live="polite"
			>{{ form.statusText.value }}</span>
			<button
				type="submit"
				:disabled="!form.canSave.value"
			>
				{{ tr('view.asset-library.draft.save') }}
			</button>
			<button
				v-if="form.status.value !== 'refresh'"
				type="button"
				:disabled="form.busy.value"
				@click="form.discard()"
			>
				{{ tr('view.asset-library.draft.discard') }}
			</button>
			<button
				v-if="form.needsRead.value"
				type="button"
				@click="form.refresh()"
			>
				{{ tr('view.failure.retry') }}
			</button>
		</div>
	</form>
</template>
