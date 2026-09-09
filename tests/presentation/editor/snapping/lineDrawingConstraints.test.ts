import { expect, it, vi } from 'vitest';
import { StructureTool } from '../../../../src/presentation/editor/structure/StructureTool';
import { createStructureDraft } from '../../../../src/presentation/editor/structure/structureDraft';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';
import { ElementTool } from '../../../../src/presentation/editor/elements/ElementTool';
import { createElementDraft, ELEMENT_TOOLS } from '../../../../src/presentation/editor/elements/elementDraft';
import { build, harness } from '../../../helpers/drawPolygonHarness';
import { pointerAt, shiftPointerAt } from '../../../helpers/tool-context';
import { constrainsAngle } from '../../../../src/presentation/editor/snapping/editorSnapping';
import { cursorClassFor } from '../../../../src/presentation/editor/surface/cursor';

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
	for (const id of ['draw-path', 'draw-fence', 'measure', 'place-stair', 'draw-arrow'] as const) {
		expect(constrainsAngle(id)).toBe(true);
		expect(cursorClassFor({ activeToolId: id, panPhase: 'idle', hoveredObjectId: null, hoveredTargetKind: null })).toBe('rp-plan-canvas-precise');
		const element = createElementDraft(); element.kind = ELEMENT_TOOLS[id];
		const tool = new ElementTool(id, { draft: element, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), candidates: () => ({}), blocked: () => false, addPoint: point => { element.points.push(point); return true; } });
		tool.activate(h.context); tool.pointerDown(shiftPointerAt(0, 0)); tool.pointerMove(shiftPointerAt(2000, 500));
		expect(element.cursor).toEqual(expected);
		tool.pointerMove(pointerAt(2000, 500)); expect(element.cursor).toEqual({ x: 2000, y: 500 });
		tool.pointerDown(shiftPointerAt(2000, 500)); expect(element.points[1]).toEqual(expected);
	}
});

it.each(['place-stair', 'draw-arrow'] as const)('uses the Zone SnapService order and last committed anchor for %s', id => {
	const h = harness(), draft = createElementDraft(), candidates = { vertices: [{ x: 2100, y: 0 }] };
	const direction = vi.spyOn(h.context.snapService, 'snapDirection').mockReturnValue({ x: 2000, y: 0 });
	const point = vi.spyOn(h.context.snapService, 'snapPoint').mockReturnValue({ x: 2100, y: 0 });
	const tool = new ElementTool(id, { draft, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(),
		candidates: () => candidates, blocked: () => false, addPoint: value => { draft.points.push(value); return true; } });
	tool.activate(h.context); tool.pointerMove(shiftPointerAt(100, 200));
	expect(direction).not.toHaveBeenCalled();
	draft.points = [{ x: 100, y: 200 }]; tool.pointerDown(shiftPointerAt(2200, 400));
	expect(direction).toHaveBeenCalledWith({ x: 100, y: 200 }, { x: 2200, y: 400 });
	expect(point).toHaveBeenLastCalledWith({ x: 2000, y: 0 }, candidates, 8 * h.context.viewport.worldPerScreenPixel());
	expect(draft.points).toEqual([{ x: 100, y: 200 }, { x: 2100, y: 0 }]);
	tool.pointerMove(shiftPointerAt(3000, 400));
	expect(direction).toHaveBeenLastCalledWith({ x: 2100, y: 0 }, { x: 3000, y: 400 });
	direction.mockClear(); tool.pointerMove(pointerAt(3000, 400));
	expect(direction).not.toHaveBeenCalled(); expect(point).toHaveBeenLastCalledWith({ x: 3000, y: 400 }, candidates, 8 * h.context.viewport.worldPerScreenPixel());
});
