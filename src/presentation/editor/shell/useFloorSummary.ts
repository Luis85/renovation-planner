import { computed, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../stores/ProjectStore';
import { buildFloorSummary, type FloorSummaryDto } from '../../read-models/spatialRecords';

/**
 * Task 7's `buildFloorSummary` over whatever `ProjectStore` currently holds — `null` until a
 * hydrate has landed both a plan and its project.
 *
 * ONE derivation with two callers rather than two copies of four lines: `FloorInspector` renders
 * the whole summary and `UnsupportedWidthNotice` renders one sentence of it, and a second
 * spelling of "what is on this floor" is exactly the shape that answers differently the day
 * either component's inputs change (`npm run analyze` reported the pair as a clone group the
 * moment the second one existed).
 *
 * A composable rather than a store getter, because there is nothing to hold: this is a pure
 * function of state the store already has, and a getter would put a read model into the store
 * that owns the entities it is built from.
 *
 * The `null` is a STATE and not an error — a plan still loading, a plan that is missing, a
 * project that could not be read — so each caller decides what to draw instead: the Inspector
 * renders nothing, the too-narrow notice keeps its headline and its action and drops the
 * sentence that needs a floor to be about.
 */
export function useFloorSummary(): ComputedRef<FloorSummaryDto | null> {
	const { plan, project, zones, unreadableZones } = storeToRefs(useProjectStore());

	return computed(() => {
		if (plan.value === null || project.value === null) return null;
		return buildFloorSummary({
			plan: plan.value,
			project: project.value,
			zones: [...zones.value.values()],
			unreadable: unreadableZones.value,
		});
	});
}
