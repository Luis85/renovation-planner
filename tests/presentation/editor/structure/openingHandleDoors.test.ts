import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { openingHandleDoors } from '../../../../src/presentation/editor/structure/openingHandleDoors';
import { openingHandles } from '../../../../src/presentation/editor/structure/openingHandles';
import { STAGE_PIXELS, worldPerScreenPixel } from '../../../../src/presentation/editor/viewport/Viewport';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { Opening, Structure, Wall } from '../../../../src/domain/spatial/Structure';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { expectDefined } from '../../../helpers/domain';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
/** Hosted by a wall that is not in the structure: the arm where an opening is found and its host is not. */
const orphan: Opening = { ...door, id: 'opening-orphan', hostId: 'wall-gone' };
const structure: Structure = { walls: [wall], openings: [door, orphan], boundaries: [] };

type Transform = (opening: Opening, host: Wall) => Opening | null;

function harness(selected: readonly string[] = [door.id]) {
	setActivePinia(createPinia());
	useProjectStore().structure = structure;
	useSelectionStore().select(selected.map(id => id as EntityId<string>));
	const applyOpening = vi.fn<(id: string, transform: Transform) => Promise<void>>().mockResolvedValue();
	const previewOpening = vi.fn<(id: string | null, next?: Opening) => void>();
	const doors = openingHandleDoors({ applyOpening, previewOpening });
	/** The transform the door handed `applyOpening`, run against a baseline of this test's choosing. */
	const transformed = (baseline: Opening, host: Wall = wall): Opening | null =>
		expectDefined(applyOpening.mock.calls.at(-1), 'an applyOpening call')[1](baseline, host);
	return { doors, applyOpening, previewOpening, transformed };
}

it('answers the opening and its host by id, and null where either is missing', () => {
	const { doors } = harness();
	expect(doors.openingTarget(door.id)).toEqual({ opening: door, host: wall });
	expect(doors.openingTarget('opening-nowhere')).toBeNull();
	expect(doors.openingTarget(orphan.id)).toBeNull();
});

it('offers the selected opening the same handles the canvas draws, at the camera it is drawn at', () => {
	const { doors } = harness();
	const scale = worldPerScreenPixel(useEditorStore().viewport, STAGE_PIXELS);
	expect(doors.openingHandles()).toEqual({ id: door.id, handles: openingHandles(door, wall, scale) });
});

it('offers no handles for a multi-selection, for a selection that is not an opening, or for a hostless one', () => {
	const handlesFor = (selected: readonly string[]) =>
		harness(selected).doors.openingHandles();
	expect(handlesFor([door.id, orphan.id])).toBeNull();
	expect(handlesFor(['zone-1'])).toBeNull();
	expect(handlesFor([orphan.id])).toBeNull();
});

it('commits the DRAGGED opening, as a drop, over a baseline still holding the opening the drag started from', () => {
	const { doors, applyOpening, transformed } = harness();
	const dragged: Opening = { ...door, width: 1700 };
	doors.commitOpening(door.id, door, dragged);
	expect(applyOpening).toHaveBeenCalledWith(door.id, expect.any(Function), true);
	// The drag's arithmetic was done against what the user could SEE, so what lands is what was dragged.
	expect(transformed(door)).toEqual(dragged);
});

it('refuses a drop whose starting opening the baseline no longer holds, rather than reverting what landed since', () => {
	const { doors, transformed } = harness();
	// A write landed offset 2500 after this drag started from the opening at 800: writing the dragged
	// copy would silently undo that write, so the transform refuses it as it refuses any illegal proposal.
	doors.commitOpening(door.id, door, { ...door, width: 1700 });
	expect(transformed({ ...door, offset: 2500 })).toBeNull();
});

it('steps and flips the BASELINE\u2019s opening, so taps accumulate once each write has landed', () => {
	const { doors, transformed } = harness();
	doors.stepOpening(door.id, 100);
	// A tap after the first write landed reads the offset it wrote, rather than overwriting it from a
	// stale copy. A tap DURING that write is dropped by `unavailable()` instead, which this cannot see.
	expect(transformed({ ...door, offset: 900 })).toMatchObject({ offset: 1000 });
	doors.flipOpening(door.id, 'right');
	expect(transformed(door)).toMatchObject({ swing: { hinge: 'start', side: 'right', angle: 90 } });
	// `steppedOpening` and `flippedOpening` refuse a no-op and a leafless opening; the door passes that through.
	doors.stepOpening(door.id, 0);
	expect(transformed(door)).toBeNull();
});

it('hands the preview door straight through to the structure actions', () => {
	const { doors, previewOpening } = harness();
	expect(doors.previewOpening).toBe(previewOpening);
});
