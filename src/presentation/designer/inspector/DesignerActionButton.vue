<script setup lang="ts">
/**
 * One selection-inspector action button (`DesignerSelectionInspector`'s reorder, duplicate,
 * delete and fit-to-details rows), split out so its `aria-disabled` mapping and guarded click
 * carry their own template-complexity budget instead of sharing one with the `v-for` that
 * repeats it (fallow's template complexity is scored per SFC).
 *
 * `disabled` draws `aria-disabled` and a press that runs nothing, never `:disabled` — see
 * `DesignerSelectionInspector`'s own docblock on why (Chromium drops focus to `<body>`).
 *
 * **`icon` is AD18-R16 Task 10's icon-only variant, optional so every existing caller — the group
 * actions here, and `DesignerSelectionInspector`'s own text rows — is unchanged.** Absent, this
 * draws exactly as before: `label` as the button's own text, which IS its accessible name. Given
 * an icon, the text is replaced by the glyph and `label` moves to `aria-label` instead, following
 * `DesignerToolButton.vue`'s own convention: no `title`, because Obsidian draws its own tooltip
 * from `aria-label` — host behaviour this repository cannot check, so the claim is the attribute
 * and not the tooltip.
 */
import { computed } from 'vue';
import type { IconName } from 'obsidian';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';

const props = defineProps<{
	name: string;
	label: StringKey;
	disabled: boolean;
	onRun: () => void;
	icon?: IconName;
}>();

/** `aria-disabled` is only ever the literal string `'true'`, never `'false'` — house pattern, `AssetPriceRow.vue`'s `pausedAria`. */
const ariaDisabled = computed(() => (props.disabled ? 'true' : undefined));

function run(): void {
	if (!props.disabled) props.onRun();
}
</script>

<template>
	<button
		type="button"
		class="rp-designer-selection-button"
		:class="{ 'rp-designer-icon-button': icon !== undefined }"
		:name="name"
		:aria-disabled="ariaDisabled"
		:aria-label="icon === undefined ? undefined : tr(label)"
		@click="run"
	>
		<HostIcon
			v-if="icon !== undefined"
			:name="icon"
		/>
		<template v-else>
			{{ tr(label) }}
		</template>
	</button>
</template>
