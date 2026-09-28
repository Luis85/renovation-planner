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
import { ref, watch } from 'vue';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { formatArea } from './formatArea';
import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import type { EntityId } from '../../../core/identity/EntityId';
import HostIcon from '../../components/HostIcon.vue';
import { useRovingFocus } from '../../views/useRovingFocus';
import ZoneLockToggle from './ZoneLockToggle.vue';

const props = defineProps<{
	readonly records: readonly SpatialRecordDto[];
	readonly heading: string;
	readonly annotations?: ReadonlyMap<string, string>;
}>();

const runtime = useEditorRuntime();
const selection = useSelectionStore();

/**
 * One Tab stop for the whole list (L-46, the owner's "One Tab stop" ruling of 2026-09-25): the
 * rows rove on ArrowUp/ArrowDown through the Project list's own `useRovingFocus`, and every lock
 * sits at `tabindex="-1"`. The rows stay plain buttons in a plain list, as that module argues:
 * no composite role, because a `listbox` option may not hold the lock button.
 *
 * ArrowRight reaches the row's lock and ArrowLeft returns, which is the WAI-ARIA grid pattern's
 * own key for the next cell in a row. The lock is then the same `ZoneLockToggle` button, so Enter
 * and Space press it and the pause refuses it exactly as a click. The canvas context menu offers
 * no lock, so the key is the ruling's whole route. Focus stays in the row for ArrowUp/ArrowDown
 * from the lock, since `syncFromFocus` ignores a non-row target and the index keeps its row.
 */
const list = ref<HTMLElement | null>(null);
const roving = useRovingFocus(list, '.rp-room-list__row', 'rpId');
watch(() => props.records.map((record) => record.id), (ids) => roving.reconcile(ids));

function onKeydown(event: KeyboardEvent): void {
	if (roving.onKeydown(event)) {
		event.preventDefault();
		return;
	}
	const cell = event.key === 'ArrowRight' ? '[data-rp-lock]' : event.key === 'ArrowLeft' ? '.rp-room-list__row' : null;
	if (cell === null || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
	event.preventDefault();
	(event.target as HTMLElement).closest('li')?.querySelector<HTMLElement>(cell)?.focus();
}

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
	<ul
		ref="list"
		class="rp-room-list"
		@keydown="onKeydown"
		@focusin="roving.syncFromFocus"
	>
		<li
			v-for="(record, index) in records"
			:key="record.id"
			class="rp-room-list__item"
		>
			<button
				type="button"
				class="rp-room-list__row"
				:class="{ 'rp-room-list__row--annotated': annotations?.has(record.id) }"
				:data-rp-id="record.id"
				:tabindex="index === roving.activeIndex.value ? 0 : -1"
				:aria-pressed="isSelected(record.id)"
				@click="runtime.selectAndFrame(record.id, $event.shiftKey)"
			>
				<span>{{ record.name }}</span>
				<span class="rp-room-list__area">{{ formatArea(record.areaMm2) }}</span>
				<template v-if="annotations?.has(record.id)">
					<span class="rp-room-list__annotation">{{ annotations.get(record.id) }}</span>
					<HostIcon name="chevron-right" />
				</template>
			</button>
			<ZoneLockToggle
				:zone-id="record.id"
				:name="record.name"
				:locked="record.locked === true"
				tabindex="-1"
			/>
		</li>
	</ul>
</template>
