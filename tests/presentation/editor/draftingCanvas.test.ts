// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { expectDefined } from '../../helpers/domain';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { DRAFTING_MARKS } from '../../helpers/drafting';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

/**
 * Konva's own `getAbsoluteZIndex` ranks nodes breadth-first by DEPTH LEVEL rather than by real paint
 * order (`node_modules/konva/lib/Node.js`'s `getAbsoluteZIndex`), so it is not comparable across nodes
 * nested at different depths: measured directly, a node four levels deep but painted FIRST reported a
 * HIGHER index than a two-level sibling painted after it. Every drafting mark sits several `VGroup`s
 * deeper than a bare `wall-body` `VLine`, so this walks the stage in real paint (depth-first, document)
 * order instead — deviation from the brief, recorded in the task report.
 */
function paintOrder(stage: Konva.Stage, node: Konva.Node): number {
	let index = -1, seen = 0;
	const visit = (current: Konva.Node): void => {
		if (current === node) index = seen;
		seen++;
		const container = current as unknown as { getChildren?: () => readonly Konva.Node[] };
		if (typeof container.getChildren === 'function') for (const child of container.getChildren()) visit(child);
	};
	visit(stage);
	return index;
}

it('draws every drafting mark, a chain\'s lengths, no separate name tag, and a hatch under the walls but every other mark over them', async () => {
	const rig = await editorWith(mounted, ...DRAFTING_MARKS);
	const texts = rig.stage.find<Konva.Text>('Text').map(node => node.text());
	expect(rig.stage.find<Konva.Text>('.drafting-dimension-text').map(node => node.text())).toEqual([formatMetres(1190), formatMetres(750), formatMetres(2620)]);
	expect(rig.stage.find('.drafting-dimension-tick')).toHaveLength(4);
	expect(rig.stage.find('.drafting-section-arrow')).toHaveLength(2);
	expect(texts.filter(value => value === 'S-01')).toHaveLength(2);
	expect(texts.filter(value => value === 'Wintergarten')).toHaveLength(1);
	expect(texts.some(value => ['Front', 'Plot line', 'Existing'].includes(value))).toBe(false);
	const dash = expectDefined(rig.stage.findOne<Konva.Line>('.drafting-boundary'), 'boundary').dash();
	expect(dash).toHaveLength(2); expect(dash[0] / dash[1]).toBeCloseTo(2);
	expect(expectDefined(rig.stage.findOne<Konva.Line>('.drafting-hatch'), 'hatch').fillPatternImage()).toBeTruthy();
	expect(rig.stage.find('.drafting-grid')).toHaveLength(1);
	const wallBody = paintOrder(rig.stage, expectDefined(rig.stage.find('.wall-body')[0], 'wall body'));
	expect(paintOrder(rig.stage, expectDefined(rig.stage.findOne('.drafting-section-line'), 'section'))).toBeGreaterThan(wallBody);
	expect(paintOrder(rig.stage, expectDefined(rig.stage.findOne('.drafting-hatch'), 'hatch'))).toBeLessThan(wallBody);
});
