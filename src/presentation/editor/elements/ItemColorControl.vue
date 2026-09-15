<script setup lang="ts">
import { computed, ref } from 'vue';
import { ITEM_COLORS, itemColorKind, type ItemColor } from '../../../domain/spatial/ItemColor';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { ITEM_COLOR_RGB } from './itemColorAppearance';

defineProps<{ menu?: boolean }>();
const emit = defineEmits<{ picked: [] }>();
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const root = ref<HTMLElement | null>(null);
const element = computed(() => selection.selectedIds.length === 1 ? project.structure.elements?.find(item => item.id === selection.selectedIds[0] && itemColorKind(item.kind)) : undefined);
const visible = computed(() => session.perspective === 'plan' && element.value !== undefined);
const disabled = computed(() => !runtime.elementTask.available || runtime.elementActions.blocked.value || runtime.elementActions.active.value);
const colors: readonly (ItemColor | undefined)[] = [undefined, ...ITEM_COLORS];
const label = (color: ItemColor | undefined) => tr(`editor.item-color.${color ?? 'default'}`);
function choose(color: ItemColor | undefined): void {
	if (!visible.value || disabled.value || !element.value) return;
	void runtime.elementActions.setColor(element.value.id, color);
	emit('picked');
}
/** Left/right move within the palette; Up/down remain the enclosing menu's row navigation. Enter/Space apply. */
function key(event: KeyboardEvent): void {
	if (['Enter', ' '].includes(event.key)) { event.stopPropagation(); return; }
	if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	const buttons = [...root.value?.querySelectorAll<HTMLButtonElement>('button') ?? []];
	const from = buttons.indexOf(event.target as HTMLButtonElement);
	buttons[(from + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
}
</script>
<template>
	<div
		v-if="visible"
		ref="root"
		class="rp-item-color"
		role="group"
		:aria-label="tr('editor.item-color.label')"
		:aria-busy="runtime.elementActions.active.value"
		@keydown="key"
	>
		<p class="rp-item-color__value">
			{{ tr('editor.item-color.label') }} · {{ label(element?.color) }}
		</p>
		<div class="rp-item-color__choices" role="none">
			<button
				v-for="color in colors"
				:key="color ?? 'default'"
				type="button"
				class="rp-item-color__choice"
				:role="menu ? 'menuitemradio' : undefined"
				:tabindex="menu ? -1 : 0"
				:aria-checked="menu ? element?.color === color : undefined"
				:aria-pressed="menu ? undefined : element?.color === color"
				:aria-disabled="disabled"
				:aria-label="label(color)"
				:title="disabled ? tr('editor.input.unavailable') : label(color)"
				:data-rp-item-color="color ?? 'default'"
				@click="choose(color)"
			>
				<span class="rp-item-color__chip" :style="color ? { backgroundColor: ITEM_COLOR_RGB[color] } : undefined" aria-hidden="true">
					<HostIcon v-if="color === undefined" name="rotate-ccw" />
				</span>
				<HostIcon v-if="element?.color === color" class="rp-item-color__check" name="circle-check" />
			</button>
		</div>
	</div>
</template>
