<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { isSubmenu, type CanvasMenuAction, type CanvasMenuItem, type CanvasMenuSubmenu } from './useCanvasMenuActions';
import { submenuPlacement } from './submenuPlacement';
import { focusStep } from './menuKeyboard';

defineOptions({ name: 'CanvasMenuList' });
const props = defineProps<{ items: readonly CanvasMenuItem[]; label: string; title?: string | null; host: HTMLElement | null; nested?: boolean; position?: { left: string; top: string } }>();
const emit = defineEmits<{ run: [action: CanvasMenuAction]; close: [restore: boolean]; back: [] }>();
const menu = ref<HTMLElement | null>(null), open = ref<string | null>(null);
let openedByHover = false;
/** Where THIS list's own open child submenu sits — computed here, in the parent, because only the parent knows the opening button's rect; handed down as the child's `position` prop rather than kept for this list's own style, which always uses the incoming `position` prop instead (design spec §5.4). */
const childPosition = ref({ left: '0px', top: '0px' });
const LEVEL = ':scope > [role="menuitem"], :scope > [role="none"] > [role="menuitem"], :scope > .rp-item-color [role="menuitemradio"]';
defineExpose({ menu });
watch(() => props.items, () => { open.value = null; });
function separated(item: CanvasMenuItem, previous: CanvasMenuItem | undefined): boolean { return !!previous && item.group !== previous.group; }
function ariaDisabled(item: CanvasMenuItem): true | undefined { return item.disabled || undefined; }
function reasonTitle(item: CanvasMenuItem): string | undefined { return item.disabled && item.reason ? tr(item.reason) : undefined; }
function levelItems(): HTMLElement[] { return [...menu.value?.querySelectorAll<HTMLElement>(LEVEL) ?? []]; }
async function expand(item: CanvasMenuSubmenu, opener: HTMLElement, focusFirst: boolean): Promise<void> {
	if (item.disabled) return;
	open.value = item.id;
	await nextTick();
	const child = opener.parentElement?.querySelector<HTMLElement>(':scope > [role="menu"]');
	if (child && props.host) {
		const at = submenuPlacement(opener.getBoundingClientRect(), { width: child.offsetWidth, height: child.offsetHeight }, props.host.getBoundingClientRect());
		// `position: fixed` is viewport-relative only when no ancestor contains it, and Obsidian's `.workspace-leaf` is `contain: strict` — so subtract where the child's containing block actually starts, measured from where it is drawn now.
		const drawn = child.getBoundingClientRect(), originLeft = drawn.left - Number.parseFloat(child.style.left), originTop = drawn.top - Number.parseFloat(child.style.top);
		childPosition.value = { left: `${at.left - originLeft}px`, top: `${at.top - originTop}px` };
	}
	if (focusFirst) child?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
}
function collapse(): void {
	const id = open.value; open.value = null;
	if (id) menu.value?.querySelector<HTMLElement>(`[data-rp-context-action="${id}"]`)?.focus();
}
function activate(item: CanvasMenuItem, event: Event, focusFirst: boolean): void {
	if (isSubmenu(item)) {
		// A pointer enters before its click: that first click must retain the submenu it just opened.
		if (open.value === item.id && !focusFirst && !openedByHover) open.value = null;
		else void expand(item, event.currentTarget as HTMLElement, focusFirst);
		openedByHover = false; return;
	}
	if (!item.disabled) emit('run', item);
}
function hover(item: CanvasMenuItem, event: Event): void {
	openedByHover = isSubmenu(item);
	if (isSubmenu(item)) void expand(item, event.currentTarget as HTMLElement, false); else open.value = null;
}
function navigate(event: KeyboardEvent): boolean {
	if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { focusStep(event.key, levelItems()); return true; }
	return false;
}
/** Escape on an open submenu's own anchor closes just that submenu first — the same "innermost popup first" step Escape takes from inside it — and only a second press (nothing left open) closes the whole menu. */
function escape(item: CanvasMenuItem | undefined): void {
	if (props.nested) { emit('back'); return; }
	if (item && isSubmenu(item) && open.value === item.id) { open.value = null; return; }
	emit('close', true);
}
function keydown(event: KeyboardEvent, item?: CanvasMenuItem): void {
	const handled = ['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key);
	if (!handled) return;
	event.preventDefault(); event.stopPropagation();
	if (event.key === 'Tab') emit('close', true);
	else if (event.key === 'Escape') escape(item);
	else if (event.key === 'ArrowLeft') { if (props.nested) emit('back'); }
	else if (navigate(event)) return;
	else if (item && (event.key !== 'ArrowRight' || isSubmenu(item))) activate(item, event, true);
}
</script>
<template>
	<div
		ref="menu"
		class="rp-canvas-context-menu"
		:class="{ 'rp-canvas-context-menu--nested': nested }"
		role="menu"
		:aria-label="label"
		:style="position"
		@keydown="keydown($event)"
	>
		<div
			v-if="title"
			class="rp-canvas-context-menu-title"
			role="presentation"
		>
			{{ title }}
		</div>
		<slot name="appearance" />
		<template
			v-for="(item, index) in items"
			:key="item.id"
		>
			<div
				v-if="separated(item, items[index - 1])"
				class="rp-canvas-context-menu-separator"
				role="separator"
			/>
			<div
				v-if="isSubmenu(item)"
				class="rp-canvas-context-submenu-anchor"
				role="none"
			>
				<button
					type="button"
					role="menuitem"
					tabindex="-1"
					aria-haspopup="menu"
					:aria-expanded="open === item.id"
					:aria-disabled="ariaDisabled(item)"
					:title="reasonTitle(item)"
					:data-rp-context-action="item.id"
					@click="activate(item, $event, false)"
					@pointerenter="hover(item, $event)"
					@keydown="keydown($event, item)"
				>
					<HostIcon :name="item.icon" />{{ tr(item.label) }}<HostIcon
						class="rp-canvas-context-menu-chevron"
						name="chevron-right"
					/>
				</button>
				<CanvasMenuList
					v-if="open === item.id"
					:items="item.children"
					:label="tr(item.label)"
					:host="host"
					:position="childPosition"
					nested
					@run="emit('run', $event)"
					@close="emit('close', $event)"
					@back="collapse"
				/>
			</div>
			<button
				v-else
				type="button"
				role="menuitem"
				tabindex="-1"
				:aria-disabled="ariaDisabled(item)"
				:title="reasonTitle(item)"
				:data-rp-context-action="item.id"
				@click="activate(item, $event, false)"
				@pointerenter="hover(item, $event)"
				@keydown="keydown($event, item)"
			>
				<HostIcon :name="item.icon" />{{ tr(item.label, item.params) }}
			</button>
		</template>
	</div>
</template>
