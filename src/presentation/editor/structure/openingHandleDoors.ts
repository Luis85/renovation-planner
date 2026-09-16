import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { flippedOpening, steppedOpening } from '../../../domain/spatial/openingGeometry';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import type { EditorToolDeps } from '../tools/registerEditorTools';
import { STAGE_PIXELS, worldPerScreenPixel } from '../viewport/Viewport';
import { selectedOpeningHandles } from './openingHandles';
import { sameOpening } from './openingHandleActions';
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
 * write here are deliberately different. `commitOpening` writes the DRAGGED opening rather than
 * transforming the baseline's, because the drag's arithmetic was done against what the user could
 * see; but only while the baseline still holds the opening that drag STARTED from, compared by
 * `sameOpening`, the no-op guard's own equality. Otherwise its transform answers `null` and the
 * drop is refused like any illegal proposal, since writing it would silently revert whatever
 * landed after the drag began. `applyOpening` still validates what it does write against the
 * baseline structure. `stepOpening` and `flipOpening` transform the BASELINE's opening instead, so
 * taps accumulate once each write has landed rather than the second overwriting the first; a tap
 * while an earlier write is still in flight is dropped by `unavailable()`, not queued.
 *
 * The handles are the SAME `selectedOpeningHandles` call `OpeningHandles.vue` draws from, at the
 * same camera scale, which is what makes a press land on the mark the user aimed at rather than
 * near it — `openingHandlesComponent.test.ts`'s "draws exactly what a press would act on, grip by
 * grip" is the check, not this sentence.
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
		openingHandles: () => selectedOpeningHandles(project.structure, selection.selectedIds, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)),
		previewOpening: structureActions.previewOpening,
		commitOpening: (id, original, next) => { void structureActions.applyOpening(id, opening => sameOpening(opening, original) ? next : null, true); },
		stepOpening: (id, deltaMm) => { void structureActions.applyOpening(id, (opening, host) => steppedOpening(opening, host, deltaMm)); },
		flipOpening: (id, side) => { void structureActions.applyOpening(id, opening => flippedOpening(opening, side)); },
	};
}
