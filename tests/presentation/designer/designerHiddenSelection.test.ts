/**
 * @vitest-environment jsdom
 *
 * AD18-R20: a SELECTED part that is not drawn — the clearance while `Show clearance` is off, or a
 * graphic the Parts panel has hidden — keeps its selection but draws no outline, no handles and no
 * rotate arrow, and a press where one of its handles would be reshapes nothing. Showing it again brings
 * back exactly the marks it had. `DesignerCanvas`'s `marks` and `hitDesign` both ask `drawnSelection`;
 * `selection/hitTest.test.ts` sweeps every handle of the rule's hit half without a canvas.
 *
 * Driven through `designerRig`, the real wiring: selection by Parts row, hiding by the two real
 * controls. Marks are counted with `isVisible()`, which asks every ancestor too — a hidden LAYER still
 * holds its nodes for `find`, so a plain count could not tell an over-broad layer binding apart.
 */
import { describe, expect, it } from 'vitest';
import { distance } from '../../../src/core/geometry/operations';
import { selectionHandles } from '../../../src/presentation/designer/selection/handles';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../../src/presentation/editor/viewport/Viewport';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { editableShape } from '../../helpers/assetShapes';
import { drag, selecting, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

const partRow = (rig: DesignerRig, name: string) => rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
const drawnCount = (rig: DesignerRig, name: string) => rig.stage.find(name).filter((node) => node.isVisible()).length;
const selectionDrawn = (rig: DesignerRig) => ({
	outline: drawnCount(rig, '.asset-selection-outline') > 0,
	handles: drawnCount(rig, '.asset-selection-handle'),
	stem: drawnCount(rig, '.asset-rotate-stem') > 0,
});
const NOTHING = { outline: false, handles: 0, stem: false };

async function press(rig: DesignerRig, row: string): Promise<void> {
	partRow(rig, row).click();
	await settle();
}

interface Hider {
	readonly row: string;
	hide(rig: DesignerRig): Promise<void>;
	show(rig: DesignerRig): Promise<void>;
}

const showClearance = (on: boolean) => async (rig: DesignerRig) => {
	await rig.wrapper.get('[name="show-clearance"]').setValue(on);
	await settle();
};
// The selected graphic's own Hide / Show control, which its pressed row opens.
const toggleHidden = async (rig: DesignerRig) => {
	await rig.wrapper.get('[name="toggle-hidden"]').trigger('click');
	await settle();
};

const HIDERS: ReadonlyArray<readonly [string, Hider]> = [
	['the clearance, behind Show clearance', { row: 'clearance', hide: showClearance(false), show: showClearance(true) }],
	['a graphic, hidden in the Parts panel', { row: 'detail:detail-1', hide: toggleHidden, show: toggleHidden }],
];

describe.each(HIDERS)('a selected part that is not drawn: %s', (_label, hider) => {
	it('keeps its selection and draws none of it, while another part’s selection draws, and comes back exactly on show', async () => {
		const rig = await selecting(editableShape());
		try {
			const store = useAssetDesignStore(rig.pinia);
			await press(rig, hider.row);
			const part = store.selection;
			const before = selectionDrawn(rig);
			expect(before).toMatchObject({ outline: true, stem: true });
			expect(before.handles).toBeGreaterThan(0);

			await hider.hide(rig);
			expect(store.selection).toEqual(part);
			expect(partRow(rig, hider.row).getAttribute('aria-pressed')).toBe('true');
			expect(selectionDrawn(rig)).toEqual(NOTHING);

			// Another part's marks are untouched by the rule.
			await press(rig, 'footprint');
			expect(selectionDrawn(rig)).toMatchObject({ outline: true, stem: true });
			expect(selectionDrawn(rig).handles).toBeGreaterThan(0);

			// Its Parts row still selects it while it is hidden, and still draws nothing of it.
			await press(rig, hider.row);
			expect(store.selection).toEqual(part);
			expect(selectionDrawn(rig)).toEqual(NOTHING);

			await hider.show(rig);
			expect(store.selection).toEqual(part);
			expect(selectionDrawn(rig)).toEqual(before);
		} finally {
			rig.unmount();
		}
	});

	it('takes no drag on where one of its handles would be', async () => {
		const rig = await selecting(editableShape());
		try {
			const store = useAssetDesignStore(rig.pinia);
			await press(rig, hider.row);
			await hider.hide(rig);
			const before = (await rig.document()).shape;
			// The handle furthest from the origin: for both parts it lies on empty canvas, so the fixed
			// press is a marquee rather than a grab of some other part drawn beneath it.
			const worldPerPixel = worldPerScreenPixel(useEditorStore(rig.pinia).viewport, STAGE_PIXELS);
			const handles = selectionHandles(editableShape(), store.selection, store.mode, worldPerPixel);
			const far = handles.reduce((best, each) => (distance(each.at, { x: 0, y: 0 }) > distance(best.at, { x: 0, y: 0 }) ? each : best)).at;
			drag(rig, far, { x: far.x + 200, y: far.y + 200 });
			await settle();
			expect((await rig.document()).shape).toEqual(before);
		} finally {
			rig.unmount();
		}
	});
});
