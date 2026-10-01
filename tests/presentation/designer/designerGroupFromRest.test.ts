/**
 * @vitest-environment jsdom
 *
 * Grouping from the state the designer OPENED in, over a real sidecar (AD18-R20, the reported "grouping
 * does not work"). Every other group test clicks Select first (`selecting`), so none of them saw the two
 * faults a user met on arrival: the leaf rested in camera mode (`activeToolId === null`), where the
 * context menu and the selection keys refused every request and said nothing, and a Parts row replaced
 * the selection whatever Shift or the `Select multiple` toggle said, so no set could be built there.
 *
 * The designer rests in Select since the same ruling, so every case below PICKS Pan first except the
 * one under "grouping at the rest a leaf opens in": camera mode keeps the selection keys (b261b1866)
 * and those cases go on proving it, while that one is the same Group at the rest a leaf opens in today.
 *
 * Driven through Parts rows and DOM events on them, never the stage: synthetic pointer events do not
 * reach Konva.
 */
import { describe, expect, it } from 'vitest';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { t } from '../../../src/presentation/i18n/strings';
import { settle } from '../../helpers/editor';
import { designerRig, held, type DesignerRig } from '../../helpers/designerRig';
import { selectionHandles } from '../../../src/presentation/designer/selection/handles';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../../src/presentation/editor/viewport/Viewport';
import { rightClick } from '../../helpers/designerRightClick';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const GROUP = [{ id: 'group-1', members: ['detail-1', 'detail-2'] }];

function row(rig: DesignerRig, name: string): HTMLButtonElement {
	return rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
}

function menuItem(rig: DesignerRig, id: string): HTMLElement | null {
	return rig.wrapper.element.querySelector(`.rp-canvas-context-menu [data-rp-context-action="${id}"]`);
}

/** The designer in camera mode, reached the way a user reaches it: by pressing Pan. */
async function inCameraMode(): Promise<DesignerRig> {
	const rig = await designerRig({ shape: TOILET });
	rig.toolbarButton(t('en', 'designer.toolbar.pan')).click();
	await settle();
	expect(useEditorStore(rig.pinia).activeToolId).toBeNull();
	return rig;
}

async function press(rig: DesignerRig, name: string, init: MouseEventInit = {}): Promise<void> {
	row(rig, name).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
	await settle();
}

describe('building a set from the Parts rows', () => {
	it('adds a row to the selection with Shift, and a second Shift press takes it back out', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'detail-1' }, { kind: 'detail', id: 'detail-2' }]);

		await press(rig, 'detail:detail-2', { shiftKey: true });
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'detail-1' }]);
		rig.unmount();
	});

	it('adds a plain press while Select multiple is on, which is the path with no modifier', async () => {
		const rig = await inCameraMode();
		const toggle = rig.wrapper.element.querySelector('[data-rp-action="multiple-selection"]') as HTMLInputElement;
		toggle.click();
		await settle();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2');
		expect(useAssetDesignStore(rig.pinia).selected).toHaveLength(2);
		rig.unmount();
	});
});

describe('grouping with Pan chosen, through a real write', () => {
	it('opens the context menu on a selected row and groups the set', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		row(rig, 'detail:detail-2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();

		expect(menuItem(rig, 'group')?.getAttribute('aria-disabled')).not.toBe('true');
		(menuItem(rig, 'group') as HTMLElement).click();
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});

	it('opens the context menu on a selected part on the CANVAS, where a primary press pans', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		const event = rightClick(rig, justInsideBottom(detailOutline('detail-2')));
		await settle();

		expect(event.defaultPrevented).toBe(true);
		expect(useAssetDesignStore(rig.pinia).selected).toHaveLength(2);
		(menuItem(rig, 'group') as HTMLElement).click();
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});

	it('groups the set with Ctrl+G on the canvas itself', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }));
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});

	it('groups the set with Ctrl+G on a selected row', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		row(rig, 'detail:detail-2').dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }));
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});
});

describe('grouping at the rest a leaf opens in', () => {
	it('groups a set built from the rows with Ctrl+G, with no tool chosen first', async () => {
		const rig = await designerRig({ shape: TOILET });
		expect(useEditorStore(rig.pinia).activeToolId).toBe('select');
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }));
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});
});

describe('what camera mode does NOT hand the menu', () => {
	it('is never about a handle, which only Select draws', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-2');
		const store = useAssetDesignStore(rig.pinia);
		const rotate = selectionHandles(TOILET, store.selection, 'transform', worldPerScreenPixel(useEditorStore(rig.pinia).viewport, STAGE_PIXELS)).find((handle) => handle.role.kind === 'rotate');
		rightClick(rig, rotate?.at ?? { x: 0, y: 0 });
		await settle();
		// Under Select this point is the bowl's rotate handle, and the menu would be about the bowl.
		expect(menuItem(rig, 'group') !== null && store.selected.length === 1 && store.selection?.kind === 'detail' && store.selection.id === 'detail-2').toBe(false);
		rig.unmount();
	});

	it('opens nothing while a pan is still dragging', async () => {
		const rig = await inCameraMode();
		await press(rig, 'detail:detail-2');
		const bowl = justInsideBottom(detailOutline('detail-2'));
		held(rig, 'pointerdown', bowl, 1);
		held(rig, 'pointermove', { x: bowl.x + 40, y: bowl.y }, 1);
		expect(useEditorStore(rig.pinia).dragState).not.toBeNull();
		rightClick(rig, bowl);
		await settle();
		expect(menuItem(rig, 'group')).toBeNull();
		held(rig, 'pointerup', bowl, 0);
		rig.unmount();
	});
});
