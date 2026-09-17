import { onBeforeUnmount } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Opening, Structure, Wall } from '../../../domain/spatial/Structure';
import { openingValidationError } from '../../../domain/spatial/structureGeometry';
import { openingSwing } from '../../../domain/spatial/openingSwing';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { notifyFault, notifyOperationFailure, notifyWarning } from '../../notices/notify';
import { spatialMessage } from './spatialMessage';
import type { StructureReviewState } from './structureBulkEdit';

/**
 * A structure as the canvas DRAWS it: an opening that stored no swing reads as the default
 * `openingSwing` normalises it to. `sameGeometryDocument` alone compares STORED fields, so a
 * legacy door with no `swing` and the same door with that default filled in would read as two
 * documents although nothing on screen differs between them.
 */
function asDrawn(structure: Structure): PlanGeometryDocument {
	return { objects: [], calibration: null, structure: { ...structure, openings: structure.openings.map(opening => ({ ...opening, swing: openingSwing(opening) ?? undefined })) } };
}

/**
 * The ONE equality this write path decides "nothing changed" by: `sameGeometryDocument`, over two
 * structures as drawn. The no-op guard below and `sameOpening` both ask it, so a drop's staleness
 * check and a tap's no-op check cannot come to mean two different things by "the same".
 */
function sameAsDrawn(a: Structure, b: Structure): boolean {
	return sameGeometryDocument(asDrawn(a), asDrawn(b));
}

/** Whether two openings are geometrically the same, by the no-op guard's own equality. */
export function sameOpening(a: Opening, b: Opening): boolean {
	return sameAsDrawn({ walls: [], openings: [a], boundaries: [] }, { walls: [], openings: [b], boundaries: [] });
}

/**
 * A chevron pressed on the side the leaf already holds proposes the document it started from:
 * `flippedOpening` answers the SAME opening rather than `null`, deliberately (its own docblock),
 * and on a door that stored no swing it answers that door with the default filled in, which draws
 * identically. `StructureCommand` refuses neither: it writes whatever document it is handed, and
 * `sameGeometryDocument` elsewhere in this write path (`prepareBaseline`, every sibling
 * collaborator's own staleness check) compares a freshly-read document against a held baseline,
 * never a finished PROPOSAL against its own baseline before dispatch. Without this, a no-op
 * chevron press would land a real write whose undo changes nothing visible, and for the door that
 * stored no swing would migrate its note too. `openingMove.ts`'s own `move()` guards the same
 * shape at its own call site; this is not an extraction of that. Only the STRUCTURE is compared,
 * because a proposal replaces nothing else in the baseline document.
 */
function noOpProposal(current: Structure, proposed: Structure): boolean {
	return sameAsDrawn(current, proposed);
}

/** The baseline's opening `id` run through `transform`, or `null` where the opening or its host is gone. */
function transformedIn(structure: Structure, id: string, transform: (opening: Opening, host: Wall) => Opening | null): Opening | null {
	const opening = structure.openings.find(item => item.id === id);
	const host = structure.walls.find(wall => wall.id === opening?.hostId);
	return opening && host ? transform(opening, host) : null;
}

/** `true` when `applyOpening` must stop here — an invalid proposal has already been warned about. */
function refuseProposal(next: Opening, proposed: Structure, current: Structure): boolean {
	const invalid = openingValidationError(next, proposed);
	// `spatialMessage` is a call, not a literal, so this passes NOTICE_TEXT_BAN and stays translated.
	if (invalid) { notifyWarning(spatialMessage(invalid)); return true; }
	return noOpProposal(current, proposed);
}

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

	/**
	 * `drop` marks a drag's release, whose ghost is still up: a refused drop must not strand it, as
	 * `edit`'s own `if (end)` beside this does for a wall end. A TAP left no ghost, and the preview is
	 * shared, so a tap refused while a drop's write is pending leaves that drop's ghost alone.
	 */
	async function applyOpening(id: string, transform: (opening: Opening, host: Wall) => Opening | null, drop?: boolean): Promise<void> {
		const services = context.commands.structure;
		if (state.unavailable() || !services) { if (drop) previewOpening(null); return; }
		state.active.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!alive) return;
			const { snapshot, recovery } = state.prepareBaseline(read);
			const structure = snapshot?.document.structure;
			if (!snapshot || !structure) { await recovery; return; }
			const next = transformedIn(structure, id, transform);
			if (!next) return;
			const proposed: Structure = { ...structure, openings: structure.openings.map(item => item.id === id ? next : item) };
			if (refuseProposal(next, proposed, structure)) return;
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
