import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { flippedOpening, steppedOpening } from '../../../domain/spatial/openingGeometry';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import type { EditorToolDeps } from '../tools/registerEditorTools';
import { STAGE_PIXELS, worldPerScreenPixel } from '../viewport/Viewport';
import { openingHandles } from './openingHandles';
import type { createStructureActions } from './structureActions';

/** The two of `createStructureActions`' members this needs — named so a double is a typed object, not a cast. */
type StructureWrites = Pick<ReturnType<typeof createStructureActions>, 'applyOpening' | 'previewOpening'>;

/** The six doors `SelectTool` takes for a selected opening's direct manipulation. `Required`, because
 * every one of them is supplied here — optional on `EditorToolDeps` is about the tool, not about this. */
type OpeningDoors = Required<Pick<EditorToolDeps, 'openingTarget' | 'openingHandles' | 'previewOpening' | 'commitOpening' | 'stepOpening' | 'flipOpening'>>;

/**
 * The selected opening's direct-manipulation doors, as `SelectTool` takes them.
 *
 * Every write goes through `applyOpening`, which owns the guarded write — and the two SHAPES of
 * write here are deliberately different. `commitOpening` ignores the baseline's opening and writes
 * the DRAGGED one, because the drag's arithmetic was done against what the user could see;
 * `applyOpening` still validates that against the baseline structure and still refuses a stale one.
 * `stepOpening` and `flipOpening` transform the BASELINE's opening instead, so two taps in quick
 * succession accumulate rather than the second overwriting the first.
 *
 * The handles are the SAME `openingHandles` call the canvas draws from, at the same camera scale,
 * which is what makes a press land on the mark the user aimed at rather than near it.
 */
export function openingHandleDoors(structureActions: StructureWrites): OpeningDoors {
	const project = useProjectStore(), selection = useSelectionStore(), editor = useEditorStore();
	const hostOf = (opening?: Opening): Wall | undefined => project.structure.walls.find(wall => wall.id === opening?.hostId);
	return {
		openingTarget: (id) => {
			const opening = project.structure.openings.find(item => item.id === id);
			const host = hostOf(opening);
			return opening && host ? { opening, host } : null;
		},
		openingHandles: () => {
			const ids = selection.selectedIds;
			const opening = ids.length === 1 ? project.structure.openings.find(item => item.id === String(ids[0])) : undefined;
			const host = hostOf(opening);
			return opening && host
				? { id: opening.id, handles: openingHandles(opening, host, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)) }
				: null;
		},
		previewOpening: structureActions.previewOpening,
		commitOpening: (id, next) => { void structureActions.applyOpening(id, () => next); },
		stepOpening: (id, deltaMm) => { void structureActions.applyOpening(id, (opening, host) => steppedOpening(opening, host, deltaMm)); },
		flipOpening: (id, side) => { void structureActions.applyOpening(id, opening => flippedOpening(opening, side)); },
	};
}
