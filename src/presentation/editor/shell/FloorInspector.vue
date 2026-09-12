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
import ReferenceAction from '../reference/ReferenceAction.vue';
import { tr } from '../../i18n/strings';
import { type Aggregate } from '../../read-models/spatialRecords';
import type { PlanDto } from '../../read-models/PlanDto';
import { formatArea } from './formatArea';
import { useFloorSummary } from './useFloorSummary';
import FloorSpatialLists from './FloorSpatialLists.vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import RenovationLinkedSummary from '../renovation/RenovationLinkedSummary.vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { guideSource } from '../hierarchy/parentZoneGuide';
import { renovationSummary } from '../renovation/renovationSummary';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import HostIcon from '../../components/HostIcon.vue';
import { computed, useId } from 'vue';
import { PLAN_KINDS, type PlanKind } from '../../../domain/plan/PlanKind';
import { PLAN_KIND_LABELS } from '../editorIcons';
import { useEditorRuntime } from '../runtime';
import { usePlanReorder } from './usePlanReorder';
const context = usePlanEditorContext();
const runtime = useEditorRuntime();

/**
 * `null` before the first successful hydrate — and this component may well be mounted
 * before one lands: the frame mounts with the shell's inspector region itself — in `full`
 * gated on nothing but the layout mode (matched exactly from `RoomInspector`'s Task 14
 * placement), in `constrained` also on `overlay === 'inspector'` — and never on
 * `ProjectStore.status`. There is nothing yet to summarise, so
 * the template renders nothing rather than a summary built from a `plan`/`project` that are
 * not there — the same "no live control that does nothing" rule slice 14's own empty-state
 * amendment states elsewhere.
 *
 * The derivation itself moved into `useFloorSummary` when Task 19's too-narrow notice became
 * its second reader; this component's decision about what `null` DRAWS is still its own.
 */
const summary = useFloorSummary();
const project = useProjectStore();
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
/** A detail plan's outline explained where nothing covers it (ADR-0028), while there is still a reference plan to line it up with. */
const guide = computed(() => (project.plan?.background === null ? guideSource(hierarchy.value) : null));
const starting = computed(() => project.emptyStateKey === 'noBackground' && project.zones.size === 0 && project.unreadableZones === 0);
// `new Map(undefined)` is the empty map, so the `null` summary (which the template never reads this under) needs no fallback of its own.
const roomAnnotations = computed(() => new Map(summary.value?.rooms.map(room => [room.id,
	project.stale || project.unreadableZones > 0
		? tr('editor.selection.unknown')
		: tr('renovation.summary.change-count', { count: String(renovationSummary(project.plan?.renovation ?? EMPTY_RENOVATION, room.id).changes) }),
] as const)));

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

/**
 * The plan's Kind (ADR-0029), written through `usePlanReorder().setKind` — the ONE
 * `updatePlanDetails` door the Property tree's row menu also takes, so this select adds no
 * second command path. `reorder.available` hides it without the command and in review
 * perspective; `reorder.paused` is `runtime.writesBlocked` under the tree's own name, and while
 * it holds the select carries §2.9's pair (`RoomInspector`'s `pausedAttrs` shape: both
 * attributes while paused, NEITHER while live). `setKind` answers whether the write landed, and
 * when it did not — refused while paused, or rejected by the command and reported there — the
 * DOM value is put back to the saved kind, which `:value` alone cannot do: the store's `kind`
 * never changed, so Vue has nothing to re-patch, and a select left reading `floor` over a plan
 * still saved as `room` is a control lying about a write that did not happen. Never reset on
 * success: `ProjectStore` re-hydrates on `PlanDetailsChanged` asynchronously, and snapping back
 * to the old kind in that window would flicker. `useId()` rather than a fixed id because two
 * Plan editor leaves share one document. The plan comes in from the template, where the
 * select's own `v-if` has already narrowed it — the handler has no null case to guard.
 */
const reorder = usePlanReorder();
const kindId = useId();
const kindPausedAttrs = computed(() =>
	reorder.paused.value
		? ({ 'aria-disabled': 'true', 'aria-describedby': runtime.pausedReasonId } as Record<string, string>)
		: ({} as Record<string, string>),
);
async function onKindChange(event: Event, plan: PlanDto): Promise<void> {
	const select = event.target as HTMLSelectElement;
	const landed = await reorder.setKind(plan.id, select.value as PlanKind);
	if (!landed) select.value = plan.kind;
}
</script>

<template>
	<div
		v-if="summary !== null"
		class="rp-floor-inspector"
	>
		<h3>{{ summary.floor.name }}</h3>
		<p
			v-if="guide"
			class="rp-floor-inspector__guide"
		>
			{{ tr('editor.input.detail-plan-guide-explainer', guide) }}
		</p>
		<div class="rp-inspector-primary">
			<ReferenceAction />
		</div>
		<div
			v-if="reorder.available.value && project.plan"
			class="rp-editor-requirement-assign"
		>
			<label :for="kindId">{{ tr('form.new-plan.kind') }}</label>
			<select
				:id="kindId"
				data-rp-field="plan-kind"
				:value="project.plan.kind"
				v-bind="kindPausedAttrs"
				@change="onKindChange($event, project.plan)"
			>
				<option
					v-for="kind in PLAN_KINDS"
					:key="kind"
					:value="kind"
				>
					{{ tr(PLAN_KIND_LABELS[kind]) }}
				</option>
			</select>
		</div>
		<section
			v-if="starting"
			class="rp-floor-setup"
		>
			<p>{{ tr('editor.creation.nothing-added') }}</p>
			<h4>{{ tr('editor.creation.get-started') }}</h4>
			<ul>
				<li><HostIcon name="square-dashed" />{{ tr('editor.creation.reference') }}</li>
				<li><HostIcon name="square-dashed" />{{ tr('editor.inspector.floor.rooms') }}</li>
				<li><HostIcon name="square-dashed" />{{ tr('editor.creation.scale') }}</li>
			</ul>
		</section>
		<dl
			v-if="!starting"
			class="rp-editor-inspector-fields"
		>
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
		</dl>
		<div
			v-if="!starting"
			class="rp-floor-planning-summary"
		>
			<dl class="rp-floor-planning-metric">
				<dt>{{ tr('editor.inspector.floor.planned-changes') }}</dt>
				<dd
					data-rp-stat="planned-changes"
					class="rp-floor-inspector__stat"
					:class="classFor(summary.plannedChanges)"
				>
					{{ textFor(summary.plannedChanges, count) }}
				</dd>
			</dl>
			<RenovationLinkedSummary v-if="context.commands.planning" />
			<dl
				v-else
				class="rp-floor-planning-metric"
			>
				<dt>{{ tr('editor.inspector.floor.estimated-cost') }}</dt>
				<dd
					data-rp-stat="estimated-cost"
					class="rp-floor-inspector__stat"
					:class="classFor(summary.estimatedCost)"
				>
					{{ textFor(summary.estimatedCost, count) }}
				</dd>
			</dl>
		</div>
		<FloorSpatialLists
			:summary="summary"
			:starting="starting"
			:room-annotations="roomAnnotations"
		/>
	</div>
</template>
