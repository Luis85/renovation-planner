import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DrawRoomTool } from '../../../../src/presentation/editor/tools/draw-room-tool';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';
import { EDITOR_SNAP_SERVICE } from '../../../../src/presentation/editor/snapping/editorSnapping';
import { roomSnapCandidates } from '../../../../src/presentation/editor/snapping/roomSnapCandidates';
import { WALL_LOOP } from '../../../helpers/structure';
import { pointerAt, toolContext } from '../../../helpers/tool-context';
beforeEach(() => setActivePinia(createPinia()));
function armed() {
 const draft = useRoomDraftStore();
 const tool = new DrawRoomTool({ draft, defaultName: () => 'Room 1', snapCandidates: () => ({ vertices: [{ x: 0, y: 0 }, { x: 4000, y: 3000 }], edges: [{ start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } }] }) });
 const { context } = toolContext({ worldPerScreenPixel: 10 });
 const actual = { ...context, snapService: EDITOR_SNAP_SERVICE }; tool.activate(actual);
 return { draft, tool, context: actual };
}
describe('Room snapping uses current geometry and screen-sized tolerance', () => {
 it('snaps press, preview and release through the same service while keeping dimensions rectangular', () => {
  const { tool, draft, context } = armed();
  tool.pointerDown(pointerAt(45, 45)); tool.pointerMove(pointerAt(3955, 2955));
  expect(draft.rect).toEqual({ x: 0, y: 0, width: 4000, depth: 3000 });
  expect(context.renderState.snapGuides[0]?.end).toEqual({ x: 4000, y: 3000 });
  tool.pointerUp(pointerAt(4045, 3045)); expect(draft.rect).toEqual({ x: 0, y: 0, width: 4000, depth: 3000 });
  expect(context.renderState.snapGuides[0]?.end).toEqual({ x: 4000, y: 3000 });
 });
 it('uses an edge projection on a no-move-event release and leaves distant points exact', () => {
  const { tool, draft } = armed(); tool.pointerDown(pointerAt(1000, 1000)); tool.pointerUp(pointerAt(2000, 2980));
  expect(draft.rect).toEqual({ x: 1000, y: 1000, width: 1000, depth: 2000 });
 });
 it('does not turn a stationary click near a snap target into a rectangle', () => {
  const { tool, draft, context } = armed(); tool.pointerDown(pointerAt(45, 45)); tool.pointerUp(pointerAt(45, 45));
  expect(draft.rect).toBeNull(); expect(context.renderState.snapGuides).toEqual([]);
 });
 it('clears guides on cancellation, interrupted gesture and deactivation', () => {
  const { tool, draft, context } = armed();
  for (const end of ['cancel', 'abandonGesture', 'deactivate'] as const) {
   tool.pointerDown(pointerAt(45, 45)); tool.pointerMove(pointerAt(3955, 2955)); expect(context.renderState.snapGuides).toHaveLength(1);
   tool[end](); expect(context.renderState.snapGuides).toEqual([]); expect(draft.rect).toBeNull();
  }
  tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(4000, 3000)); expect(draft.rect).toBeNull();
 });
 it('includes closed zone edges, wall centre lines and hosted endpoints without inventing edges for incomplete zones', () => {
  const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
  const result = roomSnapCandidates([{ points }, { points: [{ x: 8, y: 9 }] }], { ...WALL_LOOP, openings: [{ id: 'opening-test', kind: 'door', hostId: 'wall-a', offset: 100, width: 900, height: 2100, sill: 0 }] });
  expect(result.edges).toContainEqual({ start: points[2], end: points[0] });
  expect(result.edges).toHaveLength(3 + WALL_LOOP.walls.length);
  expect(result.vertices).toHaveLength(4 + WALL_LOOP.walls.length * 2 + 2);
 });
});
