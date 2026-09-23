import { computed, nextTick, reactive, ref } from 'vue';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import { useDialogStore } from '../dialogs/dialog-store';
import { pointerOutside } from '../editor/selection/menuKeyboard';
import type { CanvasMenuAction } from '../editor/selection/useCanvasMenuActions';
import { STAGE_PIXELS, screenPoint, screenToWorld, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { modifierLabel } from '../views/platformModifier';
import { selectionAbilities, selectionKeysRefused, type SelectionKeyActions } from './designerKeys';
import { partRows, type PartRow } from './parts/partRows';
import type { DesignerRuntime } from './runtime';
import { hitDesign } from './selection/hitTest';
import type { DesignerSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';

const MENU = '.rp-canvas-context-menu';
const CONTROLS = '.rp-plan-overlay, button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="menu"]';

/**
 * The asset designer's context menu (AD18-R16 Task 11, board 02 panel 7): Group, Ungroup, Duplicate
 * and Delete for the selection, opened by a right-click on a part on the canvas or on a Parts row, and
 * by Shift+F10 or the ContextMenu key on either. `DesignerContextMenu.vue` draws it.
 *
 * **Its four handlers are bound in `AssetDesignerRoot`'s TEMPLATE, on the designer's own root
 * element, never with `addEventListener`** — `designerOwnerListeners.test.ts` refuses that call under
 * this directory, and a template binding is element-local by construction. That is also why this is a
 * composable the root calls rather than state inside the component: the root element is the one
 * place every request arrives, and `event.currentTarget` there IS that element.
 *
 * **The Plan Editor's list, not a copy of it.** `CanvasMenuList` draws the rows, the separators, the
 * roving focus and Escape/Tab; this decides only what the menu is ABOUT and where it opens — the half
 * of `CanvasContextMenu` that is Plan-Editor-specific. The one widening the list took is
 * `CanvasMenuAction.shortcut`, the key hint at a row's end.
 *
 * **Every item is a selection KEY's own action**, on the very `selectionKeyActions` instance the root
 * builds for the keys: Group and Ungroup are what Ctrl+G and Ctrl+Shift+G call, Duplicate and Delete
 * what Ctrl+D and Delete call — one write through `editShape`, a refusal through `notifyIfRefused`. An
 * item is `aria-disabled` exactly where `selectionAbilities` says its action would do nothing, which
 * is the same answer that decides whether its key is claimed.
 *
 * **A right-click on a part makes it the FOCUSED part** (`AssetDesignStore.focus`, the Plan Editor's
 * `selection.focus`): a part outside the selection is selected alone, and a member keeps the whole set
 * but becomes the member every per-part item acts on. The canvas keys' refusals apply
 * (`AssetDesignerRoot`'s `onCanvasKeyDown`): only under Select, never with a press still held, never
 * over a dialog. Empty canvas, a group row, a control or the canvas overlay, and a part none of the
 * four can act on open nothing, and the browser keeps its own event. A right press claims no camera and no tool gesture: `EditorSurface`
 * forwards only a primary press, and its pan override claims only the middle button or a space-held
 * primary.
 */
export function useDesignerContextMenu(runtime: Pick<DesignerRuntime, 'activeToolId' | 'toolManager' | 'partView'>, actions: SelectionKeyActions) {
	const store = useAssetDesignStore(), editor = useEditorStore(), dialogs = useDialogStore();
	const open = ref(false), position = ref({ left: '0px', top: '0px' });
	let root!: HTMLElement, opener!: HTMLElement;

	/** The focused part the open menu is about; `null` — and nothing drawn — once a refresh took it away. */
	const focused = computed(() => store.selection);

	/**
	 * Read only while `focused` is non-null — `DesignerContextMenu` draws the list under that condition —
	 * and a selection implies a design: `AssetDesignStore.fail` empties the set, so the cast below stands
	 * on nothing the store does not already hold. Greyed by `selectionAbilities`, the keys' own answer.
	 *
	 * TWO groups, so `CanvasMenuList` draws ONE separator, between Ungroup and Duplicate (board 02 panel 7,
	 * AD18-R17 Task 3): a group is only where the shared list draws a line, and this menu has one.
	 */
	const items = computed((): CanvasMenuAction[] => {
		const can = selectionAbilities((store.design as AssetDesignDto).shape, store.selected), mod = modifierLabel();
		return [
			{ id: 'group', label: 'designer.arrange.group', group: 'arrange', icon: 'group', shortcut: tr('designer.menu.shortcut.group', { mod }), disabled: !can.group, run: actions.groupSelection },
			{ id: 'ungroup', label: 'designer.arrange.ungroup', group: 'arrange', icon: 'ungroup', shortcut: tr('designer.menu.shortcut.ungroup', { mod }), disabled: !can.ungroup, run: actions.ungroupSelection },
			{ id: 'duplicate', label: 'designer.selection.duplicate', group: 'edit', icon: 'copy', shortcut: tr('designer.menu.shortcut.duplicate', { mod }), disabled: !can.duplicate, run: actions.duplicateSelection },
			{ id: 'delete', label: 'designer.selection.delete', group: 'edit', icon: 'trash', shortcut: tr('designer.menu.shortcut.delete'), disabled: !can.delete, run: actions.deleteSelection },
		];
	});

	/** A Parts row's own part; the part under a pointer on the canvas, or the focused part for a key there; otherwise nothing. */
	function partAt(event: MouseEvent | KeyboardEvent, target: HTMLElement): DesignerSelection | null {
		const shape = store.design?.shape ?? null;
		const row = target.closest<HTMLButtonElement>('.rp-designer-part-row');
		// Only a row with a part draws this button, so the lookup always finds it.
		if (row !== null) return (partRows(shape, { hasReference: false }).find((each) => each.key === row.name) as PartRow).selection;
		const canvas = target.closest<HTMLElement>('.rp-plan-canvas');
		// The canvas's own overlay (rulers, the dimension buttons and their fields, the legend) and any
		// control keep their own context menu and keys — the Plan Editor refuses the same targets.
		if (canvas === null || target.closest(CONTROLS) !== null) return null;
		if (event instanceof KeyboardEvent) return store.selection;
		if (shape === null) return null;
		const bounds = canvas.getBoundingClientRect();
		const world = screenToWorld(screenPoint(event.clientX - bounds.left, event.clientY - bounds.top), editor.viewport, STAGE_PIXELS);
		const hit = hitDesign(shape, world, { selection: store.selection, mode: store.mode, worldPerPixel: worldPerScreenPixel(editor.viewport, STAGE_PIXELS), hidden: runtime.partView.hidden.value });
		// A handle belongs to the focused part, so a right-click on one is about that part.
		return hit === null ? null : hit.kind === 'handle' ? store.selection : hit.selection;
	}

	async function show(event: MouseEvent | KeyboardEvent): Promise<void> {
		if (dialogs.current !== null || selectionKeysRefused(runtime)) return;
		const target = event.target as HTMLElement, part = partAt(event, target);
		// A part none of the four can act on (the footprint, the anchor, the facing) opens nothing: a menu
		// of greyed items is a dead control, and the browser keeps its own event. Asked of the part ALONE,
		// which is exact — a graphic can always be duplicated, and a non-graphic is only ever selected alone.
		// A part was only found on a drawn design, hence the cast.
		if (part === null || !Object.values(selectionAbilities((store.design as AssetDesignDto).shape, [part])).includes(true)) return;
		event.preventDefault();
		event.stopPropagation();
		root = event.currentTarget as HTMLElement;
		// The right-clicked part becomes the FOCUSED one — every per-part item reads the focused member —
		// and a set it already belongs to is kept (the Plan Editor's `selection.focus`).
		store.focus(part);
		// The row's own button or the canvas: where focus goes back to, and where a key's menu opens.
		opener = target.closest<HTMLElement>('.rp-designer-part-row, .rp-plan-canvas') as HTMLElement;
		const from = opener.getBoundingClientRect(), host = root.getBoundingClientRect();
		const x = (event instanceof KeyboardEvent ? from.left + from.width / 2 : event.clientX) - host.left;
		const y = (event instanceof KeyboardEvent ? from.top + from.height / 2 : event.clientY) - host.top;
		open.value = true;
		await nextTick();
		// Opened AT the point and then pulled back inside the leaf, 8px clear of its edges, once its size is known.
		const menu = root.querySelector(MENU) as HTMLElement;
		position.value = { left: `${Math.max(8, Math.min(x, host.width - menu.offsetWidth - 8))}px`, top: `${Math.max(8, Math.min(y, host.height - menu.offsetHeight - 8))}px` };
		(menu.querySelector('[role="menuitem"]') as HTMLElement).focus();
	}

	function close(restore = true): void {
		open.value = false;
		if (restore) opener.focus();
	}

	/**
	 * Focus goes back to the opener at once, and the action runs. A write can then unmount the opener —
	 * Delete removes its Parts row, and a group re-nests rows — and a browser drops focus to `<body>`
	 * when the focused element goes. So once the action has settled and redrawn, focus the browser
	 * DROPPED (to `<body>`, or nowhere) is handed to the CANVAS — and only dropped focus: the await spans
	 * the vault write, and a user who clicked into a note or opened an Obsidian modal meanwhile keeps
	 * their focus there, or their next Backspace would delete a part. The canvas, because it is the one
	 * control every one of these writes leaves standing (a Parts row may be the very thing removed, and
	 * the list itself is not a focus target), and it is where the same four actions' keys work, so the
	 * next keystroke still means something. It is always
	 * there: a failed read-back after a write keeps the previous design drawn (`runtime.refresh`).
	 */
	async function runAndRefocus(action: CanvasMenuAction): Promise<void> {
		close();
		await action.run();
		await nextTick();
		if (focusDropped()) (root.querySelector('.rp-plan-canvas') as HTMLElement).focus();
	}

	return reactive({
		open,
		position,
		focused,
		items,
		close,
		run(action: CanvasMenuAction): void {
			void runAndRefocus(action);
		},
		context(event: MouseEvent): void {
			void show(event);
		},
		key(event: KeyboardEvent): void {
			if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) void show(event);
		},
		outside(event: PointerEvent): void {
			if (open.value && pointerOutside(root.querySelector(MENU), event)) close(false);
		},
		leave(event: FocusEvent): void {
			if (open.value && !root.contains(event.relatedTarget as Node | null)) close(false);
		},
	});
}

export type DesignerContextMenuState = ReturnType<typeof useDesignerContextMenu>;

/**
 * Whether focus was DROPPED — to `<body>`, or nowhere — as a browser does when the focused element is
 * unmounted. Only then may a door that ran a write move it: the write awaits the vault, and a user who
 * clicked into a note or opened a modal meanwhile keeps their focus there. The menu's `runAndRefocus`
 * and the Parts rows' keys (`DesignerPartsPanel`) both ask it.
 */
export function focusDropped(): boolean {
	return ([null, document.body] as (Element | null)[]).includes(document.activeElement);
}
