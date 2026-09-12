<script setup lang="ts">
/**
 * The Property tree row's context menu (ADR-0029): Move up, Move down, then one "Mark as …"
 * entry per kind with the current one checked — drawn as a radio dot by the stylesheet, keyed on
 * `aria-checked` (`editor-shell-fidelity.css`), so sighted users see it too. Same
 * `rp-canvas-context-menu` chrome and `role="menu"` keyboard contract as `CanvasContextMenu`
 * (shared through `selection/menuKeyboard.ts`), deliberately NOT that component: it is bound to
 * the canvas, the selection store and the tool manager, none of which a tree row has.
 * Positioned inside `host` (`.renovation-plan-editor`, which `PropertyTree` teleports it into)
 * exactly as that menu is — the opening point, then clamped into the host once measured — and
 * closed by Escape, Tab, an outside pointer or a run action; `PropertyTree` returns focus to the
 * row that opened it.
 *
 * While writes are paused (`usePlanReorder().paused`) the menu still opens, every entry is
 * `aria-disabled` and titled with the stale-write reason — the canvas menu's own convention for a
 * greyed item — and a click does nothing. Every action goes through `usePlanReorder`, never the
 * command directly.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { PLAN_KINDS, type PlanKind } from '../../../domain/plan/PlanKind';
import { PLAN_KIND_ICONS, PLAN_KIND_LABELS } from '../editorIcons';
import { menuNavigation, pointerOutside } from '../selection/menuKeyboard';
import { usePlanReorder } from './usePlanReorder';

const props = defineProps<{
	readonly planId: string;
	readonly name: string;
	readonly kind: PlanKind;
	/** The pane this menu is teleported into: what the clamp below measures against. */
	readonly host: HTMLElement;
	readonly x: number;
	readonly y: number;
	readonly first: boolean;
	readonly last: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const reorder = usePlanReorder();
const paused = reorder.paused;
const menu = ref<HTMLElement | null>(null);
const position = ref({ left: `${props.x}px`, top: `${props.y}px` });

function run(disabled: boolean, action: () => Promise<unknown>): void {
	if (disabled || paused.value) return;
	emit('close');
	void action();
}
function navigation(event: KeyboardEvent): void { menuNavigation(event, '[role="menuitem"], [role="menuitemradio"]', () => emit('close')); }
function outside(event: PointerEvent): void { if (pointerOutside(menu.value, event)) emit('close'); }
onMounted(() => {
	document.addEventListener('pointerdown', outside, true);
	// Bound before `onMounted` runs and already placed in `host` by the Teleport, so it measures
	// here — a type-only cast, as `CanvasContextMenu` does for its group actions, since `!` is refused.
	const el = menu.value as HTMLElement;
	// The same clamp `CanvasContextMenu` applies once it can measure itself: inside the host, 8px in.
	position.value = { left: `${Math.max(8, Math.min(props.x, props.host.clientWidth - el.offsetWidth - 8))}px`, top: `${Math.max(8, Math.min(props.y, props.host.clientHeight - el.offsetHeight - 8))}px` };
	el.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true));
</script>

<template>
	<div
		ref="menu"
		class="rp-canvas-context-menu rp-property-tree__menu"
		role="menu"
		:aria-label="tr('editor.shell.row-menu', { name: props.name })"
		:style="position"
		@keydown="navigation"
	>
		<button
			type="button"
			role="menuitem"
			tabindex="-1"
			data-rp-tree-action="move-up"
			:aria-disabled="props.first || paused || undefined"
			:title="paused ? tr('editor.stale-write-refused') : undefined"
			@click="run(props.first, () => reorder.moveUp(props.planId))"
		>
			<HostIcon name="chevron-up" />{{ tr('editor.shell.move-up') }}
		</button>
		<button
			type="button"
			role="menuitem"
			tabindex="-1"
			data-rp-tree-action="move-down"
			:aria-disabled="props.last || paused || undefined"
			:title="paused ? tr('editor.stale-write-refused') : undefined"
			@click="run(props.last, () => reorder.moveDown(props.planId))"
		>
			<HostIcon name="chevron-down" />{{ tr('editor.shell.move-down') }}
		</button>
		<button
			v-for="option in PLAN_KINDS"
			:key="option"
			type="button"
			role="menuitemradio"
			tabindex="-1"
			:aria-checked="option === props.kind"
			:aria-disabled="paused || undefined"
			:title="paused ? tr('editor.stale-write-refused') : undefined"
			:data-rp-tree-action="`kind:${option}`"
			@click="run(false, () => reorder.setKind(props.planId, option))"
		>
			<HostIcon :name="PLAN_KIND_ICONS[option]" />{{ tr('editor.shell.kind-menu', { kind: tr(PLAN_KIND_LABELS[option]) }) }}
		</button>
	</div>
</template>
