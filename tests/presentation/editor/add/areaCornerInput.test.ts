import { describe, expect, it } from 'vitest';
import { effectScope, reactive, ref } from 'vue';
import { createAreaCornerInput } from '../../../../src/presentation/editor/add/areaCornerInput';
import { parseCoordinateMetres, formatMetres } from '../../../../src/presentation/editor/shell/formatLength';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import { build, harness } from '../../../helpers/drawPolygonHarness';
import { pointerAt, flushGesture } from '../../../helpers/tool-context';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';

describe('absolute coordinates reuse the length grammar and millimetre precision', () => {
	it.each([
		['0', 0], ['-0', -0], ['-1,2345', -1234], ['.001', 1], ['1000', 1000000], ['1001', 1001000], [' 4,2 ', 4200],
	])('parses %s as %i mm without room-size bounds', (text, mm) => {
		expect(parseCoordinateMetres(text)).toEqual({ ok: true, mm });
	});
	it.each(['', 'NaN', '1e3', '1m', '1,2.3', '+1', '1.'])('refuses ambiguous or non-numeric %s', (text) => {
		expect(parseCoordinateMetres(text)).toEqual({ ok: false, reason: 'not-a-number' });
	});
	it.each(['Infinity', '9999999999999999999', '-9999999999999999999'])('refuses unrepresentable %s', (text) => {
		expect(parseCoordinateMetres(text)).toEqual({ ok: false, reason: 'too-large' });
	});
	it('round-trips positive, zero and negative millimetres', () => {
		for (let mm = -1001000; mm <= 1001000; mm += 137) expect(parseCoordinateMetres(formatMetres(mm))).toEqual({ ok: true, mm });
	});
});

describe('numeric mutation of the existing polygon buffer', () => {
	it('refuses retired, unsupported and invalid-index edits, duplicates and edits during completion', async () => {
		const h = harness();
		const tool = build(h);
		const manager = new ToolManager(() => h.context);
		expect(manager.editActiveCorner(0, { x: 0, y: 0 })).toBe(false);
		expect(tool.editCorner(0, null)).toBe(false);
		manager.register(new SelectTool({ spatialObjects: () => [], createMoveGesture: () => { throw new Error('No move expected'); }, reportRejected: () => undefined, reportInvalidInput: () => undefined }));
		manager.setActiveTool('select');
		expect(manager.editActiveCorner(0, null)).toBe(false);
		manager.register(tool); manager.setActiveTool(tool.id);
		for (const index of [-1, 0.5, 1]) expect(manager.editActiveCorner(index, null)).toBe(false);
		expect(manager.editActiveCorner(0, null)).toBe(false);
		for (const point of [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }]) {
			expect(manager.editActiveCorner(h.context.renderState.polygonSketch?.vertices.length ?? 0, point)).toBe(true);
		}
		expect(manager.editActiveCorner(1, { x: 0, y: 0 })).toBe(false);
		const release = h.gateNextDispatch();
		manager.finishActiveTool();
		expect(manager.editActiveCorner(0, { x: 2, y: 2 })).toBe(false);
		release(); await flushGesture();
		expect(h.dispatched).toHaveLength(1);
		manager.clearActiveTool();
	});

	it('keeps untouched mouse precision, accepts a correction, and leaves no text after cancel', () => {
		const h = harness();
		const context = { ...h.context, renderState: reactive(h.context.renderState) };
		const manager = new ToolManager(() => context);
		const tool = build(h); manager.register(tool); manager.setActiveTool(tool.id);
		const scope = effectScope();
		const editable = ref(true);
		const input = scope.run(() => createAreaCornerInput(context.renderState, manager, editable));
		if (input === undefined) throw new Error('Expected input controller');
		tool.pointerDown(pointerAt(1234.12345, -765.4321));
		input.edit(99);
		expect(input.editing.value).toBeNull();
		input.edit(0);
		expect(input.apply()).toBe(true);
		expect(input.points.value[0]).toEqual({ x: 1234.12345, y: -765.4321 });
		input.edit(0); input.text.x = '2';
		expect(input.apply()).toBe(true);
		expect(input.points.value[0]).toEqual({ x: 2000, y: -765.4321 });
		input.edit(0); input.text.y = '-1';
		expect(input.apply()).toBe(true);
		expect(input.points.value[0]).toEqual({ x: 2000, y: -1000 });
		editable.value = false;
		input.edit(0);
		expect(input.editing.value).toBeNull();
		expect(input.remove(0)).toBe(false);
		expect(input.apply()).toBe(false);
		editable.value = true;
		input.text.x = '2';
		expect(input.apply()).toBe(false);
		expect(input.errors.y).toBe('not-a-number');
		tool.cancel();
		expect(input.text).toEqual({ x: '', y: '' });
		expect(input.points.value).toEqual([]);
		scope.stop();
	});
});
