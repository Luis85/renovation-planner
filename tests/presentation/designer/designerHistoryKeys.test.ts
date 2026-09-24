/**
 * @vitest-environment jsdom
 *
 * The designer's history chords (AD18-R23): Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y, and Cmd, on the ROOT
 * through `editorHistoryShortcut`, MOUNTED over a real sidecar. The helper has no unit file of its own;
 * the Plan Editor's side is driven in `inputInteractions.test.ts` and its neighbours. This file asks
 * whether the designer reaches it, from each region, and whether it passes the right refusals.
 *
 * The write undone is a Delete of the bowl, pressed on the canvas — one real `SetAssetShape`, one undo
 * entry — so every assertion reads the sidecar rather than a store.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { settle } from '../../helpers/editor';
import { click, held, selecting, type DesignerRig } from '../../helpers/designerRig';
import { t } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');

/** The case's leaf, unmounted after it whether it passed or not, so a failure leaks no leaf into the next case. */
let live: DesignerRig | null = null;
afterEach(() => {
	live?.unmount();
	live = null;
});

function key(target: Element, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

async function detailIds(rig: DesignerRig): Promise<string[] | undefined> {
	return (await rig.document()).shape?.details.map((detail) => detail.id);
}

/** The toilet with its bowl deleted by a real key on the canvas: one write, one undo entry. */
async function afterDelete(): Promise<DesignerRig> {
	const rig = await selecting(TOILET);
	live = rig;
	click(rig, justInsideBottom(BOWL));
	await settle();
	key(rig.canvasEl, { key: 'Delete' });
	await settle();
	expect(await detailIds(rig)).toEqual(['detail-1']);
	return rig;
}

/** One primary pointer event on the canvas, held on the press — `designerKeyboard.test.ts`'s own. */
function pointer(rig: DesignerRig, type: 'pointerdown' | 'pointerup', world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }),
	);
}

describe('the history chords', () => {
	it('Ctrl+Z undoes a write and Ctrl+Shift+Z redoes it, pressed on the canvas', async () => {
		const rig = await afterDelete();

		const undo = key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(undo.defaultPrevented).toBe(true);
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);

		key(rig.canvasEl, { key: 'Z', ctrlKey: true, shiftKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1']);
	});

	it('Ctrl+Y redoes, and Cmd stands for Ctrl', async () => {
		const rig = await afterDelete();

		key(rig.canvasEl, { key: 'z', metaKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);

		key(rig.canvasEl, { key: 'y', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1']);
	});

	it('reaches a Parts row and an Inspector control, not the canvas alone', async () => {
		const rig = await afterDelete();
		const tank = rig.wrapper.element.querySelector('.rp-designer-part-row[name="detail:detail-1"]') as HTMLElement;

		key(tank, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);

		const tab = rig.wrapper.element.querySelector('.rp-designer-inspector [role="tab"]') as HTMLElement;
		key(tab, { key: 'y', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1']);
	});

	/**
	 * Undo runs while the inline form stays open. That is the ACCEPTED parity with the Plan Editor, whose
	 * capture-bound root takes the chord from inside its AddMenu the same way, and not an accident this
	 * case happens to lock in: it pins that the form's bubble-phase `keydown.stop` cannot hide the chord.
	 */
	it('reaches a control inside an open dimension form, whose own keydown.stop is bubble-phase (Plan Editor parity: the form stays open)', async () => {
		const rig = await afterDelete();
		(rig.wrapper.get('.rp-designer-dimensions [data-rp-dimension="overall-width"]').element as HTMLButtonElement).click();
		await settle();

		key(rig.wrapper.get('.rp-designer-dimension__form button[type="submit"]').element, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
	});
});

describe('what the chords leave alone', () => {
	it('a focused Inspector field keeps its own native Ctrl+Z', async () => {
		const rig = await afterDelete();
		const field = rig.wrapper.element.querySelector('.rp-designer-inspector input[name="height"]') as HTMLInputElement;

		const undo = key(field, { key: 'z', ctrlKey: true });
		await settle();

		expect(undo.defaultPrevented).toBe(false);
		expect(await detailIds(rig)).toEqual(['detail-1']);
	});

	it('a chord pressed while a press is still held is claimed and undoes nothing', async () => {
		const rig = await afterDelete();
		const empty = { x: 1000, y: 1000 };
		pointer(rig, 'pointerdown', empty);

		const undo = key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(undo.defaultPrevented).toBe(true);
		expect(await detailIds(rig)).toEqual(['detail-1']);

		pointer(rig, 'pointerup', empty);
		await settle();
		key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
	});

	it('a chord pressed while a camera pan is dragging is claimed and undoes nothing', async () => {
		const rig = await afterDelete();
		rig.toolbarButton(t('en', 'designer.toolbar.pan')).click();
		await settle();
		// Camera mode: a primary drag pans, so `dragState` is set and no tool holds a gesture.
		const empty = { x: 1000, y: 1000 };
		held(rig, 'pointerdown', empty, 1);
		held(rig, 'pointermove', { x: 1400, y: 1000 }, 1);
		expect(useEditorStore(rig.pinia).dragState).not.toBeNull();

		const undo = key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(undo.defaultPrevented).toBe(true);
		expect(await detailIds(rig)).toEqual(['detail-1']);

		held(rig, 'pointerup', { x: 1400, y: 1000 }, 0);
		await settle();
		key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
	});

	it('a chord pressed with a dialog open is left to the dialog and undoes nothing', async () => {
		const rig = await afterDelete();
		const dialogs = useDialogStore(rig.pinia);
		const closed = dialogs.openDialog({ kind: 'confirm', title: 'Probe', message: 'Probe', confirmLabel: 'OK' });
		await settle();

		// Pressed where a real key comes from while the regions are inert: the dialog's own button.
		const undo = key(rig.wrapper.element.querySelector('[role="dialog"] button') as HTMLElement, { key: 'z', ctrlKey: true });
		await settle();
		expect(undo.defaultPrevented).toBe(false);
		expect(await detailIds(rig)).toEqual(['detail-1']);

		dialogs.resolve('cancel');
		await closed;
	});
});
