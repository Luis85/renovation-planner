import { computed, reactive, ref, watch, type Ref } from 'vue';
import type { RenderState } from '../tools/render-state';
import type { ToolManager } from '../tools/tool-manager';
import { formatMetres, parseCoordinateMetres, type LengthRefusal } from '../shell/formatLength';

/** Form text is not geometry. Only Apply edits the drawing tool's existing temporary buffer. */
export function createAreaCornerInput(renderState: RenderState, tools: ToolManager, editable: Readonly<Ref<boolean>>) {
	const text = reactive({ x: '', y: '' });
	const errors = reactive<{ x: LengthRefusal | null; y: LengthRefusal | null }>({ x: null, y: null });
	const duplicate = ref(false);
	const editing = ref<number | null>(null);
	const points = computed(() => renderState.polygonSketch?.vertices ?? []);
	const pending = computed(() => text.x !== '' || text.y !== '' || editing.value !== null || errors.x !== null || errors.y !== null);
	function reset(): void {
		text.x = ''; text.y = '';
		errors.x = null; errors.y = null;
		duplicate.value = false;
		editing.value = null;
	}
	// Cancel, task switch and successful completion retire input with the tool's sketch.
	watch(() => renderState.polygonSketch, (sketch) => { if (sketch === null) reset(); }, { flush: 'sync' });
	function apply(): boolean {
		if (!editable.value) return false;
		const x = parseCoordinateMetres(text.x);
		const y = parseCoordinateMetres(text.y);
		errors.x = x.ok ? null : x.reason;
		errors.y = y.ok ? null : y.reason;
		duplicate.value = false;
		if (!x.ok || !y.ok) return false;
		const previous = editing.value === null ? undefined : points.value[editing.value];
		// Untouched axes retain exact mouse geometry, including sub-millimetre coordinates.
		const point = {
			x: previous !== undefined && text.x === formatMetres(previous.x) ? previous.x : x.mm,
			y: previous !== undefined && text.y === formatMetres(previous.y) ? previous.y : y.mm,
		};
		if (!tools.editActiveCorner(editing.value ?? points.value.length, point)) {
			duplicate.value = true;
			return false;
		}
		reset();
		return true;
	}
	function edit(index: number): void {
		const point = points.value[index];
		if (!editable.value || pending.value || point === undefined) return;
		editing.value = index;
		text.x = formatMetres(point.x);
		text.y = formatMetres(point.y);
	}
	function remove(index: number): boolean {
		if (!editable.value || pending.value) return false;
		return tools.editActiveCorner(index, null);
	}
	return { text, errors, duplicate, editing, points, pending, editable, reset, apply, edit, remove };
}
