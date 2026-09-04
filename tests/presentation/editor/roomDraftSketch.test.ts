/**
 * @vitest-environment jsdom
 *
 * `RoomDraftSketch` reads `useRoomDraftStore()` directly rather than `RenderState` (design
 * spec §2.2's recorded deviation) — driven through the real mounted editor, real Konva
 * included, so the assertions are about what actually lands on the stage.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../helpers/editor';

describe('the room draft sketch', () => {
	it('draws the drafted rectangle dashed with two dimension labels, and nothing before a rectangle exists', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const before = harness.stage.find('.room-draft');
		expect(before).toHaveLength(0);
		runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 });
		await settle();
		const outline = harness.stage.findOne<Konva.Line>('.room-draft');
		if (outline === undefined) throw new Error('expected the room draft outline on the stage');
		// default camera: screen = (world + 480) / 10
		expect(outline.points()).toEqual([148, 148, 568, 148, 568, 528, 148, 528]);
		expect(outline.dash()).toEqual([4, 4]);
		const labels = harness.stage.find<Konva.Text>('.room-draft-label').map((node) => node.text());
		expect(labels).toEqual(['4.2 m', '3.8 m']);
		runtime.roomDraft.clearRect();
		await settle();
		expect(harness.stage.find('.room-draft')).toHaveLength(0);
	});
});
