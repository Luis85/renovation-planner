<script setup lang="ts">
import { computed } from 'vue';
import { ITEM_COLORS, type ItemColor, type ItemColorPreset } from '../../../domain/spatial/ItemColor';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import ItemColorSwatch from './ItemColorSwatch.vue';
import ItemColorCustom from './ItemColorCustom.vue';
import { colorTargets, itemColorLabel } from './itemColorTargets';

defineProps<{ menu?: boolean }>();
const emit = defineEmits<{ picked: [] }>();
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const targets = computed(() => colorTargets(project, selection.selectedIds));
const visible = computed(() => session.perspective === 'plan' && targets.value.length > 0);
const disabled = computed(() => runtime.groupActions.blocked.value || runtime.groupActions.active.value);
const current = computed(() => targets.value[0]?.color);
const presets: readonly (ItemColorPreset | undefined)[] = [undefined, ...ITEM_COLORS];
function choose(color: ItemColor | undefined): void {
	if (!visible.value || disabled.value) return;
	void runtime.groupActions.setColor(targets.value.map(target => target.id), color);
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
		:aria-busy="runtime.groupActions.active.value"
		@keydown="key"
	>
		<p class="rp-item-color__value">
			{{ tr('editor.item-color.label') }} · {{ itemColorLabel(current) }}
		</p>
		<div
			class="rp-item-color__choices"
			role="none"
		>
			<ItemColorSwatch
				v-for="color in presets"
				:key="color ?? 'default'"
				:color="color"
				:selected="current === color"
				:menu="menu"
				:disabled="disabled"
				@choose="choose(color)"
			/>
			<ItemColorCustom
				v-if="!menu"
				:color="current"
				:disabled="disabled"
				@choose="choose"
			/>
		</div>
	</div>
</template>
