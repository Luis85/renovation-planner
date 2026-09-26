/**
 * @vitest-environment jsdom
 *
 * `Design an Asset.md` step 81: the scale bar is "stepped to match the rulers". `designerScaleBar.test.ts`
 * reads the bar alone and checks its own 0 / middle / end proportion; nothing there reads the RULERS at the
 * same camera, so a bar counting in a step series of its own passed it. Here both are read off one mounted
 * designer at each camera of a sweep across the viewport's range.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from '../../../../src/presentation/editor/viewport/Viewport';
import { t } from '../../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';

/**
 * Stage pixels per millimetre, from the viewport's floor to its ceiling in steps of about 10%. Dense on purpose: a
 * bar stepping a series of its own disagrees with the rulers only inside narrow camera bands — a bar whose step
 * floor were 10 px rather than the rulers' 12 differs from them only where a step lands between 10 and 12 px, a
 * band 20% wide, and draws the same marks as the rulers across most of it. An 18-camera sweep missed it.
 */
const SAMPLES = 81;
const ZOOMS = Array.from({ length: SAMPLES }, (_unused, index) => MIN_ZOOM * (MAX_ZOOM / MIN_ZOOM) ** (index / (SAMPLES - 1)));

let live: DesignerRig | null = null;
afterEach(() => {
	live?.unmount();
	live = null;
});

/** The rulers' step, from the one name they carry, among the candidates the bar could have spanned. */
function rulerStep(rig: DesignerRig, candidates: readonly number[]): number | undefined {
	const name = rig.wrapper.get('.rp-designer-rulers').attributes('aria-label');
	return candidates.find((step) => name === t('en', 'designer.rulers', { step: String(step) }));
}

describe('the scale bar against the rulers at the same camera', () => {
	it('spans a whole number of ruler steps — two, four or ten — with its middle on a step and its length the rulers’ tick times that count', async () => {
		live = await designerRig({ shape: editableShape() });
		const editor = useEditorStore(live.pinia);

		for (const zoom of ZOOMS) {
			editor.viewport = { ...DEFAULT_VIEWPORT, zoom };
			await settle();
			const marks = live.wrapper.findAll('.rp-designer-scale-bar__mark, .rp-designer-scale-bar__end').map((mark) => Number.parseFloat(mark.text()));
			const [zero, middle, end] = marks;
			const counts = [2, 4, 10].filter((count) => end % count === 0);
			const step = rulerStep(live, counts.map((count) => end / count));
			const tick = Number.parseFloat((live.wrapper.get('.rp-designer-ruler--top').element as HTMLElement).style.backgroundSize);
			const width = Number.parseFloat((live.wrapper.get('.rp-designer-scale-bar__ruler').element as HTMLElement).style.width);

			expect({ zoom, zero, found: step !== undefined }).toEqual({ zoom, zero: 0, found: true });
			const count = end / (step as number);
			expect({ zoom, middle: middle / (step as number) }).toEqual({ zoom, middle: count / 2 });
			expect(width / tick).toBeCloseTo(count, 9);
		}
	});
});
