<script setup lang="ts">
/**
 * The preset gallery: one `role="group"` per catalogue group, a thumbnail button per preset, and
 * the roving tabindex over the whole thing.
 *
 * **Its own component for a measured reason rather than a tidy one.** `AssetPresetForm.vue`'s
 * template breached fallow's cognitive-complexity threshold when the gallery replaced a `<select>`,
 * and the gallery is the part of that template with all the nesting in it — a `v-for` over groups
 * around a `v-for` over choices around a conditional thumbnail whose paths are a third `v-for`.
 * Lifting it moves the branching to where it belongs rather than suppressing the finding, which is
 * this repository's standing answer to a complexity gate.
 *
 * It owns no state. The pressed preset, the tab stop and the keyboard all belong to the form, which
 * is what keeps one answer to "which preset is chosen" rather than two that can disagree.
 *
 * `aria-pressed` rather than a radio group: these are buttons that CHANGE the fields below them,
 * and the pressed one names the preset those fields belong to.
 */
import { tr } from '../../i18n/strings';
import type { PresetPreview } from './presetPreview';
import type { AssetPreset, PresetGroup } from '../../../domain/asset/presets/presetGeometry';

defineProps<{
	groups: readonly { readonly group: PresetGroup; readonly choices: readonly { readonly preset: AssetPreset; readonly thumbnail: PresetPreview | null }[] }[];
	chosenId: string;
	/** `undefined` while the filtered gallery is empty, where there is no button to be the tab stop. */
	tabbableId: string | undefined;
	choose: (preset: AssetPreset) => void;
	onKeydown: (event: KeyboardEvent) => void;
}>();
</script>

<template>
	<template
		v-for="entry in groups"
		:key="entry.group"
	>
		<h3>{{ tr(`designer.preset.group.${entry.group}`) }}</h3>
		<div
			class="rp-preset-gallery"
			role="group"
			:aria-label="tr(`designer.preset.group.${entry.group}`)"
			@keydown="onKeydown"
		>
			<button
				v-for="choice in entry.choices"
				:key="choice.preset.id"
				type="button"
				class="rp-preset-choice"
				:data-preset="choice.preset.id"
				:aria-pressed="choice.preset.id === chosenId"
				:tabindex="choice.preset.id === tabbableId ? 0 : -1"
				@click="choose(choice.preset)"
			>
				<!--
					`aria-hidden`, because the button's own text already names the preset: an
					`aria-label` on the picture would announce the same thing twice.
				-->
				<svg
					v-if="choice.thumbnail !== null"
					class="rp-asset-preset-preview"
					:viewBox="choice.thumbnail.viewBox"
					aria-hidden="true"
				>
					<path
						class="rp-asset-preset-preview__footprint"
						:d="choice.thumbnail.footprint"
					/>
					<path
						v-for="(detail, index) in choice.thumbnail.details"
						:key="index"
						class="rp-asset-preset-preview__detail"
						:class="{ 'rp-asset-preset-preview__detail--dashed': detail.dashed }"
						:d="detail.d"
					/>
				</svg>
				{{ tr(`preset.${choice.preset.id}`) }}
			</button>
		</div>
	</template>
</template>
