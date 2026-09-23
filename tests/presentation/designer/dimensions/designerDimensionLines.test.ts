/**
 * @vitest-environment jsdom
 *
 * AD18-R17's dimension row as a mounted surface: each drawn dimension is a LINE with an arrowhead
 * at each end and extension lines to the edges it measures, labelled with its unit; the clearance's
 * figures follow `Show clearance`; and a resting label paints above the canvas key.
 *
 * A sibling of `designerDimensions.test.ts` rather than more cases in it, because that file is past
 * the suite's line budget. Same rig, same camera: `DEFAULT_VIEWPORT` (`camera: 'default'`), so
 * `screen = (world + 480) / 10`, over `editableShape()`'s 1000 x 600 footprint centred on the origin
 * — its top edge runs from (-2, 18) to (98, 18) and its left edge from (-2, 18) to (-2, 78).
 *
 * **jsdom draws nothing**, so what is asserted is the path data the template writes and the rules
 * the stylesheet declares. Whether the marks read as drafting at a 460 leaf is a browser question.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { footprintFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { editableShape } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';
import { propertyOf, show, stylesheetRules } from '../../../helpers/selectors';

const designer = (): Promise<DesignerRig> => designerRig({ shape: editableShape(), camera: 'default' });

/** Each figure's two paths, by the figure they belong to, in DOM order. */
function marks(rig: DesignerRig): [string, string, string][] {
	return rig.wrapper.findAll('.rp-designer-dimension-lines [data-rp-dimension-line]').map((group) => [
		group.attributes('data-rp-dimension-line') ?? '',
		group.get('.rp-designer-dimension-lines__line').attributes('d') ?? '',
		group.get('.rp-designer-dimension-lines__arrows').attributes('d') ?? '',
	]);
}

const names = (rig: DesignerRig): string[] =>
	rig.wrapper.findAll('.rp-designer-dimension__value').map((button) => (button.element as HTMLElement).dataset['rpDimension'] ?? '');

describe('the lines each dimension draws', () => {
	/**
	 * Board 01's drafting marks, end to end at the rig's camera: the overall width runs the top edge
	 * with its arrows OUT at the two corners and a tick across each end, and the depth runs the left
	 * edge the same way. Exact path data, so the template is proven to hand `dimensionLine` the
	 * placed label and the figure's own span rather than something near them.
	 */
	it('draws a line, two arrowheads and two extension ticks for each figure', async () => {
		const rig = await designer();
		try {
			expect(marks(rig)).toEqual([
				['overall-width', 'M-2 18L98 18M-2 14L-2 22M98 14L98 22', 'M-2 18L4 15L4 21ZM98 18L92 15L92 21Z'],
				['overall-depth', 'M-2 18L-2 78M-6 18L2 18M-6 78L2 78', 'M-2 18L-5 24L1 24ZM-2 78L-5 72L1 72Z'],
			]);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The line goes where the LABEL went.** At this zoomed-out camera a selected `detail-1`'s labels
	 * mostly move off their anchors (`dimensionCollision.test.ts` pins where), and each one's line has
	 * to follow: a width's or a horizontal gap's line runs along the label's row, a depth's or a
	 * vertical gap's up the label's column. Read off the first point of each path.
	 */
	it('runs each line through its label wherever the collision rule put it', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();

			const vertical = /-(depth|offset-top|offset-bottom)$/u;
			const wrappers = rig.wrapper.findAll('.rp-designer-dimension');
			const across = marks(rig).map(([name, line], index) => {
				const [x = '', y = ''] = line.slice(1).split('L')[0]?.split(' ') ?? [];
				const style = (wrappers[index]?.element as HTMLElement | undefined)?.style;
				return [name, vertical.test(name) ? [Number(x), Number.parseFloat(style?.left ?? '')] : [Number(y), Number.parseFloat(style?.top ?? '')]] as const;
			});

			expect(across.filter(([, [line, label]]) => Math.abs(line - label) > 1e-9)).toEqual([]);
			expect(across.map(([name]) => name)).toContain('detail-detail-1-offset-left');
		} finally {
			rig.unmount();
		}
	});

	/** Decoration: hidden from assistive technology, since each button already names what it measures. */
	it('hides the marks from assistive technology', async () => {
		const rig = await designer();
		try {
			expect(rig.wrapper.get('.rp-designer-dimension-lines').attributes('aria-hidden')).toBe('true');
		} finally {
			rig.unmount();
		}
	});

	/** AD18-R11's binding reaches the lines too: they are drawn off the PREVIEW while a gesture is live. */
	it('follows the gesture’s preview', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).setPreview({ ...editableShape(), footprint: expectOk(footprintFromDimensions(2000, 600)) });
			await settle();

			// A 2000 mm footprint's top edge runs from x -1000 to 1000: (-52, 18) to (148, 18).
			expect(marks(rig)[0]?.[1]).toBe('M-52 18L148 18M-52 14L-52 22M148 14L148 22');
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The label carries its unit, `1000 mm`, and stays inside its own accessible name** — WCAG
	 * 2.5.3's label-in-name, which is what lets a voice user say what they see.
	 */
	it('labels each value with its unit, inside the button’s accessible name', async () => {
		const rig = await designer();
		try {
			const [width] = rig.wrapper.findAll('.rp-designer-dimension__value');
			const text = width?.text() ?? '';

			expect(text).toBe(t('en', 'designer.dimension.label', { value: '1000' }));
			expect(width?.attributes('aria-label')).toContain(text);
			expect(t('de', 'designer.dimension.value', { name: 'x', value: '1000' })).toContain(t('de', 'designer.dimension.label', { value: '1000' }));
		} finally {
			rig.unmount();
		}
	});
});

describe('the clearance’s figures under Show clearance', () => {
	/**
	 * Task 7's switch hides the clearance on the canvas, so its six figures go with it — selected or
	 * under `All dimensions` — and come back with it. Driven through the REAL switch.
	 */
	it('draws no clearance figure or line while Show clearance is off', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'clearance' });
			await settle();
			expect(names(rig)).toContain('clearance-width');

			await rig.wrapper.get('[name="show-clearance"]').setValue(false);
			await settle();
			expect(names(rig)).toEqual(['overall-width', 'overall-depth']);
			expect(marks(rig).map(([name]) => name)).toEqual(['overall-width', 'overall-depth']);

			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);
			expect(names(rig).some((name) => name.startsWith('clearance-'))).toBe(false);

			await rig.wrapper.get('[name="show-clearance"]').setValue(true);
			await settle();
			expect(names(rig)).toContain('clearance-width');
		} finally {
			rig.unmount();
		}
	});
});

/** Every `z-index` a partial declares on exactly `selector`, as lightningcss parses it. */
const zIndex = (file: string, selector: string): unknown[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'))
	.filter((rule) => rule.condition === '' && rule.selectors.map((one) => show(one)).join(', ') === selector)
	.flatMap((rule) => rule.declarations.filter((entry) => propertyOf(entry) === 'z-index').map((entry) => entry.value));

/** How this parser reads `z-index: value`, so no case spells lightningcss's own AST by hand. */
const zValue = (value: number): unknown => stylesheetRules(`.reference { z-index: ${String(value)}; }`)[0]?.declarations[0]?.value;

describe('where a resting label paints', () => {
	/**
	 * **Routed from Task 6's review.** The canvas key is opaque, bottom-left, and drawn AFTER the
	 * dimensions in the overlay, so at a camera that puts a label in that corner a `z-index: auto`
	 * label was painted UNDER it — a click target nobody can see, and a focus ring hidden (WCAG
	 * 2.4.11). A resting label is lifted to 1, an open field to 2 above it, and the key declares no
	 * `z-index` of its own, so both stay above it.
	 */
	it('lifts a resting label above the canvas key, and an open field above both', () => {
		expect(zIndex('designer-dimensions.css', '.rp-designer-dimension')).toEqual([zValue(1)]);
		expect(zIndex('designer-dimensions.css', '.rp-designer-dimension:has(.rp-designer-dimension__form)')).toEqual([zValue(2)]);
		expect(zIndex('designer-legend.css', '.rp-designer-key')).toEqual([]);
	});
});
