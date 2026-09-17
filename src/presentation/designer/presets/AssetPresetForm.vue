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
import { rovingIndex } from '../../components/rovingIndex';
import AssetPresetGallery from './AssetPresetGallery.vue';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { ASSET_PRESETS, PRESET_GROUPS } from '../../../domain/asset/presets/catalogue';
import { defaultValues, type AssetPreset, type PresetFieldKey } from '../../../domain/asset/presets/presetGeometry';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { presetPreview, presetThumbnail } from './presetPreview';

defineProps<{ replaces: boolean }>();
const emit = defineEmits<{ submit: [shape: AssetShape] }>();

/**
 * Every choice the gallery can draw, with its picture, built ONCE PER FORM — this is `<script
 * setup>`, so it is the `setup()` body and the array is rebuilt each time the dialog opens, not
 * each time the module loads. What it is not is a `computed`: a thumbnail is the preset at its own
 * defaults, so nothing about it changes while the user types, and this is fourteen `build` calls
 * per dialog open rather than fourteen per keystroke of the search field.
 *
 * (The docblock here said "at module scope" and was wrong about the mechanism while being right
 * about the cost — AD07 review, FIX 5.2.)
 */
const CHOICES = ASSET_PRESETS.map((preset) => ({ preset, thumbnail: presetThumbnail(preset) }));

// `[0]`, not `.at(0)`: `lib` is ES2021 and `Array.prototype.at` is ES2022. The catalogue is never
// empty — `presets.test.ts` pins all fourteen — so there is no "no preset" state to guard.
const preset = shallowRef<AssetPreset>(ASSET_PRESETS[0]);

/** `string | number` for the reason `KnownDistanceForm` gives: `v-model` on a number input yields either. */
const typed = ref<Partial<Record<PresetFieldKey, string | number>>>({ ...defaultValues(preset.value) });

/**
 * AD07's search. It matches on the words a user READS — the localised preset name — rather than
 * on the catalogue id, because the id is data and "Waschbecken" is what somebody typing German
 * into this field is looking for. Trimmed and case-folded on both sides; an empty field matches
 * everything, which is what makes the gallery's resting state the whole catalogue.
 */
const query = ref('');

/**
 * The gallery: the groups `PRESET_GROUPS` declares, in that order, each carrying whichever of
 * its presets the search left. A group the search emptied is DROPPED rather than drawn with a
 * heading over nothing — and when the search empties every group the form says so instead
 * (`designer.preset.no-matches` below), which is the same distinction
 * `selectAssetLibraryEmptyState` draws between "no assets" and "no matches".
 */
const groups = computed(() => {
	const needle = query.value.trim().toLocaleLowerCase();
	const matching = CHOICES.filter((choice) => tr(`preset.${choice.preset.id}`).toLocaleLowerCase().includes(needle));
	return PRESET_GROUPS.map((group) => ({ group, choices: matching.filter((choice) => choice.preset.group === group) })).filter(
		(entry) => entry.choices.length > 0,
	);
});

/**
 * THE GALLERY IS ONE TAB STOP (AD07 review, FIX 3). A `<select>` is one tab stop with arrow keys;
 * fourteen plain buttons are fourteen, which is a keyboard regression against the control this
 * replaced. The fix is WAI-ARIA's roving tabindex, copied from `DesignerPartsPanel.vue` rather than
 * invented again — that list is the same shape and AD08-R1 blesses it partly for being it.
 *
 * The choice the tab stop is on, held as an ID rather than an index so the search re-flowing the
 * gallery moves the stop with its button instead of leaving it on whatever slid into that slot.
 */
const focusedId = ref<string | null>(null);

/** The form's own element, which is how a key pressed in one group finds a button in another. */
const root = ref<HTMLElement | null>(null);

/** Every drawn choice, flattened into the order the arrows walk — which is the order the DOM is in. */
const choosable = computed(() => groups.value.flatMap((entry) => entry.choices.map((choice) => choice.preset.id)));

/**
 * Where the one tab stop sits: the choice that last had focus while the search still draws it, else
 * the chosen preset, else the first choice left. Falling back rather than holding a stale id is what
 * keeps the gallery enterable after a search drops the button that had focus — `undefined` only
 * where the search drew no choice at all, and then there is no button to put a `tabindex` on.
 */
const tabbableId = computed((): string | undefined => {
	const ids = choosable.value;
	return ids.find((id) => id === focusedId.value) ?? ids.find((id) => id === preset.value.id) ?? ids[0];
});

/**
 * Where Home, End and the four arrows land from `from`, or `-1` for a key this gallery does not take.
 *
 * BOTH AXES MOVE ONE CHOICE, deliberately. The grid's column count is `repeat(auto-fill, minmax(6rem,
 * 1fr))` resolved against the dialog's width, which nothing in this component measures — so a
 * Left/Right that stepped a column and an Up/Down that stepped a row would both be guessing, and
 * would guess differently at every width. The one order that IS known is the reading order, so the
 * gallery is walked as the single list it is authored as.
 */

/**
 * The arrows, Home and End over the whole gallery, moving the tab stop with the focus.
 *
 * ONE guard, over the choice rather than over the key: an unowned id and an out-of-range index land
 * in the same place, and a key this gallery does not take lands there too. The ends CLAMP rather
 * than wrapping, which is the list pattern's own rule and the one the Parts panel already follows.
 */
function onKeydown(event: KeyboardEvent): void {
	const ids = choosable.value;
	const next = ids[rovingIndex(event.key, ids.findIndex((id) => id === tabbableId.value), ids.length, true)];
	if (next === undefined) return;
	event.preventDefault();
	focusedId.value = next;
	root.value?.querySelector<HTMLElement>(`.rp-preset-choice[data-preset="${CSS.escape(next)}"]`)?.focus();
}

/**
 * Choosing takes the PRESET rather than an id, which is what removed this function's old guard:
 * a `<select>`'s `change` carries a string that may name nothing, and a gallery button carries
 * the catalogue entry it was drawn from. The guard was a question the markup now answers, and an
 * unreachable one costs a branch it can never pay back.
 */
function choose(next: AssetPreset): void {
	preset.value = next;
	typed.value = { ...defaultValues(next) };
	focusedId.value = next.id;
}

// Every field is filled by `defaultValues` on each choice; an emptied input is `''`, which `Number`
// reads as 0 and the range check refuses.
const built = computed(() =>
	preset.value.build(Object.fromEntries(preset.value.fields.map((field) => [field.key, Number(String(typed.value[field.key]).trim())]))),
);
const preview = computed(() => (built.value.ok ? presetPreview(built.value.value) : null));
const refusal = computed(() => (built.value.ok ? null : trError(built.value.error)));

function onSubmit(): void {
	if (built.value.ok) emit('submit', built.value.value);
}
</script>

<template>
	<form
		ref="root"
		class="rp-dialog-form rp-asset-preset-form"
		@submit.prevent="onSubmit"
	>
		<p
			v-if="replaces"
			class="rp-dialog-warning"
		>
			{{ tr('designer.preset.replaces') }}
		</p>
		<!--
			AD07's implementation item 4: a preset writes ordinary geometry, and nothing stores the
			numbers that generated it. Said BEFORE the fields, because it is what those fields mean
			— a user who reads it afterwards has already formed the wrong expectation of them.
		-->
		<p class="rp-dialog-message">
			{{ tr('designer.preset.editable') }}
		</p>
		<label class="rp-dialog-field">
			{{ tr('designer.preset.search') }}
			<input
				v-model="query"
				type="search"
				name="preset-search"
			>
		</label>
		<AssetPresetGallery
			:groups="groups"
			:chosen-id="preset.id"
			:tabbable-id="tabbableId"
			:choose="choose"
			:on-keydown="onKeydown"
		/>
		<p
			v-if="groups.length === 0"
			class="rp-dialog-message"
		>
			{{ tr('designer.preset.no-matches') }}
		</p>
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
				:inputmode="field.kind === 'count' ? 'numeric' : 'decimal'"
			>
		</label>
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
				:aria-disabled="!built.ok"
			>
				{{ tr('designer.preset.apply') }}
			</button>
		</div>
	</form>
</template>
