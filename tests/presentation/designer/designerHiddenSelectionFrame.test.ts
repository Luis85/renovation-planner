/**
 * @vitest-environment jsdom
 *
 * AD18-R23: the rulers' extent band and `Shift+2` follow `drawnSelection` (AD18-R20), as the canvas
 * marks do. A SELECTED part the canvas does not draw — the clearance while `Show clearance` is off, a
 * graphic hidden in Parts — gets no band and no frame, and showing it again brings back exactly the band
 * and the frame it had. Another part selected meanwhile — the footprint — keeps both, which is what
 * catches a rule applied at the mount site rather than per part. `designerHiddenSelection.test.ts` is
 * the marks half of the same rule.
 *
 * Driven through `designerRig`, the real wiring: selection by Parts row, hiding by the two real
 * controls, `Shift+2` as a keydown on the canvas. Every press starts from one fixed camera, so a
 * press that frames nothing is the camera left exactly where it was put.
 */
import { describe, expect, it } from 'vitest';
import type { Viewport } from '../../../src/presentation/editor/viewport/Viewport';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { editableShape } from '../../helpers/assetShapes';
import { pressRow as press, selecting, showClearance, toggleHidden, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

/** A camera no fit in these cases lands on, so a frame that happened is one that moved it. */
const PARKED: Viewport = { pan: { x: 12345, y: -6789 }, zoom: 0.02 };

/** Each strip's band as the template wrote it — its own `style` attribute, where the camera arithmetic lands. */
const bands = (rig: DesignerRig) => [...rig.wrapper.element.querySelectorAll('.rp-designer-ruler__extent')].map((band) => band.getAttribute('style'));

/** `Shift+2` on the canvas from the parked camera; answers the camera it leaves. */
async function frameSelection(rig: DesignerRig): Promise<Viewport> {
	const editor = useEditorStore(rig.pinia);
	editor.viewport = PARKED;
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: '@', code: 'Digit2', shiftKey: true, bubbles: true, cancelable: true }));
	await settle();
	return editor.viewport;
}

interface Hider {
	readonly row: string;
	hide(rig: DesignerRig): Promise<void>;
	show(rig: DesignerRig): Promise<void>;
}

const HIDERS: ReadonlyArray<readonly [string, Hider]> = [
	['the clearance, behind Show clearance', { row: 'clearance', hide: (rig: DesignerRig) => showClearance(rig, false), show: (rig: DesignerRig) => showClearance(rig, true) }],
	['a graphic, hidden in the Parts panel', { row: 'detail:detail-1', hide: toggleHidden, show: toggleHidden }],
];

describe.each(HIDERS)('the rulers’ band and Shift+2 over a selected part that is not drawn: %s', (_label, hider) => {
	it('draws no band while it is hidden, and exactly its band again once it is shown', async () => {
		const rig = await selecting(editableShape());
		try {
			const store = useAssetDesignStore(rig.pinia);
			await press(rig, hider.row);
			const part = store.selection;
			const before = bands(rig);
			expect(before).toHaveLength(2);

			await hider.hide(rig);
			expect(store.selection).toEqual(part);
			expect(bands(rig)).toEqual([]);

			// Another part's band is untouched by the rule, and its row still selects the hidden part again.
			await press(rig, 'footprint');
			expect(bands(rig)).toHaveLength(2);
			await press(rig, hider.row);
			expect(bands(rig)).toEqual([]);

			await hider.show(rig);
			expect(store.selection).toEqual(part);
			expect(bands(rig)).toEqual(before);
		} finally {
			rig.unmount();
		}
	});

	it('frames nothing on Shift+2 while it is hidden, and exactly its frame again once it is shown', async () => {
		const rig = await selecting(editableShape());
		try {
			const store = useAssetDesignStore(rig.pinia);
			await press(rig, hider.row);
			const part = store.selection;
			const framed = await frameSelection(rig);
			expect(framed).not.toEqual(PARKED);

			await hider.hide(rig);
			expect(store.selection).toEqual(part);
			expect(await frameSelection(rig)).toEqual(PARKED);

			// Another part still frames while this one is hidden.
			await press(rig, 'footprint');
			expect(await frameSelection(rig)).not.toEqual(PARKED);
			await press(rig, hider.row);
			expect(await frameSelection(rig)).toEqual(PARKED);

			await hider.show(rig);
			expect(store.selection).toEqual(part);
			expect(await frameSelection(rig)).toEqual(framed);
		} finally {
			rig.unmount();
		}
	});
});
