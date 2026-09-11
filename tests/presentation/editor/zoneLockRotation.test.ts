// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { hoverRotation } from '../../helpers/rotationHover';
import { pointerAt } from '../../helpers/tool-context';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

/**
 * Follow-up B1, Z4 (V1-findings Q3, ADR-0027): the canvas rotation handle and its drag start
 * never consulted `locked` — `permitted()` in `rotationActions.ts` gates the WRITE path the
 * Inspector's `ObjectRotationControls` shares, so the fix cannot live there without also
 * disabling the Inspector's own rotate buttons. `zoneLockCanvas.test.ts` proves the sibling
 * case for vertex handles (`editableVertices`); this proves the rotation handle the same way.
 *
 * The room is selected and hovered WHILE still unlocked — hovering a zone `canvasCandidates`
 * already excludes from the canvas hit list (Z3) never sets `rotationHoverId` to it in the
 * first place, so that path alone cannot demonstrate the gap. Locking it AFTER the handle is
 * already showing is what `permitted()`'s missing lock check actually leaves open: nothing
 * re-evaluates the STALE hover state when a lock lands.
 */
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

it('hides the canvas rotation handle and refuses a drag once a hovered zone is locked, while the Inspector rotate control stays enabled', async () => {
	const rig = await renovationEditor();
	mounted.push(rig);
	rig.selection.select([rig.room.id]);
	await settle();
	await hoverRotation(rig.runtime, useEditorStore(rig.pinia), rig.room.geometry.points[0]);
	expect(rig.runtime.rotationActions.displayControls.value).toHaveLength(1);
	const handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeDefined();

	await rig.wrapper.get(`[data-rp-lock="${rig.room.id}"]`).trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.locked === true, 'room locked');

	expect(rig.runtime.rotationActions.displayControls.value).toEqual([]);
	expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();

	// The Inspector's own rotate buttons stay reachable — `permitted()`/`blocked` are
	// untouched by the canvas-only guard above. Checked BEFORE the pointer-down probe below:
	// a locked zone is already outside `canvasCandidates` (Z3), so a press at its body clears
	// the canvas selection on its own once no rotation gesture claims it — a fact about the
	// click-through door, not about this guard.
	expect(rig.runtime.rotationActions.blocked.value).toBe(false);

	rig.runtime.toolManager.pointerDown(pointerAt(handle.x, handle.y));
	expect(rig.runtime.rotationActions.active.value).toBe(false);
	expect(rig.runtime.renderState.rotationInteraction).toBeNull();
});
