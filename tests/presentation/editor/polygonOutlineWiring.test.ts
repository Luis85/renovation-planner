/**
 * @vitest-environment jsdom
 *
 * DOOR 2's REGISTRATION — `registerEditorTools.ts`'s `validateOutline: simpleAreaOutline` on
 * both polygon entries, which is the headline effect of the L-29 predicate slice and which
 * nothing held. Reverting both entries to `areaOutline` left 52 test files and 847 tests green,
 * measured; `simpleOutline.test.ts`'s own door-2 case hands a `DrawPolygonTool` the validator
 * itself, so it pins the TOOL's half and can see nothing about the registration.
 *
 * So this drives the gesture instead: the real mounted editor, the real registered tool, real
 * pointer events, and a zone repository that either gained a bowtie or did not. The outline is
 * asserted as PLACED before it is closed, because a snap that moved a corner would make the
 * refusal an accident rather than the predicate's.
 *
 * It lists the two ids rather than deriving them: `ToolManager` deliberately exposes no
 * registration listing (its own docblock: it "knows nothing about `select`, `pan`,
 * `draw-polygon` or any other concrete tool"), and adding an accessor for a test would be a
 * production change bought by this file alone. A THIRD polygon tool is therefore invisible
 * here, which is the honest limit of this pin.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PLAN_DTO, activateTool, canvasOf, click, rig } from '../../helpers/planEditorRig';
import { runtimeOf, settle } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
beforeEach(() => { activateNotices(); });

/**
 * Screen pixels; world is `10 x screen - 480` per axis at the rig's default camera. The world
 * outline `(1000,4000) (5000,4000) (5000,5000) (800,3800)` crosses itself at `(1500,4000)` —
 * interior to both edges — and still encloses 1.7 m², so `areaOutline` alone ACCEPTS it and
 * only the crossing rule refuses. Clear of the fixture zone (world y <= 3400), so nothing snaps.
 */
const BOWTIE: readonly (readonly [number, number])[] = [[148, 448], [548, 448], [548, 548], [128, 428]];
const world = ([x, y]: readonly [number, number]) => ({ x: x * 10 - 480, y: y * 10 - 480 });
const placed = () => BOWTIE.map(point => world(point));

describe('the polygon tools registerEditorTools registers', () => {
	it.each(['draw-polygon', 'draw-area'] as const)('%s refuses a hand-drawn bowtie that still encloses a surface', async (id) => {
		const { harness, zonesRepo } = await rig();
		try {
			const runtime = runtimeOf(harness);
			activateTool(harness, id);
			await settle();
			for (const [x, y] of BOWTIE) click(canvasOf(harness), x, y);
			await settle();
			expect(runtime.renderState.polygonSketch?.vertices).toEqual(placed());
			// The area gate is NOT what refuses this: the Finish affordance is live.
			expect(runtime.canFinishArea.value).toBe(true);

			click(canvasOf(harness), BOWTIE[0][0], BOWTIE[0][1]); // closes on the first vertex
			await settle();

			expect(expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded).toHaveLength(1);
			expect(runtime.activeToolId.value).toBe(id);
			expect(runtime.renderState.polygonSketch?.vertices).toEqual(placed());
		} finally {
			harness.unmount();
		}
	});
});
