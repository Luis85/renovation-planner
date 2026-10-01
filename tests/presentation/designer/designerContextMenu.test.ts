/**
 * @vitest-environment jsdom
 *
 * The asset designer's context menu (AD18-R16 Task 11), MOUNTED in the real root over a real
 * sidecar: where it opens and on what, what it selects first, which items are live, that every item
 * writes what its key writes, and how it closes. Ctrl+G and Ctrl+Shift+G are driven here too, on the
 * canvas element the keys are bound to; `designerKeys.test.ts` holds their decisions and negative cases.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { DUPLICATE_OFFSET_MM } from '../../../src/domain/asset/detailEdits';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { selectionHandles } from '../../../src/presentation/designer/selection/handles';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../../src/presentation/editor/viewport/Viewport';
import { t } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { placeAt } from '../../helpers/layout';
import { designerRig, selecting, type DesignerRig } from '../../helpers/designerRig';
import { rightClick } from '../../helpers/designerRightClick';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = justInsideBottom(detailOutline('detail-2'));
// Inside the tank's far corner, well clear of every handle the bowl draws once it is selected.
const TANK: Point = { x: -170, y: -330 };
const FOOTPRINT: Point = { x: TOILET.footprint.points[1].x - 15, y: 0 };
const DETAIL_1 = { kind: 'detail', id: 'detail-1' } as const;
const DETAIL_2 = { kind: 'detail', id: 'detail-2' } as const;
const GROUPED: AssetShape = { ...TOILET, groups: [{ id: 'group-1', members: ['detail-1', 'detail-2'] }] };

function key(target: Element, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

function menu(rig: DesignerRig): HTMLElement | null {
	return (rig.wrapper.element as HTMLElement).querySelector<HTMLElement>('.rp-canvas-context-menu');
}

function item(rig: DesignerRig, id: string): HTMLButtonElement {
	return (menu(rig) as HTMLElement).querySelector(`[data-rp-context-action="${id}"]`) as HTMLButtonElement;
}

/** Each item's id and whether it is live, in the order drawn. */
function live(rig: DesignerRig): [string, boolean][] {
	return [...(menu(rig) as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]')].map((each) => [each.dataset.rpContextAction as string, each.getAttribute('aria-disabled') !== 'true']);
}

function row(rig: DesignerRig, name: string): HTMLButtonElement {
	return rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
}

async function opened(shape: AssetShape = TOILET): Promise<DesignerRig> {
	const rig = await selecting(shape);
	rightClick(rig, BOWL);
	await settle();
	return rig;
}

describe('opening on the canvas', () => {
	it('selects the unselected part under the pointer, and offers its four actions with their keys', async () => {
		const rig = await selecting(TOILET);
		const event = rightClick(rig, BOWL);
		await settle();

		expect(event.defaultPrevented).toBe(true);
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(menu(rig)?.getAttribute('aria-label')).toBe(t('en', 'designer.menu'));
		expect(live(rig)).toEqual([['group', false], ['ungroup', false], ['duplicate', true], ['delete', true]]);
		expect([...(menu(rig) as HTMLElement).querySelectorAll('.rp-canvas-context-menu-shortcut')].map((hint) => hint.textContent)).toEqual(['Ctrl+G', 'Ctrl+Shift+G', 'Ctrl+D', 'Del']);
		expect(document.activeElement).toBe(item(rig, 'group'));
		rig.unmount();
	});

	it('opens at the pointer, and is pulled back inside the leaf where the pointer is near its edge', async () => {
		const rig = await selecting(TOILET);
		const at = rig.at(BOWL);
		placeAt(rig.wrapper.element as HTMLElement, 0, 0, 800, 600);
		rightClick(rig, BOWL);
		await settle();
		expect([(menu(rig) as HTMLElement).style.left, (menu(rig) as HTMLElement).style.top]).toEqual([`${at.x}px`, `${at.y}px`]);

		// A leaf whose right edge IS the pointer: the menu is pulled left, its own width plus 8px clear of that edge.
		const width = (menu(rig) as HTMLElement).offsetWidth;
		key(document.activeElement as Element, { key: 'Escape' });
		placeAt(rig.wrapper.element as HTMLElement, 0, 0, at.x, 600);
		rightClick(rig, BOWL);
		await settle();
		expect([(menu(rig) as HTMLElement).style.left, (menu(rig) as HTMLElement).style.top]).toEqual([`${at.x - width - 8}px`, `${at.y}px`]);
		rig.unmount();
	});

	it('keeps a multi-selection the pointer is over, and groups and ungroups it', async () => {
		const rig = await selecting(TOILET);
		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'detail', id: 'detail-1' });
		store.extend({ kind: 'detail', id: 'detail-2' });
		rightClick(rig, TANK);
		await settle();

		expect(store.selected).toHaveLength(2);
		expect(live(rig)[0]).toEqual(['group', true]);
		item(rig, 'group').click();
		await settle();
		expect((await rig.document()).shape?.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-2'] }]);
		expect(menu(rig)).toBeNull();
		expect(document.activeElement).toBe(rig.canvasEl);

		rightClick(rig, BOWL);
		await settle();
		expect(live(rig).slice(0, 2)).toEqual([['group', false], ['ungroup', true]]);
		item(rig, 'ungroup').click();
		await settle();
		expect((await rig.document()).shape?.groups ?? []).toEqual([]);
		rig.unmount();
	});

	it('duplicates and deletes through the same actions as Ctrl+D and Delete', async () => {
		const rig = await opened();
		item(rig, 'duplicate').click();
		await settle();
		expect((await rig.document()).shape?.details.map((each) => each.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-3' });

		// The copy lies over the bowl, offset, and is topmost — so the same point is now the copy.
		rightClick(rig, BOWL);
		await settle();
		item(rig, 'delete').click();
		await settle();
		expect((await rig.document()).shape?.details.map((each) => each.id)).toEqual(['detail-1', 'detail-2']);
		rig.unmount();
	});

	it('writes nothing for a disabled item, and stays open', async () => {
		const rig = await opened();
		const before = await rig.document();

		item(rig, 'group').click();
		await settle();

		expect(await rig.document()).toEqual(before);
		expect(menu(rig)).not.toBeNull();
		rig.unmount();
	});

	it('opens nothing for a part none of the four can act on, and greys all but Delete for the clearance', async () => {
		const rig = await selecting(TOILET);
		const footprint = rightClick(rig, FOOTPRINT);
		const anchor = rightClick(rig, TOILET.anchor);
		await settle();
		expect([menu(rig), footprint.defaultPrevented, anchor.defaultPrevented]).toEqual([null, false, false]);
		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();

		const corner = TOILET.clearance?.points[2] as Point;
		rightClick(rig, { x: corner.x - 50, y: corner.y - 50 });
		await settle();
		expect(live(rig)).toEqual([['group', false], ['ungroup', false], ['duplicate', false], ['delete', true]]);
		rig.unmount();
	});

	it("is about the focused part when the pointer is on one of its handles", async () => {
		const rig = await selecting(TOILET);
		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'detail', id: 'detail-2' });
		const handle = selectionHandles(TOILET, store.selection, 'transform', worldPerScreenPixel(useEditorStore(rig.pinia).viewport, STAGE_PIXELS))[0];
		rightClick(rig, handle.at);
		await settle();

		expect(store.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(menu(rig)).not.toBeNull();
		rig.unmount();
	});

	it('opens nothing on empty canvas, or on a canvas with nothing drawn, and leaves the event alone', async () => {
		const rig = await selecting(TOILET);
		const empty = rightClick(rig, { x: 5000, y: 5000 });
		await settle();
		expect(empty.defaultPrevented).toBe(false);
		expect(menu(rig)).toBeNull();
		rig.unmount();

		const blank = await designerRig({ shape: null });
		blank.toolbarButton(t('en', 'designer.toolbar.select')).click();
		await settle();
		rightClick(blank, { x: 0, y: 0 });
		await settle();
		expect(menu(blank)).toBeNull();
		blank.unmount();
	});

	it('claims neither the camera nor a tool gesture with the right button', async () => {
		const rig = await selecting(TOILET);
		const editor = useEditorStore(rig.pinia);
		const before = { ...editor.viewport };
		const at = rig.at(BOWL);
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
		rig.canvasEl.dispatchEvent(new PointerEvent('pointermove', { button: -1, buttons: 2, pointerId: 1, clientX: at.x + 80, clientY: at.y + 60, bubbles: true }));
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { button: 2, buttons: 0, pointerId: 1, clientX: at.x + 80, clientY: at.y + 60, bubbles: true }));
		await settle();

		expect(editor.viewport).toEqual(before);
		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();
		rig.unmount();
	});
});

describe('opening from the Parts panel and the keyboard', () => {
	it('opens on a right-click on a Parts row, selecting its part, and gives focus back to the row', async () => {
		const rig = await selecting(TOILET);
		row(rig, 'clearance').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'clearance' });
		expect(live(rig)[3]).toEqual(['delete', true]);
		key(document.activeElement as Element, { key: 'Escape' });
		await settle();
		expect(menu(rig)).toBeNull();
		expect(document.activeElement).toBe(row(rig, 'clearance'));
		rig.unmount();
	});

	it('opens on Shift+F10 on a Parts row, and on the ContextMenu key on the canvas for the focused part', async () => {
		const rig = await selecting(TOILET);
		key(row(rig, 'detail:detail-1'), { key: 'F10', shiftKey: true });
		await settle();
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(menu(rig)).not.toBeNull();
		key(document.activeElement as Element, { key: 'Escape' });
		await settle();

		const event = key(rig.canvasEl, { key: 'ContextMenu' });
		await settle();
		expect(event.defaultPrevented).toBe(true);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(menu(rig)).not.toBeNull();
		rig.unmount();
	});

	it('opens nothing for a key on the canvas with nothing selected, a plain F10, or a group row', async () => {
		const rig = await selecting(GROUPED);
		key(rig.canvasEl, { key: 'ContextMenu' });
		key(rig.canvasEl, { key: 'F10' });
		const group = rig.wrapper.element.querySelector('.rp-designer-part[data-kind="group"] button') as HTMLElement;
		group.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();

		expect(menu(rig)).toBeNull();
		rig.unmount();
	});
});

describe('when it refuses to open', () => {
	it('under any tool but Select', async () => {
		const rig = await designerRig({ shape: TOILET });
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		rightClick(rig, BOWL);
		await settle();

		expect(menu(rig)).toBeNull();
		rig.unmount();
	});

	it('over an open dialog', async () => {
		const rig = await selecting(TOILET);
		void useDialogStore(rig.pinia).openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle();
		row(rig, 'clearance').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();

		expect(menu(rig)).toBeNull();
		rig.unmount();
	});

	it('while a press on the selection is still held', async () => {
		const rig = await selecting(TOILET);
		const at = rig.at(BOWL);
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
		rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }));
		await settle();

		expect(menu(rig)).toBeNull();
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { button: 0, buttons: 0, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
		rig.unmount();
	});
});

describe('closing', () => {
	it('closes on Escape, giving focus back to the canvas', async () => {
		const rig = await opened();
		key(document.activeElement as Element, { key: 'Escape' });
		await settle();

		expect(menu(rig)).toBeNull();
		expect(document.activeElement).toBe(rig.canvasEl);
		rig.unmount();
	});

	it('closes on a press outside it, and not on a press inside it', async () => {
		const rig = await opened();
		(menu(rig) as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		expect(menu(rig)).not.toBeNull();

		row(rig, 'footprint').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		expect(menu(rig)).toBeNull();
		rig.unmount();
	});

	it('closes when focus leaves the designer, and not when it moves within it', async () => {
		const rig = await opened();
		const outside = document.createElement('button');
		document.body.appendChild(outside);
		item(rig, 'group').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: item(rig, 'ungroup') }));
		await settle();
		expect(menu(rig)).not.toBeNull();

		item(rig, 'group').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
		await settle();
		expect(menu(rig)).toBeNull();
		outside.remove();
		rig.unmount();
	});

	it('draws nothing once its part is gone, and the next press closes it', async () => {
		const rig = await opened();
		useAssetDesignStore(rig.pinia).select(null);
		await settle();
		expect(menu(rig)).toBeNull();

		rightClick(rig, { x: 5000, y: 5000 });
		useAssetDesignStore(rig.pinia).select({ kind: 'footprint' });
		await settle();
		expect(menu(rig)).toBeNull();
		rig.unmount();
	});
});

describe('Ctrl+G and Ctrl+Shift+G on the canvas', () => {
	it('groups the selected graphics, and ungroups the focused one', async () => {
		const rig = await selecting(TOILET);
		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'detail', id: 'detail-1' });
		store.extend({ kind: 'detail', id: 'detail-2' });

		const group = key(rig.canvasEl, { key: 'g', ctrlKey: true });
		await settle();
		expect(group.defaultPrevented).toBe(true);
		expect((await rig.document()).shape?.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-2'] }]);

		key(rig.canvasEl, { key: 'G', ctrlKey: true, shiftKey: true });
		await settle();
		expect((await rig.document()).shape?.groups ?? []).toEqual([]);
		rig.unmount();
	});

	it('leaves Ctrl+G and Ctrl+Shift+G to the host when there is nothing to group or ungroup', async () => {
		const rig = await selecting(TOILET);
		useAssetDesignStore(rig.pinia).select(DETAIL_2);
		const before = await rig.document();

		const group = key(rig.canvasEl, { key: 'g', ctrlKey: true });
		const ungroup = key(rig.canvasEl, { key: 'G', ctrlKey: true, shiftKey: true });
		await settle();

		expect([group.defaultPrevented, ungroup.defaultPrevented]).toEqual([false, false]);
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});
});

describe('a multi-selection', () => {
	/** Both members selected with the BOWL focused, then a right-click on the TANK. */
	async function onTheTank(): Promise<DesignerRig> {
		const rig = await selecting(TOILET);
		const store = useAssetDesignStore(rig.pinia);
		store.select(DETAIL_1);
		store.extend(DETAIL_2);
		rightClick(rig, TANK);
		await settle();
		return rig;
	}

	it('makes the right-clicked member the focused one, keeping the set', async () => {
		const rig = await onTheTank();
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([DETAIL_2, DETAIL_1]);
		rig.unmount();
	});

	it('deletes the right-clicked member, not the member focused before', async () => {
		const rig = await onTheTank();
		item(rig, 'delete').click();
		await settle();
		expect((await rig.document()).shape?.details.map((each) => each.id)).toEqual(['detail-2']);
		rig.unmount();
	});

	it('duplicates the right-clicked member, not the member focused before', async () => {
		const rig = await onTheTank();
		item(rig, 'duplicate').click();
		await settle();
		const copy = (await rig.document()).shape?.details.find((each) => each.id === 'detail-3');
		expect(copy?.outline.points).toEqual(detailOutline('detail-1').points.map((point) => ({ x: point.x + DUPLICATE_OFFSET_MM, y: point.y + DUPLICATE_OFFSET_MM })));
		rig.unmount();
	});
});

describe('focus after an action from a Parts row', () => {
	it('goes to the canvas when Delete removed the row it came from', async () => {
		const rig = await selecting(TOILET);
		row(rig, 'detail:detail-2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();
		item(rig, 'delete').click();
		await settle();

		expect(row(rig, 'detail:detail-2')).toBeNull();
		expect(document.activeElement).toBe(rig.canvasEl);
		rig.unmount();
	});

	it('stays wherever the user took it while the write was in flight', async () => {
		const rig = await selecting(TOILET);
		const note = document.createElement('button');
		document.body.appendChild(note);
		row(rig, 'detail:detail-2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();
		item(rig, 'delete').click();
		// Before the vault write settles: a click into a note, or an Obsidian modal opening on `<body>`.
		note.focus();
		await settle();

		expect(row(rig, 'detail:detail-2')).toBeNull();
		expect(document.activeElement).toBe(note);
		note.remove();
		rig.unmount();
	});

	// An OUTCOME check, not proof of the fallback: jsdom keeps focus on a row Vue re-nests, so this
	// passes with the fallback removed too. The Delete case above is the one that proves it.
	it('leaves focus in the designer after Group re-nests the rows', async () => {
		const rig = await selecting(TOILET);
		const store = useAssetDesignStore(rig.pinia);
		store.select(DETAIL_1);
		store.extend(DETAIL_2);
		await settle();
		row(rig, 'detail:detail-1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();
		item(rig, 'group').click();
		await settle();

		expect((await rig.document()).shape?.groups).toHaveLength(1);
		expect((rig.wrapper.element as HTMLElement).contains(document.activeElement)).toBe(true);
		rig.unmount();
	});
});

describe("the canvas overlay's own controls", () => {
	it('keep their own context menu and keys', async () => {
		const rig = await selecting(TOILET);
		useAssetDesignStore(rig.pinia).select(DETAIL_2);
		await settle();
		const control = (rig.wrapper.element as HTMLElement).querySelector('.rp-plan-overlay button') as HTMLElement;

		const right = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		control.dispatchEvent(right);
		const shiftF10 = key(control, { key: 'F10', shiftKey: true });
		await settle();

		expect([menu(rig), right.defaultPrevented, shiftF10.defaultPrevented]).toEqual([null, false, false]);
		rig.unmount();
	});
});
