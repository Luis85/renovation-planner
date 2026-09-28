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
 * no lock, so the key is the ruling's whole route. ArrowUp/ArrowDown from the lock move between
 * rooms rather than staying put, because `onFocusin` syncs the roving index to the lock's OWN row
 * before `roving.onKeydown` reads it — a lock reached any other way than ArrowRight (a pointer
 * click) left the index on whatever row was active before, so the next arrow moved from that
 * stale row instead of the lock's (L-46 review finding 1).
 */
const list = ref<HTMLElement | null>(null);
const roving = useRovingFocus(list, '.rp-room-list__row', 'rpId');

/**
 * The lock sits outside `roving`'s own `.rp-room-list__row` members, so its own `syncFromFocus`
 * (keyed off `event.target` directly) never recognizes it. Route a lock focus through `syncTo`
 * with that lock's OWN row instead, so the roving index — and the arrow keys and the Tab stop
 * that read it — follow the row the user is actually in rather than a stale one.
 */
function onFocusin(event: FocusEvent): void {
	const target = event.target as HTMLElement;
	if (target.matches('[data-rp-lock]')) {
		roving.syncTo(target.closest('li')?.querySelector<HTMLElement>('.rp-room-list__row') ?? null);
		return;
	}
	roving.syncFromFocus(event);
}

/**
 * The id of the room FOCUS is currently in — the row itself, or, via a lock, the row that lock
 * belongs to — or `null` when focus is not inside this list at all. Read off the DOM rather than
 * off `roving`'s own private tracking, so it reflects the room actually holding focus regardless
 * of how it got there (arrow, Tab, or a pointer click straight onto a lock).
 */
function focusedRoomId(): string | null {
	const active = document.activeElement as HTMLElement | null;
	if (active === null || list.value === null || !list.value.contains(active)) return null;
	const row = active.matches('[data-rp-lock]') ? active.closest('li')?.querySelector<HTMLElement>('.rp-room-list__row') : active;
	return row?.dataset.rpId ?? null;
}

/**
 * Removing the focused room's own record moves the Tab stop to a survivor (`reconcile`) but does
 * not move FOCUS — a plain ref write reaches no element — so it fell to `BODY` (L-46 review
 * finding 2). `focusedId` is read before `reconcile` runs (this watcher fires pre-patch, so the
 * removed row is still in the DOM to answer `focusedRoomId`), and the refocus itself waits for
 * the SEPARATE post-flush watcher below so it runs after Vue has actually patched the rows —
 * refocusing here, pre-patch, would target a row about to be replaced.
 *
 * **Refocus only when that id actually left `ids`, not on every change of them.**
 * `useSpatialRecords`/`buildFloorSummary` hand this component a freshly built `records` array on
 * every reactive read — a rename, a lock toggle, an undo of either — so `records.map(id)` is a
 * NEW array on every one of those too, and both watchers below fire on all of them, not only a
 * removal (L-46 re-review, Important). Gating on "the focused room's id is still among `ids`"
 * (mirroring `reconcile`'s own `surviving === -1` case) is what tells a same-ids content update
 * apart from an actual removal; the first must leave focus exactly where it was — on a LOCK,
 * among other places, which the unconditional `.focus()` on the row this replaced did not.
 */
let refocusAfterPatch = false;
let focusedId: string | null = null;
watch(() => props.records.map((record) => record.id), (ids) => {
	focusedId = focusedRoomId();
	refocusAfterPatch = focusedId !== null && !ids.includes(focusedId);
	roving.reconcile(ids);
});
watch(() => props.records.map((record) => record.id), () => {
	if (!refocusAfterPatch) return;
	refocusAfterPatch = false;
	list.value?.querySelectorAll<HTMLElement>('.rp-room-list__row')[roving.activeIndex.value]?.focus();
}, { flush: 'post' });

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
		@focusin="onFocusin"
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
