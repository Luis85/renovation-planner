<script setup lang="ts">
/**
 * One selection-inspector action button (`DesignerSelectionInspector`'s reorder, duplicate,
 * delete and fit-to-details rows), split out so its `aria-disabled` mapping and guarded click
 * carry their own template-complexity budget instead of sharing one with the `v-for` that
 * repeats it (fallow's template complexity is scored per SFC).
 *
 * `disabled` draws `aria-disabled` and a press that runs nothing, never `:disabled` — see
 * `DesignerSelectionInspector`'s own docblock on why (Chromium drops focus to `<body>`).
 */
import { computed } from 'vue';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';

const props = defineProps<{
	name: string;
	label: StringKey;
	disabled: boolean;
	onRun: () => void;
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
		:name="name"
		:aria-disabled="ariaDisabled"
		@click="run"
	>
		{{ tr(label) }}
	</button>
</template>
