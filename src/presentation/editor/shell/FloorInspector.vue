<script setup lang="ts">
/**
 * The Inspector's FLOOR state (component library §8: `FloorInspector` — "Floor summary and
 * room list"): what the frame (`EntityInspector.vue`, Task 15) shows while nothing is
 * selected. `buildFloorSummary` (Task 7) is a pure derivation over `ProjectStore`'s own
 * hydrated state, so this component owns no query and no ticket of its own — the same
 * pipeline `ProjectStore.hydrate` already keeps current for the canvas, read a second way.
 *
 * Five stats, each an `Aggregate` (Task 7's own rule): `available` renders a value nothing
 * else annotates, `partial` renders that value beside how many records could not be read,
 * and `unavailable` renders neither a zero nor a dash but the word itself — SDD §85's "never
 * colour alone" applies here as much as it does to a button: `--unavailable` pairs
 * `var(--text-muted)` with an italic style and the words "Not available yet", never a colour
 * shift on its own.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useProjectStore } from '../../stores/ProjectStore';
import { buildFloorSummary, type Aggregate } from '../../read-models/spatialRecords';
import { formatArea } from './formatArea';
import RoomSummaryList from './RoomSummaryList.vue';

const { plan, project, zones, unreadableZones } = storeToRefs(useProjectStore());

/**
 * `null` before the first successful hydrate — and this component may well be mounted
 * before one lands: the frame mounts unconditionally on `inspectorPanelOpen`
 * (`PlanEditorRoot`'s own sibling `v-if`, matched exactly from `RoomInspector`'s Task 14
 * placement), never gated on `ProjectStore.status`. There is nothing yet to summarise, so
 * the template renders nothing rather than a summary built from a `plan`/`project` that are
 * not there — the same "no live control that does nothing" rule slice 14's own empty-state
 * amendment states elsewhere.
 */
const summary = computed(() => {
	if (plan.value === null || project.value === null) return null;
	return buildFloorSummary({
		plan: plan.value,
		project: project.value,
		zones: [...zones.value.values()],
		unreadable: unreadableZones.value,
	});
});

/** The modifier class an `Aggregate` renders under, or `''` for the plain `available` case. */
function classFor(aggregate: Aggregate<unknown>): string {
	if (aggregate.state === 'unavailable') return 'rp-floor-inspector__stat--unavailable';
	if (aggregate.state === 'partial') return 'rp-floor-inspector__stat--partial';
	return '';
}

/**
 * The three renderings Task 7's `Aggregate` union asks for: a formatted value, that value
 * plus how many records it does not speak for, or the one word that stands for none of it.
 */
function textFor<T>(aggregate: Aggregate<T>, format: (value: T) => string): string {
	if (aggregate.state === 'unavailable') return tr('editor.inspector.unavailable');
	const value = format(aggregate.value);
	if (aggregate.state === 'partial') {
		return `${value} ${tr('editor.inspector.partial', { count: String(aggregate.unreadable) })}`;
	}
	return value;
}

const count = (value: number): string => String(value);
</script>

<template>
	<div
		v-if="summary !== null"
		class="rp-floor-inspector"
	>
		<dl class="rp-editor-inspector-fields">
			<dt>{{ tr('editor.inspector.floor.rooms') }}</dt>
			<dd
				data-rp-stat="rooms"
				class="rp-floor-inspector__stat"
				:class="classFor(summary.roomCount)"
			>
				{{ textFor(summary.roomCount, count) }}
			</dd>

			<dt>{{ tr('editor.inspector.floor.areas') }}</dt>
			<dd
				data-rp-stat="areas"
				class="rp-floor-inspector__stat"
				:class="classFor(summary.areaCount)"
			>
				{{ textFor(summary.areaCount, count) }}
			</dd>

			<dt>{{ tr('editor.inspector.floor.total-area') }}</dt>
			<dd
				data-rp-stat="total-area"
				class="rp-floor-inspector__stat"
				:class="classFor(summary.totalAreaMm2)"
			>
				{{ textFor(summary.totalAreaMm2, formatArea) }}
			</dd>

			<dt>{{ tr('editor.inspector.floor.planned-changes') }}</dt>
			<dd
				data-rp-stat="planned-changes"
				class="rp-floor-inspector__stat"
				:class="classFor(summary.plannedChanges)"
			>
				{{ textFor(summary.plannedChanges, count) }}
			</dd>

			<dt>{{ tr('editor.inspector.floor.estimated-cost') }}</dt>
			<dd
				data-rp-stat="estimated-cost"
				class="rp-floor-inspector__stat"
				:class="classFor(summary.estimatedCost)"
			>
				{{ textFor(summary.estimatedCost, count) }}
			</dd>
		</dl>

		<RoomSummaryList
			v-if="summary.rooms.length > 0"
			:records="summary.rooms"
			:heading="tr('editor.inspector.floor.rooms')"
		/>
		<p
			v-else
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.floor.no-rooms') }}
		</p>

		<RoomSummaryList
			v-if="summary.areas.length > 0"
			:records="summary.areas"
			:heading="tr('editor.inspector.floor.areas')"
		/>
	</div>
</template>
