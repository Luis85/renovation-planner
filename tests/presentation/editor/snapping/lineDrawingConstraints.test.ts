import { expect, it, vi } from 'vitest';
import { StructureTool } from '../../../../src/presentation/editor/structure/StructureTool';
import { createStructureDraft } from '../../../../src/presentation/editor/structure/structureDraft';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';
import { ElementTool } from '../../../../src/presentation/editor/elements/ElementTool';
import { createElementDraft, ELEMENT_TOOLS } from '../../../../src/presentation/editor/elements/elementDraft';
import { build, harness } from '../../../helpers/drawPolygonHarness';
import { pointerAt, shiftPointerAt } from '../../../helpers/tool-context';

it('matches the Zone constraint, placement and Shift release for walls and every line element', () => {
	const h = harness(), zone = build(h); zone.activate(h.context);
	zone.pointerDown(shiftPointerAt(0, 0)); zone.pointerMove(shiftPointerAt(2000, 500));
	const expected = h.context.renderState.polygonSketch?.nextVertex;
	expect(expected).not.toEqual({ x: 2000, y: 500 });
	const draft = createStructureDraft();
	const wall = new StructureTool('draw-wall', { draft, structure: () => EMPTY_STRUCTURE, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), blocked: () => false });
	wall.activate(h.context); wall.pointerDown(shiftPointerAt(0, 0)); wall.pointerMove(shiftPointerAt(2000, 500));
	expect(draft.cursor).toEqual(expected);
	wall.pointerMove(pointerAt(2000, 500)); expect(draft.cursor).toEqual({ x: 2000, y: 500 });
	wall.pointerDown(shiftPointerAt(2000, 500)); expect(draft.points[1]).toEqual(expected);
	for (const id of ['draw-path', 'draw-fence', 'measure'] as const) {
		const element = createElementDraft(); element.kind = ELEMENT_TOOLS[id];
		const tool = new ElementTool(id, { draft: element, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), candidates: () => ({}), blocked: () => false, addPoint: point => { element.points.push(point); return true; } });
		tool.activate(h.context); tool.pointerDown(shiftPointerAt(0, 0)); tool.pointerMove(shiftPointerAt(2000, 500));
		expect(element.cursor).toEqual(expected);
		tool.pointerMove(pointerAt(2000, 500)); expect(element.cursor).toEqual({ x: 2000, y: 500 });
		tool.pointerDown(shiftPointerAt(2000, 500)); expect(element.points[1]).toEqual(expected);
	}
});
