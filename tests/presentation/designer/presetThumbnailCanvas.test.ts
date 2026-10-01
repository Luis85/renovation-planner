/**
 * @vitest-environment jsdom
 *
 * `Design an Asset.md` step 58: the Vanity applied at its defaults, and "the drawing on the canvas matches the
 * thumbnail". Driven the way a user drives it, through the real dialog — the card's SVG read off the gallery,
 * the preset applied with the form's own Apply, and the result read off the designer's Konva stage — rather
 * than by comparing `presetThumbnail` with a build this file makes itself, which would agree by construction.
 *
 * Both sides flatten the same arcs, the card at 2 mm of sagitta and the canvas at a quarter of a screen pixel,
 * and the card prints one decimal, so outlines are compared by their extents to 2.1 mm and by count, closure
 * and dash, part for part in the order each draws them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type Konva from 'konva';
import type { Point } from '../../../src/core/geometry/Point';
import { settle } from '../../helpers/editor';
import { designerRig, type DesignerRig } from '../../helpers/designerRig';

interface Drawn {
	readonly extent: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
	readonly closed: boolean;
	readonly dashed: boolean;
}

/** Card and canvas agree within the card's own flattening and rounding. */
const MM = 2.1;

let live: DesignerRig | null = null;
afterEach(() => {
	live?.unmount();
	live = null;
});

function extentOf(points: readonly Point[]): Drawn['extent'] {
	const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
	return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** An `M x y L x y … [Z]` path, as `presetPreview` writes one. */
function fromPath(path: Element): Drawn {
	const d = path.getAttribute('d') ?? '';
	const closed = d.endsWith(' Z');
	const points = (closed ? d.slice(0, -2) : d).slice(1).split(' L').map((pair) => {
		const [x, y] = pair.split(' ').map(Number);
		return { x, y };
	});
	return { extent: extentOf(points), closed, dashed: path.classList.contains('rp-asset-preset-preview__detail--dashed') };
}

function fromLine(line: Konva.Line): Drawn {
	const flat = line.points(), points: Point[] = [];
	for (let index = 0; index < flat.length; index += 2) points.push({ x: flat[index], y: flat[index + 1] });
	return { extent: extentOf(points), closed: line.closed(), dashed: (line.dash() ?? []).length > 0 };
}

function expectSame(canvas: readonly Drawn[], card: readonly Drawn[]): void {
	expect(canvas.map(({ closed, dashed }) => ({ closed, dashed }))).toEqual(card.map(({ closed, dashed }) => ({ closed, dashed })));
	canvas.forEach((drawn, index) => {
		for (const side of ['minX', 'minY', 'maxX', 'maxY'] as const) expect(Math.abs(drawn.extent[side] - card[index].extent[side])).toBeLessThanOrEqual(MM);
	});
}

describe('the Vanity applied at its defaults', () => {
	it('draws on the canvas the footprint and the three parts its gallery card draws', async () => {
		live = await designerRig({ shape: null });
		live.wrapper.get('.rp-designer-start-preset').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		const choice = live.wrapper.get('.rp-preset-choice[data-preset="vanity"]');
		const card = {
			footprint: fromPath(choice.get('.rp-asset-preset-preview__footprint').element),
			details: choice.findAll('.rp-asset-preset-preview__detail').map((path) => fromPath(path.element)),
		};
		await choice.trigger('click');
		await live.wrapper.get('form.rp-asset-preset-form').trigger('submit');
		await settle();

		expect(live.wrapper.find('[role="dialog"]').exists()).toBe(false);
		const footprint = live.stage.find<Konva.Line>('.asset-footprint-outline').map((line) => fromLine(line));
		const details = live.stage.find<Konva.Line>('.asset-detail').map((line) => fromLine(line));
		expect(card.details).toHaveLength(3);
		expectSame(footprint, [card.footprint]);
		expectSame(details, card.details);
	});
});
