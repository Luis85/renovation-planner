<script setup lang="ts">
import SpatialInspectorActions from './SpatialInspectorActions.vue';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';
/**
 * The Inspector's ROOM state (component library §8's `RoomInspector`) — the BODY the frame
 * (`EntityInspector.vue`, Task 15) routes to once exactly one entity is selected. Through
 * Task 14 this component owned the whole §60 inspector region — its own `<aside>`, its
 * title and the empty/multiple-selection text — and Task 15 shed all three to the frame,
 * which now owns the routing `dto.kind` used to decide here: this template renders only the
 * `'zone'` case, since the frame never mounts it for zero or several selected ids. It was
 * `InspectorPanel.vue` through Task 15; Task 16 is the rename this file's own header used
 * to predict.
 *
 * **Task 16 gives it the homeowner vocabulary Task 7's `buildRoomOverview` derives.** The
 * selection's DTO (SDD §59) carries only the zone's raw name and area; `overview` reads the
 * SAME zone back out of `ProjectStore`'s own hydrated map and turns it into the zone's
 * homeowner-facing TYPE (ADR-0016's seven-member vocabulary, `editor.zone-type.*`) and which
 * FLOOR it is on, beside the same area figure formatted the one way `formatArea` does, and its
 * STATUS through `statusAppearance`'s caption — the one place status is read since it left the
 * canvas (canvas fidelity spec, 2026-09-10). One Coming later line follows it (`ComingLaterLine`,
 * 2026-09-12 side panels spec), naming `overview.unavailableSections` — `INSPECTOR_SECTIONS`'
 * closed list of what this build has no query for yet — as text rather than as a control that
 * would do nothing.
 *
 * **`overview` is `null` rather than assumed** while the selected zone cannot yet be found in
 * `ProjectStore`'s own map, or while no plan has hydrated at all — the same "nothing to
 * summarise yet" moment `FloorInspector`'s own `summary` computed already renders nothing
 * for, met a second time here. The type/floor/area `<dl>` and the Coming later line are
 * skipped for exactly that moment; the name (still read off `dto`, never off `overview`) and
 * the Delete button do not depend on it and stay.
 *
 * **The room's own name is an `<h3>`, not an `<h2>`.** The frame (`EntityInspector.vue`)
 * already owns the region's one permanent `<h2>` ("Inspector"), and this body is a SECTION
 * of that region rather than a second one beside it — the same relationship
 * `FloorInspector`'s `RoomSummaryList` already states for its own "Rooms"/"Areas" `<h3>`s, so
 * both Inspector states read alike. The Requirements heading nests one level further again,
 * as an `<h4>`.
 *
 * The selection's DTO (SDD §59) carries the zone's name and area, plus slice 8's delete
 * affordance and design slice 10's Requirements panel. Assigning an asset (`AssetAssignControl`)
 * dispatches through `runtime.commitEdit`, the Inspector store's ONE commit path (§59); the two override
 * controls dispatch through `runtime.commitField` instead — `commitEdit`'s fault-guarded
 * sibling over the same `inspector.commit` (design slice 16) — because a resolved refusal
 * there is the ROW's to show under its own input rather than this panel's to notify.
 *
 * Deleting a zone is the ONE control that does not go through either, and
 * `runtime.deleteZone` says why: it dispatches through the same `inspector.commit`, but a
 * reference refusal is something the delete FLOW acts on rather than reports.
 *
 * Selection → DTO runs through `InspectorStore.hydrateFrom`, watched off the selection
 * store — the pipeline slice 6 declared, not a second one beside it.
 *
 * The frame's group controls arrive through the `actions` slot, drawn directly above Delete so
 * Delete stays at the foot of the whole Inspector region (side panels spec §3) rather than only
 * of this body — the same slot name `MultiSelectionInspector` takes them through.
 */
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from './zoneTypeLabel';
import { useSelectionStore } from '../selection/selection-store';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { usePlanEditorContext } from '../PlanEditorContext';
import { formatArea } from './formatArea';
import { pauseAttrs } from './pauseAttrs';
import { buildRoomOverview, type InspectorSection, type RoomOverviewDto } from '../../read-models/roomOverview';
import { statusAppearance, type StatusAppearance } from '../layers/zone/ZoneRenderModel';
import RequirementRow from './RequirementRow.vue';
import ComingLaterLine from './ComingLaterLine.vue';
import ZoneLockRow from './ZoneLockRow.vue';
import AssetAssignControl from './AssetAssignControl.vue';
import HostIcon from '../../components/HostIcon.vue';

const runtime = useEditorRuntime();
const projectStore = useProjectStore();
/**
 * The leaf's logger, for the ONE thing below it that owns a door no guard stands behind:
 * `RequirementRow`'s two `useFieldCommit` fields, whose coalesced-continuation fault is
 * mapped, logged and notified in one step. Reached from the context rather than added to
 * `EditorRuntime` because `runtime.ts` sits exactly on its 400-line `max-lines` cap — the same
 * budget that pushed `commitField` out into its own module — and passed down as a PROP rather
 * than injected in the row, so the row stays mountable with a spy in a jsdom case.
 */
const { logger, planning } = usePlanEditorContext().commands;
const { selectedIds } = storeToRefs(useSelectionStore());

// Selection changed → re-run the query for whatever is selected now. The same call the
// post-command refresh funnel makes on the OTHER side (refresh), so the panel has
// exactly two moments: selection changed, or the selected entity changed.
watch(selectedIds, (ids) => void runtime.hydrateInspector(ids), { immediate: true });

const dto = runtime.inspectorDto;
const requirements = runtime.inspectorRequirements;

/**
 * Zone type → its homeowner-facing label key, modelled on `ZoneRenderModel`'s
 * `ZONE_TYPE_TOKENS`: a `Record<string, StringKey>` rather than a template string built
 * through a cast (`` `editor.zone-type.${zoneType}` as StringKey ``), so a mistyped or
 * missing entry is a compile error at THIS map rather than an unresolved key discovered only
 * at render. `ZoneDto.zoneType` is a plain `string`, not the domain union — a zone whose note
 * was hand-edited to a type nothing here labels still has to render, in the generic
 * `Custom`/"Other" entry, exactly the fallback `zoneFillToken` already takes for its own
 * unknown-type case.
 */


/**
 * The homeowner overview Task 7 derives, or `null` for the one moment described in the
 * header above: the selected zone is not (yet) in `ProjectStore`'s own map, or no plan has
 * hydrated. `dto.id` is read through `String(...)` because `ZoneId` is a branded string and
 * `ProjectStore.zones` is keyed by the bare kind.
 */
const overview = computed<(RoomOverviewDto & { readonly status: StatusAppearance }) | null>(() => {
	const zone = dto.value.kind === 'zone' ? projectStore.zones.get(String(dto.value.id)) : undefined;
	const plan = projectStore.plan;
	// Status is read here since it left the canvas (canvas fidelity spec, 2026-09-10).
	return zone && plan ? { ...buildRoomOverview(zone, plan), status: statusAppearance(zone.status) } : null;
});

/**
 * The Delete flow's own guard, kept at this control the same way every other write control
 * in this task guards its handler: a paused floor must not open the reference-resolution
 * dialog `runtime.deleteZone` can raise.
 *
 * The `kind === 'zone'` check is never false at the one place this is called — the template
 * renders this whole body only `v-if="dto.kind === 'zone'"` — and it is repeated here rather
 * than cast past, so the compiler rather than that outer `v-if` is what proves `dto.id` and
 * `dto.name` exist.
 */
function onDeleteZone(): void {
	if (runtime.writesBlocked.value || dto.value.kind !== 'zone') return;
	void runtime.deleteZone(dto.value.id, dto.value.name);
}

/**
 * Design spec §2.9's pause attributes for Delete (Assign has its own in `AssetAssignControl`),
 * the shared `pauseAttrs` shape. `v-bind="pausedAttrs"` renders byte-identically to the two
 * ternaries it replaced; the extraction is what took this template's cognitive complexity back
 * under budget after this task's own paused-state bindings pushed it over (`npm run analyze`,
 * fallow's template check).
 */
const pausedAttrs = computed(() => pauseAttrs(runtime));

/** `RequirementRow`'s own `paused` prop, over the same computed rather than the raw ref's
 * `.value` repeated at the one call site — the same reasoning as `pausedAttrs` above. */
const paused = computed(() => runtime.writesBlocked.value);

/**
 * What the Coming later line names: the three homeowner questions while there is no renovation
 * session, and the four linked sections unless connected planning supplies them — the same two
 * conditions Task 16's two navigation lists were mounted under. Read only once
 * `overview` exists, so a standalone mount with no `renovation` on its runtime never reaches it.
 */
const comingLater = computed<readonly InspectorSection[]>(() => {
	const current = overview.value;
	if (current === null) return [];
	const renovation = runtime.renovation.available;
	const wanted: readonly InspectorSection[] = [
		...(renovation ? [] : (['existing', 'planned', 'work'] as const)),
		...(renovation && planning ? [] : (['costs', 'documents', 'photos', 'notes'] as const)),
	];
	return wanted.filter((section) => current.unavailableSections.includes(section));
});

/**
 * The lock row's own version of `pausedAttrs` above: `overview` can be briefly `null` while it
 * loads, so this folds that null-guard and the `locked` read into one flat boolean rather than
 * nesting the badge's `v-if` inside a wrapping `v-if="overview !== null"` — the nesting is what
 * pushed this template's cognitive complexity over budget (`npm run analyze`, fallow's template
 * check), the same way this task's own paused-state bindings did for `pausedAttrs`. Optional
 * chaining rather than a guard, matching `SpatialInspectorActions`'s `overview?.record` below.
 */
const zoneLocked = computed(() => overview.value?.record.locked === true);
</script>

<template>
	<div
		v-if="dto.kind === 'zone'"
		class="rp-room-inspector"
		:data-rp-id="dto.id"
	>
		<h3 class="rp-editor-panel-title">
			{{ dto.name }}
		</h3>

		<dl
			v-if="overview !== null"
			class="rp-editor-inspector-fields"
		>
			<dt>{{ tr('editor.inspector.type') }}</dt>
			<dd>{{ tr(zoneTypeLabel(overview.record.zoneType)) }}</dd>
			<dt>{{ tr('editor.inspector.floor-context') }}</dt>
			<dd>{{ overview.floorName }}</dd>
			<dt>{{ tr('editor.inspector.area') }}</dt>
			<dd>{{ formatArea(overview.record.areaMm2) }}</dd>
			<dt>{{ tr('editor.inspector.status') }}</dt>
			<dd>{{ tr(overview.status.captionKey) }}</dd>
		</dl>

		<div class="rp-inspector-toolbar">
			<ObjectRotationControls :id="dto.id" />
			<ZoneLockRow
				:zone-id="dto.id"
				:name="dto.name"
				:locked="zoneLocked"
			/>
		</div>

		<div class="rp-inspector-actions">
			<SpatialInspectorActions
				:zone-id="dto.id"
				:record="overview?.record"
			/>
		</div>

		<section
			class="rp-editor-inspector-requirements"
			:aria-label="tr('editor.inspector.requirements')"
		>
			<h4 class="rp-editor-panel-subtitle">
				{{ tr('editor.inspector.requirements') }}
			</h4>
			<p
				v-if="requirements.length === 0"
				class="rp-editor-inspector-empty"
			>
				{{ tr('editor.inspector.requirements.empty') }}
			</p>
			<ul class="rp-editor-requirement-list">
				<RequirementRow
					v-for="row in requirements"
					:key="row.requirementId"
					:row="row"
					:commit="runtime.commitField"
					:logger="logger"
					:paused="paused"
					:paused-reason-id="runtime.pausedReasonId"
				/>
			</ul>
			<AssetAssignControl :zone-id="dto.id" />
		</section>

		<ComingLaterLine :sections="comingLater" />

		<slot name="actions" />

		<div class="rp-inspector-danger">
			<button
				type="button"
				class="rp-editor-inspector-delete"
				v-bind="pausedAttrs"
				@click="onDeleteZone"
			>
				<HostIcon name="trash" />{{ tr('editor.inspector.delete-zone') }}
			</button>
		</div>
	</div>
</template>
