/**
 * @vitest-environment jsdom
 *
 * The zone layer paints in MODEL order, which is a claim about vue-konva's reindex walk
 * rather than about `v-for`'s source order — driven through the real mounted editor, real
 * Konva included, so the assertion is about what actually lands on the stage.
 *
 * `ZoneShape.vue`'s docblock carries the mechanism (and `RoomDraftSketch.vue` the original
 * measurement): a fragment-rooted child is unresolvable to the walk, so its nodes are left
 * out of the ordering array and stay where they were first appended. Paint order was
 * therefore MOUNT order, while every other consumer of the zone list — the hit test, the
 * inspector — reads the model.
 */
import Konva from 'konva';
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas, settle, type CanvasHarness } from '../../helpers/editor';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';

let open: CanvasHarness | null = null;

afterEach(() => {
	open?.unmount();
	open = null;
});

/** The zone layer's captions in scene order — `find` is a depth-first walk of `getChildren()`. */
function captionOrder(stage: Konva.Stage): string[] {
	return (stage.findOne<Konva.Layer>('.zone')?.find<Konva.Text>('Text') ?? []).map((node) => node.text());
}

describe('the zone layer paint order', () => {
	/**
	 * **The reorder is a re-hydration, because that is the only way the order changes in
	 * production**: `ProjectStore.zones` is rebuilt as a fresh `Map` from whatever
	 * `findZonesByPlan` answers, so the vault's own order is the model's order. The fixture
	 * array is mutated in place because `fakeQueries` closes over the reference it was
	 * handed, which makes the second read answer the reversed list.
	 *
	 * **Read through the captions rather than the group names**, so a build without the group
	 * root is compared on the same footing rather than reporting a list of empty strings —
	 * the red this case was watched failing at is `['Kitchen', 'Planned', 'Terrace',
	 * 'Complete']`, the mount order, which is the defect stated in the form the fix removes.
	 */
	it('repaints in the new model order after the zone list is rebuilt in reverse', async () => {
		const zones = [...FIXTURE_ZONES];
		const harness = await mountPlanEditorCanvas({ zones });
		open = harness;
		const before = captionOrder(harness.stage);
		expect(before).toEqual(['Kitchen', '12 m²', 'Planned', 'Terrace', '3 m²', 'Complete']);

		zones.reverse();
		harness.changePlan();
		await settle();

		expect(captionOrder(harness.stage)).toEqual(['Terrace', '3 m²', 'Complete', 'Kitchen', '12 m²', 'Planned']);
	});

	/**
	 * The reason the case above can pass at all: one resolvable Konva root per zone, which is
	 * what the reindex walk puts in its ordering array. Asserted separately because a future
	 * template that split a zone back into siblings would still satisfy an ordering assertion
	 * taken on a freshly mounted stage, and fail only after a reorder.
	 */
	it('gives each zone exactly one Konva root, named by the zone id', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;

		const roots = harness.stage.findOne<Konva.Layer>('.zone')?.getChildren() ?? [];

		expect(roots.map((node) => node.name())).toEqual(FIXTURE_ZONES.map((zone) => zone.id));
		expect(roots.every((node) => node instanceof Konva.Group)).toBe(true);
	});
});
