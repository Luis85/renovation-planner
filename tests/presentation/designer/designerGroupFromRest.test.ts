/**
 * @vitest-environment jsdom
 *
 * Grouping from the state the designer OPENS in, over a real sidecar (AD18-R20, the reported "grouping
 * does not work"). Every other group test clicks Select first (`selecting`), so none of them saw the two
 * faults a user meets on arrival: the leaf rests in camera mode (`activeToolId === null`), where the
 * context menu and the selection keys refused every request and said nothing, and a Parts row replaced
 * the selection whatever Shift or the `Select multiple` toggle said, so no set could be built there.
 *
 * Driven through Parts rows and DOM events on them, never the stage: synthetic pointer events do not
 * reach Konva.
 */
import { describe, expect, it } from 'vitest';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { designerRig, type DesignerRig } from '../../helpers/designerRig';
import { rightClick } from '../../helpers/designerRightClick';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const GROUP = [{ id: 'group-1', members: ['detail-1', 'detail-2'] }];

function row(rig: DesignerRig, name: string): HTMLButtonElement {
	return rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
}

function menuItem(rig: DesignerRig, id: string): HTMLElement | null {
	return rig.wrapper.element.querySelector(`.rp-canvas-context-menu [data-rp-context-action="${id}"]`);
}

/** The designer as it opens: no tool chosen, which the toolbar draws as Pan. */
async function atRest(): Promise<DesignerRig> {
	const rig = await designerRig({ shape: TOILET });
	expect(useEditorStore(rig.pinia).activeToolId).toBeNull();
	return rig;
}

async function press(rig: DesignerRig, name: string, init: MouseEventInit = {}): Promise<void> {
	row(rig, name).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
	await settle();
}

describe('building a set from the Parts rows', () => {
	it('adds a row to the selection with Shift, and a second Shift press takes it back out', async () => {
		const rig = await atRest();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'detail-1' }, { kind: 'detail', id: 'detail-2' }]);

		await press(rig, 'detail:detail-2', { shiftKey: true });
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([{ kind: 'detail', id: 'detail-1' }]);
		rig.unmount();
	});

	it('adds a plain press while Select multiple is on, which is the path with no modifier', async () => {
		const rig = await atRest();
		const toggle = rig.wrapper.element.querySelector('[data-rp-action="multiple-selection"]') as HTMLInputElement;
		toggle.click();
		await settle();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2');
		expect(useAssetDesignStore(rig.pinia).selected).toHaveLength(2);
		rig.unmount();
	});
});

describe('grouping at rest, through a real write', () => {
	it('opens the context menu on a selected row and groups the set', async () => {
		const rig = await atRest();
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
		const rig = await atRest();
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

	it('groups the set with Ctrl+G on a selected row', async () => {
		const rig = await atRest();
		await press(rig, 'detail:detail-1');
		await press(rig, 'detail:detail-2', { shiftKey: true });
		row(rig, 'detail:detail-2').dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }));
		await settle();
		expect((await rig.document()).shape?.groups).toEqual(GROUP);
		rig.unmount();
	});
});
