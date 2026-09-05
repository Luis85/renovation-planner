/**
 * @vitest-environment jsdom
 *
 * `RoomDraftSketch` reads `useRoomDraftStore()` directly rather than `RenderState` (design
 * spec §2.2's recorded deviation) — driven through the real mounted editor, real Konva
 * included, so the assertions are about what actually lands on the stage.
 */
import { describe, expect, it } from 'vitest';
import Konva from 'konva';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
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

	/**
	 * **The draft draws BENEATH the selection, and that is a claim about vue-konva's ordering
	 * rather than about this template's source order.**
	 *
	 * Reachable through `keepAdding`: Room 1 is created and selected, and the very next drag
	 * draws Room 2's draft — so a live selection outline beside a live draft is that gesture's
	 * ordinary state rather than a contrived one. `InteractionLayer` mounts `<RoomDraftSketch>`
	 * ABOVE the selection block in its own template, so the draft's dashed outline and its two
	 * labels belong below the selection outline and its vertex handles.
	 *
	 * **What this case can see**: the z-order Konva actually holds, read off the layer's own
	 * children — which is what decides what is painted over what, and is NOT implied by the
	 * template's source order (vue-konva reindexes the nodes it can resolve and splices the
	 * rest to the end). **What it cannot**: whether the resulting picture is legible. Nothing
	 * here rasterizes, so the same order can look fine or awful depending on colours no
	 * assertion reads; `docs/tests/cases/Add a room.md` is where an eye looks at it.
	 */
	it('draws the draft outline and both labels BENEATH the selection outline and its handles', async () => {
		const harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		// Settled BEFORE the rectangle exists, which is what makes this the reachable
		// sequence rather than a convenient one: the selection has already rendered, and the
		// drag that follows re-renders THIS component alone. vue-konva's reindex runs on the
		// LAYER's own update, so a draft that only appears when the layer happens to re-render
		// alongside it would pass a weaker version of this case.
		await settle();
		runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 });
		await settle();

		const layer = harness.stage.findOne<Konva.Layer>('.interaction');
		if (layer === undefined) throw new Error('expected a mounted interaction layer');
		// Every node the layer draws, flattened one level below any group, in scene order —
		// so a fix that wraps the draft in a group is compared on the same footing as one
		// that does not.
		const order = layer.getChildren().flatMap((node) =>
			node instanceof Konva.Group ? node.getChildren().map((child) => child.name()) : [node.name()],
		);
		// Both must be present: an ordering assertion over one node is vacuous, and this case
		// would read the same against a build that drew no draft at all.
		expect(order).toContain('room-draft');
		expect(order).toContain('selection-outline');
		expect(order.indexOf('room-draft')).toBeLessThan(order.indexOf('selection-outline'));
		// The labels are the draft's own nodes and travel with it, asserted separately because
		// a fix that ordered the outline alone would leave them painting over the handles they
		// sit beside.
		const lastLabel = order.lastIndexOf('room-draft-label');
		expect(lastLabel).toBeGreaterThan(-1);
		expect(lastLabel).toBeLessThan(order.indexOf('selection-outline'));
	});

	/**
	 * **A Konva `Text` is positioned by its top-left corner, and both labels are handed an edge
	 * MIDPOINT** — so without an offset each coordinate means something other than what the
	 * component's own docblock says it means. Measured before the fix, on this same fixture: the
	 * width label's centre sat at 373 against a top-edge midpoint of 358 (it began at the
	 * midpoint and ran rightwards, an error that grows with the text), and the depth label's
	 * centre sat at 344 against a right-edge midpoint of 338.
	 *
	 * The report named the width label; the depth label is the same mistake on the other axis,
	 * and fixing only the reported one would have read exactly like fixing the class.
	 *
	 * **This is measurable here at all** because `tests/helpers/canvas.ts` puts `@napi-rs/canvas`
	 * behind jsdom's `<canvas>`, so Konva's own text measurement is real — `getTextWidth()`
	 * answers 30.01 for `4.2 m` rather than 0. Layout is normally outside every gate in this
	 * repository; this particular question is not, because it is arithmetic Konva performs and
	 * hands back.
	 *
	 * **Both halves of the width assertion are load-bearing.** The client rect is the 120px BOX,
	 * so its centre lands on the midpoint whatever the glyphs inside it do — `align: 'center'` is
	 * what puts them in the middle of that box, and dropping it leaves the box centred and the
	 * text left-aligned inside it, which the rect alone cannot see.
	 *
	 * What it does NOT claim: that the result is legible. Nothing here rasterizes, so whether
	 * the two labels crowd each other on a small room is `docs/tests/cases/Add a room.md`.
	 */
	it('centres each dimension label on the edge it measures', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 });
		await settle();
		// default camera: screen = (world + 480) / 10, so the outline is [148,148 .. 568,528]
		const [width, depth] = harness.stage.find<Konva.Text>('.room-draft-label');
		if (width === undefined || depth === undefined) throw new Error('expected both draft labels');

		const widthRect = width.getClientRect();
		expect(widthRect.x + widthRect.width / 2).toBe(358); // the top edge's midpoint
		expect(width.align()).toBe('center');
		expect(width.wrap()).toBe('none');

		const depthRect = depth.getClientRect();
		expect(depthRect.y + depthRect.height / 2).toBe(338); // the right edge's midpoint
		// Its outward offset is untouched: still the left edge of the text, 8px clear of the
		// rectangle's right edge, which is what keeps it beside the room rather than over it.
		expect(depthRect.x).toBe(576);
		harness.unmount();
	});
});
