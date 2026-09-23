import { computed, nextTick, reactive, ref } from 'vue';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import type { AssetShape } from '../../domain/asset/AssetShape';
import { groupOfDetail } from '../../domain/asset/groupEdits';
import { useDialogStore } from '../dialogs/dialog-store';
import { pointerOutside } from '../editor/selection/menuKeyboard';
import type { CanvasMenuAction } from '../editor/selection/useCanvasMenuActions';
import { STAGE_PIXELS, screenPoint, screenToWorld, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { modifierLabel } from '../views/platformModifier';
import { canGroup, selectedGraphics, selectionKeyActions } from './designerKeys';
import { partRows, type PartRow } from './parts/partRows';
import type { DesignerRuntime } from './runtime';
import { hitDesign } from './selection/hitTest';
import { sameSelection, type DesignerSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';

const MENU = '.rp-canvas-context-menu';

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
 * **Every item is a selection KEY's own action** (`selectionKeyActions`): Group and Ungroup are what
 * Ctrl+G and Ctrl+Shift+G call, Duplicate and Delete what Ctrl+D and Delete call — one write through
 * `editShape`, a refusal through `notifyIfRefused`. An item is `aria-disabled` exactly where that
 * action would do nothing: Group by `canGroup`, the Arrange panel's own rule; Ungroup unless the
 * focused graphic is in a group; Duplicate unless it is a graphic; Delete unless it is a graphic or the
 * clearance.
 *
 * **A right-click on a part that is not selected selects it first**, as the Plan Editor's does; one
 * that IS selected keeps the whole set, so a multi-selection can be grouped from the menu. The canvas
 * keys' refusals apply (`AssetDesignerRoot`'s `onCanvasKeyDown`): only under Select, never with a press
 * still held, never over a dialog. Empty canvas, a group row and anything else open nothing, and the
 * browser keeps its own event. A right press claims no camera and no tool gesture: `EditorSurface`
 * forwards only a primary press, and its pan override claims only the middle button or a space-held
 * primary.
 */
export function useDesignerContextMenu(runtime: Pick<DesignerRuntime, 'editShape' | 'activeToolId' | 'toolManager' | 'partView'>) {
	const store = useAssetDesignStore(), editor = useEditorStore(), dialogs = useDialogStore();
	const actions = selectionKeyActions(store, runtime.editShape, runtime.activeToolId);
	const open = ref(false), position = ref({ left: '0px', top: '0px' });
	let root!: HTMLElement, opener!: HTMLElement;

	/** The focused part the open menu is about; `null` — and nothing drawn — once a refresh took it away. */
	const focused = computed(() => store.selection);

	/**
	 * Read only while `focused` is non-null — `DesignerContextMenu` draws the list under that condition —
	 * and a selection implies a shape: `AssetDesignStore.hydrate` prunes every member its shape lacks, and
	 * `fail` empties the set, so neither cast below stands on anything the store does not already hold.
	 */
	const items = computed((): CanvasMenuAction[] => {
		const shape = (store.design as AssetDesignDto).shape as AssetShape, part = focused.value as DesignerSelection;
		const detail = part.kind === 'detail' ? part.id : null, mod = modifierLabel();
		return [
			{ id: 'group', label: 'designer.arrange.group', group: 'arrange', icon: 'group', shortcut: tr('designer.menu.shortcut.group', { mod }), disabled: !canGroup(shape, selectedGraphics(shape, store.selected)), run: actions.groupSelection },
			{ id: 'ungroup', label: 'designer.arrange.ungroup', group: 'arrange', icon: 'ungroup', shortcut: tr('designer.menu.shortcut.ungroup', { mod }), disabled: detail === null || groupOfDetail(shape, detail) === null, run: actions.ungroupSelection },
			{ id: 'duplicate', label: 'designer.selection.duplicate', group: 'edit', icon: 'copy', shortcut: tr('designer.menu.shortcut.duplicate', { mod }), disabled: detail === null, run: actions.duplicateSelection },
			{ id: 'delete', label: 'designer.selection.delete', group: 'destructive', icon: 'trash', shortcut: tr('designer.menu.shortcut.delete'), disabled: detail === null && part.kind !== 'clearance', run: actions.deleteSelection },
		];
	});

	/** A Parts row's own part; the part under a pointer on the canvas, or the focused part for a key there; otherwise nothing. */
	function partAt(event: MouseEvent | KeyboardEvent, target: HTMLElement): DesignerSelection | null {
		const shape = store.design?.shape ?? null;
		const row = target.closest<HTMLButtonElement>('.rp-designer-part-row');
		// Only a row with a part draws this button, so the lookup always finds it.
		if (row !== null) return (partRows(shape, { hasReference: false }).find((each) => each.key === row.name) as PartRow).selection;
		const canvas = target.closest<HTMLElement>('.rp-plan-canvas');
		if (canvas === null) return null;
		if (event instanceof KeyboardEvent) return store.selection;
		if (shape === null) return null;
		const bounds = canvas.getBoundingClientRect();
		const world = screenToWorld(screenPoint(event.clientX - bounds.left, event.clientY - bounds.top), editor.viewport, STAGE_PIXELS);
		const hit = hitDesign(shape, world, { selection: store.selection, mode: store.mode, worldPerPixel: worldPerScreenPixel(editor.viewport, STAGE_PIXELS), hidden: runtime.partView.hidden.value });
		// A handle belongs to the focused part, so a right-click on one is about that part.
		return hit === null ? null : hit.kind === 'handle' ? store.selection : hit.selection;
	}

	async function show(event: MouseEvent | KeyboardEvent): Promise<void> {
		if (dialogs.current !== null || runtime.activeToolId.value !== 'select' || runtime.toolManager.activeToolHasDraft()) return;
		const target = event.target as HTMLElement, part = partAt(event, target);
		if (part === null) return;
		event.preventDefault();
		event.stopPropagation();
		root = event.currentTarget as HTMLElement;
		if (!store.selected.some((member) => sameSelection(member, part))) store.select(part);
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

	return reactive({
		open,
		position,
		focused,
		items,
		close,
		run(action: CanvasMenuAction): void {
			close();
			void action.run();
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
