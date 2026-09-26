/**
 * @vitest-environment jsdom
 *
 * Three clauses of `Calibrate a sheet and reserve space` that the suite had only half of:
 *
 * - 21f, "the drag hits nothing and starts a MARQUEE instead" — `designerHiddenSelection.test.ts`
 *   asserts only that such a drag writes nothing, which a press swallowed whole would also satisfy;
 * - 21f, the marks reappear "EXACTLY as they were" — that file compares an outline flag, a handle
 *   COUNT and a stem flag, in Transform mode only, so a re-show that drew the marks somewhere else or
 *   in another mode's shape went unseen;
 * - 21l, a footprint nudge with the clearance hidden leaves "the clearance unaffected" — the e2e
 *   checks only that `Show clearance` stays off.
 */
import { describe, expect, it } from 'vitest';
import { distance } from '../../../src/core/geometry/operations';
import type { SelectionMode } from '../../../src/presentation/designer/selection/designerSelection';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { selectionHandles } from '../../../src/presentation/designer/selection/handles';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../../src/presentation/editor/viewport/Viewport';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { t } from '../../../src/presentation/i18n/strings';
import { editableShape } from '../../helpers/assetShapes';
import { band, held, selecting, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

async function pressRow(rig: DesignerRig, name: string): Promise<void> {
	(rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement).click();
	await settle();
}

async function showClearance(rig: DesignerRig, on: boolean): Promise<void> {
	await rig.wrapper.get('[name="show-clearance"]').setValue(on);
	await settle();
}

/** A rig with the clearance selected by its Parts row. */
async function clearanceSelected(): Promise<DesignerRig> {
	const rig = await selecting(editableShape());
	await pressRow(rig, 'clearance');
	return rig;
}

const MARKS = ['.asset-selection-outline', '.asset-selection-handle', '.asset-rotate-stem'] as const;

/**
 * Every visible selection mark as the SCREEN draws it: `getClientRect` takes the layer's camera
 * transform with it, so a mark back at the same world point under a moved camera differs too.
 */
const drawnMarks = (rig: DesignerRig) =>
	MARKS.flatMap((name) => rig.stage.find(name).filter((node) => node.isVisible()).map((node) => ({ name, rect: node.getClientRect() })));

const MODES: ReadonlyArray<readonly [SelectionMode, StringKey]> = [
	['transform', 'designer.selection.mode.transform'],
	['points', 'designer.selection.mode.points'],
	['bend', 'designer.selection.mode.bend'],
];

describe('the clearance, selected and then hidden behind Show clearance', () => {
	it('answers a press where its handle was with a marquee', async () => {
		const rig = await clearanceSelected();
		try {
			const store = useAssetDesignStore(rig.pinia);
			await showClearance(rig, false);
			// `designerHiddenSelection.test.ts`'s handle: the one furthest out, which lies on empty canvas.
			const worldPerPixel = worldPerScreenPixel(useEditorStore(rig.pinia).viewport, STAGE_PIXELS);
			const handles = selectionHandles(editableShape(), store.selection, store.mode, worldPerPixel);
			const far = handles.reduce((best, each) => (distance(each.at, { x: 0, y: 0 }) > distance(best.at, { x: 0, y: 0 }) ? each : best)).at;
			// Twenty screen pixels of travel: past the four-pixel sweep threshold and short of any edge.
			const to = { x: far.x + 20 * worldPerPixel, y: far.y + 20 * worldPerPixel };

			held(rig, 'pointerdown', far, 1);
			held(rig, 'pointermove', to, 1);
			await settle();
			expect(band(rig)).toBeDefined();

			held(rig, 'pointerup', to, 0);
			await settle();
			expect(band(rig)).toBeUndefined();
		} finally {
			rig.unmount();
		}
	});

	it.each(MODES)('draws its marks again exactly where and as they were, in %s mode', async (mode, label) => {
		const rig = await clearanceSelected();
		try {
			rig.toolbarButton(t('en', label)).click();
			await settle();
			expect(useAssetDesignStore(rig.pinia).mode).toBe(mode);
			const before = drawnMarks(rig);
			expect(before.some((mark) => mark.name === '.asset-selection-handle')).toBe(true);

			await showClearance(rig, false);
			expect(drawnMarks(rig)).toEqual([]);
			await showClearance(rig, true);

			expect(drawnMarks(rig)).toEqual(before);
		} finally {
			rig.unmount();
		}
	});
});

describe('the clearance, hidden and NOT selected, while the footprint is nudged', () => {
	it('keeps its geometry on disk and on the canvas, and stays hidden', async () => {
		const rig = await selecting(editableShape());
		try {
			await showClearance(rig, false);
			const drawnClearance = () => rig.stage.findOne('.asset-clearance-outline')?.getAttr('points') as unknown;
			const before = (await rig.document()).shape;
			const drawnBefore = drawnClearance();
			expect(drawnBefore).toBeDefined();

			await pressRow(rig, 'footprint');
			rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
			await settle();

			const after = (await rig.document()).shape;
			// The nudge really wrote, so an unchanged clearance below is not a write that never happened.
			expect(after?.footprint).not.toEqual(before?.footprint);
			expect(after?.clearance).toEqual(before?.clearance);
			expect(drawnClearance()).toEqual(drawnBefore);
			expect((rig.wrapper.get('[name="show-clearance"]').element as HTMLInputElement).checked).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});
