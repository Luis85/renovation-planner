import { computed, type ComputedRef } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { toSpatialRecordDto, type SpatialRecordDto } from '../../read-models/spatialRecords';

/**
 * Every room `ProjectStore` holds, as the list-and-selection DTO — ONE derivation for
 * `PropertyLayerPanel` and `EntityInspector`, which `npm run analyze` reported as a clone
 * group the day the merge gave them the same line. A composable rather than a store getter
 * for the reason `useFloorSummary` gives: a read model does not belong in the store that owns
 * the entities it is built from.
 */
export function useSpatialRecords(): ComputedRef<SpatialRecordDto[]> {
	const project = useProjectStore();
	return computed(() => [...project.zones.values()].map((zone) => toSpatialRecordDto(zone)));
}
