import { describe, expect, it } from 'vitest';
import { createEditorSnapService, EDITOR_SNAP_SERVICE } from '../../../../src/presentation/editor/snapping/editorSnapping';
import { StructureTool } from '../../../../src/presentation/editor/structure/StructureTool';
import { createStructureDraft } from '../../../../src/presentation/editor/structure/structureDraft';
import { pointerAt, toolContext } from '../../../helpers/tool-context';
import { WALL_LOOP } from '../../../helpers/structure';

describe('per-leaf automatic snapping', () => {
	it('leaves vertices and edges untouched while off, preserves explicit angles and other surfaces', () => {
		let enabled = true;
		const service = createEditorSnapService(() => enabled);
		const point = { x: 4, y: 4 }, vertex = { x: 0, y: 0 };
		const edge = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
		expect(service.snapPoint(point, { vertices: [vertex] })).toBe(vertex);
		enabled = false;
		expect(service.snapPoint(point, { vertices: [vertex], edges: [edge] })).toBe(point);
		expect(service.snapToVertex(point, [vertex])).toBeNull();
		expect(service.snapToEdge(point, [edge])).toBeNull();
		expect(service.snapDirection(vertex, { x: 100, y: 1 })).toEqual({ x: 100, y: 0 });
		expect(EDITOR_SNAP_SERVICE.snapPoint(point, { vertices: [vertex] })).toBe(vertex);
		enabled = true;
		expect(service.snapToEdge(point, [edge])).toEqual({ x: 4, y: 0 });
	});

	it('disables wall endpoint/axis attraction while keeping required opening host picking', () => {
		let enabled = false;
		const draft = createStructureDraft();
		const deps = { draft, structure: () => WALL_LOOP, start: () => {}, stop: () => {}, finish: () => {}, blocked: () => false };
		const context = { ...toolContext({ worldPerScreenPixel: 10 }).context, snapService: createEditorSnapService(() => enabled) };
		const wall = new StructureTool('draw-wall', deps); wall.activate(context);
		wall.pointerMove(pointerAt(4, 4)); expect(draft.cursor).toEqual({ x: 4, y: 4 }); expect(draft.snapped).toBe(false);
		enabled = true; wall.pointerMove(pointerAt(4, 4)); expect(draft.cursor).toEqual({ x: 0, y: 0 }); expect(draft.snapped).toBe(true);
		enabled = false;
		const door = new StructureTool('place-door', deps); door.activate(context);
		door.pointerMove(pointerAt(1000, 4)); expect(draft.text.hostId).toBe('wall-a'); expect(draft.snapped).toBe(true);
	});
});
