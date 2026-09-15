<script setup lang="ts">
import { computed } from 'vue';
import { isItemColorPreset, ITEM_COLORS, type ItemColorPreset } from '../../../domain/spatial/ItemColor';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import ItemColorSwatch from './ItemColorSwatch.vue';

defineProps<{ menu?: boolean }>();
const emit = defineEmits<{ picked: [] }>();
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const element = computed(() => selection.selectedIds.length === 1 ? project.structure.elements?.find(item => item.id === selection.selectedIds[0] && (item.kind === 'object' || item.kind === 'asset')) : undefined);
const visible = computed(() => session.perspective === 'plan' && element.value !== undefined);
const disabled = computed(() => !runtime.elementTask.available || runtime.elementActions.blocked.value || runtime.elementActions.active.value);
const colors: readonly (ItemColorPreset | undefined)[] = [undefined, ...ITEM_COLORS];
// A custom hex has no preset label yet (plan colours design §1); this palette still shows only the six presets.
const label = (color: ItemColorPreset | undefined) => tr(`editor.item-color.${color ?? 'default'}`);
const presetColor = (color: string | undefined): ItemColorPreset | undefined => color !== undefined && isItemColorPreset(color) ? color : undefined;
function choose(color: ItemColorPreset | undefined): void {
	if (!visible.value || disabled.value || !element.value) return;
	void runtime.elementActions.setColor(element.value.id, color);
	emit('picked');
}
/** Left/right move within the palette; Up/down remain the enclosing menu's row navigation. Enter/Space apply. */
function key(event: KeyboardEvent): void {
	if (['Enter', ' '].includes(event.key)) { event.stopPropagation(); return; }
	if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	// A native listener's currentTarget is the mounted palette, including when focus is on a child button.
	const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
	const from = buttons.indexOf(event.target as HTMLButtonElement);
	buttons[(from + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
}
</script>
<template>
	<div
		v-if="visible"
		class="rp-item-color"
		role="group"
		:aria-label="tr('editor.item-color.label')"
		:aria-busy="runtime.elementActions.active.value"
		@keydown="key"
	>
		<p class="rp-item-color__value">
			{{ tr('editor.item-color.label') }} · {{ label(presetColor(element?.color)) }}
		</p>
		<div
			class="rp-item-color__choices"
			role="none"
		>
			<ItemColorSwatch
				v-for="color in colors"
				:key="color ?? 'default'"
				:color="color"
				:selected="element?.color === color"
				:menu="menu"
				:disabled="disabled"
				@choose="choose(color)"
			/>
		</div>
	</div>
</template>
