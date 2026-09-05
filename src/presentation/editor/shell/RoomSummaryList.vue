<script setup lang="ts">
/**
 * One list of the floor state's rows — Rooms or Areas (component library §8, `FloorInspector`'s
 * own section): a heading plus a button per record that selects it and frames the camera onto
 * it, through the same list-framing seam (design slice 12) a Task 7 `SpatialRecordDto` already
 * carries an id for.
 *
 * Selection is read from the store directly rather than taken as a prop: `isSelected` is
 * `SelectionStore`'s own member (design slice 6), and a second, hand-rolled copy of "is this id
 * among the selected ones" here would be a second answer to a question the store already has.
 */
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import type { EntityId } from '../../../core/identity/EntityId';

defineProps<{
	readonly records: readonly SpatialRecordDto[];
	readonly heading: string;
	readonly toggleSelection?: boolean;
}>();

const runtime = useEditorRuntime();
const selection = useSelectionStore();

/**
 * `record.id` is a bare `string` (Task 7's own `SpatialRecordDto`); the store's own
 * `isSelected` takes the branded `EntityId` every OTHER caller in this editor already
 * narrows to at its own call site (`RoomInspector.vue`'s `zoneId as never`, this file's
 * sibling). The cast lives here rather than in the template for the same reason theirs do.
 */
function isSelected(id: string): boolean {
	return selection.isSelected(id as EntityId<string>);
}
</script>

<template>
	<h3 class="rp-editor-panel-subtitle">
		{{ heading }}
	</h3>
	<ul class="rp-room-list">
		<li
			v-for="record in records"
			:key="record.id"
		>
			<button
				type="button"
				class="rp-room-list__row"
				:data-rp-id="record.id"
				:aria-pressed="isSelected(record.id)"
				@click="runtime.selectAndFrame(record.id, toggleSelection === true || $event.shiftKey)"
			>
				{{ record.name }}
			</button>
		</li>
	</ul>
</template>
