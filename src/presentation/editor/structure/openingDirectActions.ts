import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Opening, Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { persistenceError } from '../../../application/errors';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { parseCoordinateMetres, parseMetres, formatMetres } from '../shell/formatLength';
import { swingDraft, parseSwingDraft, type OpeningSwingDraft } from './openingSwingDraft';
import type { StructureReviewState } from './structureBulkEdit';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useRenovationSession } from '../renovation/renovationSession';
import { useSelectionStore } from '../selection/selection-store';
import { notifyFault } from '../../notices/notify';

/** The selected-opening panel keeps all entry routes on one preview and StructureCommand path. */
export function createOpeningDirectActions(context: PlanEditorContext, state: StructureReviewState) {
	const editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession();
	const target = ref<string | null>(null), baseline = shallowRef<PlanGeometrySnapshot | null>(null);
	const width = ref(''), offset = ref(''), swing = ref<OpeningSwingDraft | null>(null), opener = ref<HTMLElement | null>(null), focusField = ref<'width' | 'offset' | 'swing'>('width');
	const widthRaw = ref<number | null>(null), offsetRaw = ref<number | null>(null), swingEdited = ref(false);
	const loading = ref(false), busy = ref(false), error = shallowRef<AppError | null>(null), failed = ref(false);
	let alive = true, generation = 0;
	const original = computed(() => baseline.value?.document.structure?.openings.find(item => item.id === target.value));
	const paused = computed(() => loading.value || busy.value || state.blocked.value || failed.value);
	function clear(): void {
		generation++; target.value = null; baseline.value = null; loading.value = false; error.value = null; failed.value = false;
		state.preview.value = null; if (!busy.value) state.active.value = false;
	}
	function current(ticket: number): boolean {
		return alive && ticket === generation && target.value !== null && selection.selectedIds.length === 1 && selection.selectedIds[0] === target.value && session.perspective === 'plan';
	}
	function reset(opening: Opening): void {
		width.value = formatMetres(opening.width); offset.value = formatMetres(opening.offset);
		swing.value = opening.kind === 'opening' ? null : swingDraft(opening);
		widthRaw.value = opening.width; offsetRaw.value = opening.offset; swingEdited.value = false;
	}
	const proposal = computed<Structure | null>(() => {
		const structure = baseline.value?.document.structure, opening = original.value;
		if (!structure || !opening) return null;
		if (widthRaw.value === null || offsetRaw.value === null) return null;
		const nextWidth = widthRaw.value, nextOffset = offsetRaw.value;
		const parsedSwing = swing.value ? parseSwingDraft(swing.value) : undefined;
		if (parsedSwing === null) return null;
		const next = { ...opening, width: nextWidth, offset: nextOffset, ...((opening.swing || swingEdited.value) && parsedSwing ? { swing: parsedSwing } : {}) };
		return { ...structure, openings: structure.openings.map(item => item.id === opening.id ? next : item) };
	});
	const changed = computed(() => JSON.stringify(proposal.value) !== JSON.stringify(baseline.value?.document.structure));
	const issue = computed(() => {
		if (!target.value || !proposal.value) return null;
		const structure = baseline.value?.document.structure;
		return structure ? validateStructure(proposal.value, structure.boundaries.map(boundary => boundary.roomId)) : null;
	});
	const invalid = computed(() => proposal.value === null || issue.value?.ok === false);
	function refreshPreview(): void {
		error.value = issue.value && !issue.value.ok ? issue.value.error : null;
		state.preview.value = !invalid.value ? proposal.value : null;
	}
	function update(field: 'width' | 'offset', value: string): void {
		if (paused.value || !target.value) return;
		if (field === 'width') {
			width.value = value;
			const parsed = parseMetres(value), currentWidth = widthRaw.value, currentOffset = offsetRaw.value;
			widthRaw.value = parsed.ok ? parsed.mm : null;
			if (parsed.ok && currentWidth !== null && currentOffset !== null) { offsetRaw.value = currentOffset + currentWidth / 2 - parsed.mm / 2; offset.value = formatMetres(offsetRaw.value); }
		} else { offset.value = value; const parsed = parseCoordinateMetres(value); offsetRaw.value = parsed.ok ? parsed.mm : null; }
		refreshPreview();
	}
	function step(field: 'width' | 'offset', direction: -1 | 1): void {
		if (paused.value || !target.value) return;
		if (field === 'width' && widthRaw.value !== null && offsetRaw.value !== null) {
			const next = widthRaw.value + direction * 10; offsetRaw.value += (widthRaw.value - next) / 2; widthRaw.value = next;
			width.value = formatMetres(next); offset.value = formatMetres(offsetRaw.value);
		} else if (field === 'offset' && offsetRaw.value !== null) { offsetRaw.value += direction * 10; offset.value = formatMetres(offsetRaw.value); }
		refreshPreview();
	}
	function updateSwing(value: OpeningSwingDraft): void { if (!paused.value && target.value) { swing.value = value; swingEdited.value = true; refreshPreview(); } }
	function mayBegin(id: string): boolean {
		return !!context.commands.structure && !state.unavailable() && selection.selectedIds.length === 1 && selection.selectedIds[0] === id && editor.activeToolId === 'select' && session.perspective === 'plan';
	}
	async function begin(id: string, source?: HTMLElement | null, focus: 'width' | 'offset' | 'swing' = 'width'): Promise<void> {
		const services = context.commands.structure;
		if (!services || !mayBegin(id)) return;
		const ticket = ++generation; target.value = id; opener.value = source ?? null; focusField.value = focus; state.active.value = true; loading.value = true; error.value = null; failed.value = false;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!current(ticket) || state.blocked.value) { if (ticket === generation) clear(); return; }
			const prepared = state.prepareBaseline(read), opening = prepared.snapshot?.document.structure?.openings.find(item => item.id === id);
			if (!prepared.snapshot || !opening || (opening.kind !== 'door' && opening.kind !== 'window')) { clear(); await prepared.recovery; return; }
			baseline.value = prepared.snapshot; reset(opening); refreshPreview();
		} catch (cause) { if (current(ticket)) { notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); clear(); } }
		finally { if (ticket === generation) loading.value = false; }
	}
	async function apply(): Promise<void> {
		const services = context.commands.structure, snapshot = baseline.value, next = proposal.value, ticket = generation;
		if (!services || !snapshot || !next || !changed.value || invalid.value || paused.value || !current(ticket)) { refreshPreview(); return; }
		busy.value = true;
		try {
			const result = await state.reviewedWrite(services, snapshot).dispatch(next, () => current(ticket));
			if (!current(ticket)) return;
			if (result.ok) clear();
			else { error.value = result.error; failed.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; }
		} catch (cause) { if (current(ticket)) error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); }
		finally { busy.value = false; if (!target.value) state.active.value = false; }
	}
	watch([() => session.perspective, () => selection.selectedIds.join(), () => editor.activeToolId], () => { if (target.value) clear(); }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; clear(); });
	return { target, opener, focusField, width, offset, swing, loading, busy, error, paused, invalid, changed, begin, update, step, updateSwing, apply, close: clear };
}
