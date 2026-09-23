/**
 * @vitest-environment jsdom
 *
 * The designer's selection keys from a focused Parts ROW, and the context menu's one separator
 * (AD18-R17 Task 3), MOUNTED in the real root over a real sidecar. The keys run the canvas's own
 * `designerShortcut` over `selectionKeyActions`; `designerKeys.test.ts` holds their decisions and the
 * modifier discipline, and `designerKeyboard.test.ts` / `designerContextMenu.test.ts` the canvas side,
 * which this task leaves unchanged.
 *
 * Driven by DOM keydown on the row button, never on the stage: synthetic pointer events do not reach
 * Konva, and a row is where this task's keys are bound.
 */
import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { settle } from '../../helpers/editor';
import { selecting, type DesignerRig } from '../../helpers/designerRig';
import { TOILET } from '../../helpers/designerSelection';

const DETAIL_1 = { kind: 'detail', id: 'detail-1' } as const;
const DETAIL_2 = { kind: 'detail', id: 'detail-2' } as const;

function key(target: Element, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

function row(rig: DesignerRig, name: string): HTMLButtonElement {
	return rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
}

/** The bowl's row, pressed — selected and focused, which is how a keyboard user gets there. */
async function onTheBowl(shape: AssetShape = TOILET): Promise<{ rig: DesignerRig; bowl: HTMLButtonElement }> {
	const rig = await selecting(shape);
	const bowl = row(rig, 'detail:detail-2');
	bowl.focus();
	bowl.click();
	await settle();
	return { rig, bowl: row(rig, 'detail:detail-2') };
}

async function detailIds(rig: DesignerRig): Promise<string[] | undefined> {
	return (await rig.document()).shape?.details.map((detail) => detail.id);
}

describe('the context menu', () => {
	it('draws ONE separator, between Ungroup and Duplicate', async () => {
		const { rig, bowl } = await onTheBowl();
		bowl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		await settle();

		const menu = rig.wrapper.element.querySelector('.rp-canvas-context-menu') as HTMLElement;
		const drawn = [...menu.children].map((each) => (each.getAttribute('role') === 'separator' ? '|' : each.getAttribute('data-rp-context-action')));
		expect(drawn).toEqual(['group', 'ungroup', '|', 'duplicate', 'delete']);
		rig.unmount();
	});
});

describe('the selection keys on a focused Parts row', () => {
	it('Delete and Backspace delete the row’s part', async () => {
		const { rig, bowl } = await onTheBowl();
		key(bowl, { key: 'Delete' });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1']);

		const tank = row(rig, 'detail:detail-1');
		tank.click();
		await settle();
		key(row(rig, 'detail:detail-1'), { key: 'Backspace' });
		await settle();
		expect(await detailIds(rig)).toEqual([]);
		rig.unmount();
	});

	it('Ctrl+D and Cmd+D each duplicate ONCE — the canvas handler never sees a row’s key', async () => {
		const { rig, bowl } = await onTheBowl();
		const ctrl = key(bowl, { key: 'd', ctrlKey: true });
		await settle();
		expect(ctrl.defaultPrevented).toBe(true);
		expect(await detailIds(rig)).toHaveLength(3);

		const copy = useAssetDesignStore(rig.pinia).selection;
		expect(copy?.kind).toBe('detail');
		key(row(rig, `detail:${(copy as { id: string }).id}`), { key: 'd', metaKey: true });
		await settle();
		expect(await detailIds(rig)).toHaveLength(4);
		rig.unmount();
	});

	it('Ctrl+G groups the set and Ctrl+Shift+G ungroups it, from the focused member’s row', async () => {
		const { rig, bowl } = await onTheBowl();
		const store = useAssetDesignStore(rig.pinia);
		store.select(DETAIL_1);
		store.extend(DETAIL_2);
		await settle();

		const group = key(bowl, { key: 'g', ctrlKey: true });
		await settle();
		expect(group.defaultPrevented).toBe(true);
		expect((await rig.document()).shape?.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-2'] }]);

		const ungroup = key(row(rig, 'detail:detail-2'), { key: 'G', ctrlKey: true, shiftKey: true });
		await settle();
		expect(ungroup.defaultPrevented).toBe(true);
		expect((await rig.document()).shape?.groups ?? []).toEqual([]);
		rig.unmount();
	});

	it('keeps the modifier discipline: Ctrl+Alt+D and a held Delete are not claimed', async () => {
		const { rig, bowl } = await onTheBowl();
		const before = await rig.document();
		const alt = key(bowl, { key: 'd', ctrlKey: true, altKey: true });
		key(bowl, { key: 'Delete', repeat: true });
		await settle();
		expect(alt.defaultPrevented).toBe(false);
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('acts on nothing from a row that is not the focused part — arrowed to, not pressed', async () => {
		const { rig, bowl } = await onTheBowl();
		const before = await rig.document();
		key(bowl, { key: 'ArrowDown' });
		await settle();
		const tank = row(rig, 'detail:detail-1');
		expect(document.activeElement).toBe(tank);

		const duplicate = key(tank, { key: 'd', ctrlKey: true });
		key(tank, { key: 'Delete' });
		await settle();
		expect(duplicate.defaultPrevented).toBe(false);
		expect(await rig.document()).toEqual(before);
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([DETAIL_2]);
		rig.unmount();
	});
});

describe('never while typing', () => {
	it('Delete, Backspace and Ctrl+D in the row’s Label field edit the text, not the part', async () => {
		const { rig } = await onTheBowl();
		const before = await rig.document();
		const label = rig.wrapper.element.querySelector('input[name="part-label"]') as HTMLInputElement;
		label.focus();

		const presses = [key(label, { key: 'Delete' }), key(label, { key: 'Backspace' }), key(label, { key: 'd', ctrlKey: true })];
		await settle();

		expect(presses.map((each) => each.defaultPrevented)).toEqual([false, false, false]);
		expect(await rig.document()).toEqual(before);
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([DETAIL_2]);
		rig.unmount();
	});
});
