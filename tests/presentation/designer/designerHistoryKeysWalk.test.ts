/**
 * @vitest-environment jsdom
 *
 * Two of `Design an Asset.md`'s history steps, MOUNTED over a real sidecar, that `designerHistoryKeys.test.ts`
 * does not drive: step 120's "cancel it, and Ctrl+Z then undoes normally" and step 121's chord claimed with
 * nothing left to undo. The write undone is the same one that file uses — a Delete of the toilet's bowl on
 * the canvas, one real `SetAssetShape` and one undo entry — so every assertion reads the sidecar.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { settle } from '../../helpers/editor';
import { click, held, selecting, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

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

async function afterDelete(): Promise<DesignerRig> {
	const rig = await selecting(TOILET);
	live = rig;
	click(rig, justInsideBottom(detailOutline('detail-2')));
	await settle();
	key(rig.canvasEl, { key: 'Delete' });
	await settle();
	expect(await detailIds(rig)).toEqual(['detail-1']);
	return rig;
}

describe('step 120: a draw gesture cancelled with Escape', () => {
	/**
	 * The chord is pressed with the button STILL down: `ToolManager.pointerUp` clears the in-flight flag on its
	 * own, so a chord pressed after the release would pass whether or not Escape's `cancelGesture` cleared it.
	 */
	it('declines Ctrl+Z while a rectangle is held, then undoes normally once Escape has cancelled it', async () => {
		const rig = await afterDelete();
		rig.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		await settle();
		held(rig, 'pointerdown', { x: 1000, y: 1000 }, 1);
		held(rig, 'pointermove', { x: 1200, y: 1200 }, 1);

		const refused = key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(refused.defaultPrevented).toBe(true);
		expect(await detailIds(rig)).toEqual(['detail-1']);

		key(rig.canvasEl, { key: 'Escape' });
		expect(rig.activeToolId()).toBe('draw-rect');
		key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);

		// The release after the cancel draws nothing: the undo is the only change.
		held(rig, 'pointerup', { x: 1200, y: 1200 }, 0);
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
	});
});

describe('step 121: Ctrl+Z with nothing left to undo', () => {
	it('is still claimed and goes no further, though nothing changes', async () => {
		const rig = await afterDelete();
		key(rig.canvasEl, { key: 'z', ctrlKey: true });
		await settle();
		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		const before = await rig.document();
		// A bubble-phase listener on the document, which a stopped event never reaches — jsdom cannot
		// say whether Obsidian's own hotkeys listen there; the host half is measured separately by
		// `assetDesignerWalkKeys.e2e.ts` step 121.
		const host = vi.fn<(event: KeyboardEvent) => void>();
		document.addEventListener('keydown', host);

		try {
			const again = key(rig.canvasEl, { key: 'z', ctrlKey: true });
			await settle();

			expect(again.defaultPrevented).toBe(true);
			expect(host).not.toHaveBeenCalled();
			expect(await rig.document()).toEqual(before);
			expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2']);
		} finally {
			document.removeEventListener('keydown', host);
		}
	});
});
