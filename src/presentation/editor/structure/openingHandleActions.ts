import { onBeforeUnmount } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Opening, Structure, Wall } from '../../../domain/spatial/Structure';
import { openingValidationError } from '../../../domain/spatial/structureGeometry';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { notifyFault, notifyOperationFailure, notifyWarning } from '../../notices/notify';
import { spatialMessage } from './spatialMessage';
import type { StructureReviewState } from './structureBulkEdit';

/**
 * A selected opening's canvas handles, writing through the SAME admission, stale-baseline check and
 * reviewed write the single wall edit uses — the fifth collaborator to take that bundle, beside
 * `createWallPointAction`, `createWallThicknessActions`, `createWallRotationActions` and
 * `createStructureBulkEdit`. One undo reverts one handle press.
 *
 * The transform is handed the opening AND host found in the BASELINE, never the ones the store is
 * drawing: the store's copy is what the preview was computed against and may be a frame behind the
 * document this write is about to land on.
 */
export function createOpeningHandleActions(context: PlanEditorContext,
	state: Pick<StructureReviewState, 'active' | 'preview' | 'unavailable' | 'prepareBaseline' | 'reviewedWrite'>) {
	const project = useProjectStore();
	let alive = true;
	onBeforeUnmount(() => { alive = false; });

	/** The drag ghost: the store's structure with one opening replaced. `useDrawnStructure` draws it. */
	function previewOpening(id: string | null, next?: Opening): void {
		state.preview.value = alive && id !== null && next
			? { ...project.structure, openings: project.structure.openings.map(item => item.id === id ? next : item) }
			: null;
	}

	async function applyOpening(id: string, transform: (opening: Opening, host: Wall) => Opening | null): Promise<void> {
		const services = context.commands.structure;
		if (state.unavailable() || !services) { previewOpening(null); return; }
		state.active.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!alive) return;
			const { snapshot, recovery } = state.prepareBaseline(read);
			const structure = snapshot?.document.structure;
			if (!snapshot || !structure) { await recovery; return; }
			const opening = structure.openings.find(item => item.id === id);
			const host = structure.walls.find(wall => wall.id === opening?.hostId);
			const next = opening && host ? transform(opening, host) : null;
			if (!next) return;
			const proposed: Structure = { ...structure, openings: structure.openings.map(item => item.id === id ? next : item) };
			const invalid = openingValidationError(next, proposed);
			// `spatialMessage` is a call, not a literal, so this passes NOTICE_TEXT_BAN and stays translated.
			if (invalid) { notifyWarning(spatialMessage(invalid)); return; }
			const result = await state.reviewedWrite(services, snapshot).dispatch(proposed);
			if (alive && !result.ok) notifyOperationFailure(result.error);
		} catch (cause) {
			if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed');
		} finally {
			if (alive) { state.active.value = false; previewOpening(null); }
		}
	}

	return { applyOpening, previewOpening };
}
