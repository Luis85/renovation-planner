<script setup lang="ts">
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
 * FLOOR it is on, beside the same area figure formatted the one way `formatArea` does. Two
 * navigation lists follow it — `HomeownerQuestionNav` (What's here / What will change / What
 * needs doing) and `LinkedContentList` (Costs, Documents, Photos, Notes) — both driven by
 * `overview.unavailableSections`, `INSPECTOR_SECTIONS`' own closed list of what this build has
 * no query for yet. Every row in both is rendered as text with `editor.inspector.unavailable`
 * rather than as a control that would do nothing; a Feature that supplies one of these removes
 * its section from that list and gives the row a real control.
 *
 * **`overview` is `null` rather than assumed** while the selected zone cannot yet be found in
 * `ProjectStore`'s own map, or while no plan has hydrated at all — the same "nothing to
 * summarise yet" moment `FloorInspector`'s own `summary` computed already renders nothing
 * for, met a second time here. The type/floor/area `<dl>` and both lists are skipped for
 * exactly that moment; the name (still read off `dto`, never off `overview`) and the Delete
 * button do not depend on it and stay.
 *
 * The selection's DTO (SDD §59) carries the zone's name and area, plus slice 8's delete
 * affordance and design slice 10's Requirements panel. Assigning an asset dispatches through
 * `runtime.commitEdit`, the Inspector store's ONE commit path (§59); the two override
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
 */
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import { useSelectionStore } from '../selection/selection-store';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { usePlanEditorContext } from '../PlanEditorContext';
import { formatArea } from './formatArea';
import { buildRoomOverview, type RoomOverviewDto } from '../../read-models/roomOverview';
import RequirementRow from './RequirementRow.vue';
import HomeownerQuestionNav from './HomeownerQuestionNav.vue';
import LinkedContentList from './LinkedContentList.vue';

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
const { logger } = usePlanEditorContext().commands;
const { selectedIds } = storeToRefs(useSelectionStore());

// Selection changed → re-run the query for whatever is selected now. The same call the
// post-command refresh funnel makes on the OTHER side (refresh), so the panel has
// exactly two moments: selection changed, or the selected entity changed.
watch(selectedIds, (ids) => void runtime.hydrateInspector(ids), { immediate: true });

const dto = runtime.inspectorDto;
const requirements = runtime.inspectorRequirements;

/** The assign-asset picker's options; hydrated by the runtime alongside the rows. */
const assetOptions = runtime.assetOptions;
const pickedAssetId = ref('');

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
const ZONE_TYPE_LABELS: Readonly<Record<string, StringKey>> = {
	Room: 'editor.zone-type.Room',
	Garden: 'editor.zone-type.Garden',
	Terrace: 'editor.zone-type.Terrace',
	Driveway: 'editor.zone-type.Driveway',
	Roof: 'editor.zone-type.Roof',
	ConstructionArea: 'editor.zone-type.ConstructionArea',
	Custom: 'editor.zone-type.Custom',
};

function zoneTypeLabel(zoneType: string): StringKey {
	return ZONE_TYPE_LABELS[zoneType] ?? 'editor.zone-type.Custom';
}

/**
 * The homeowner overview Task 7 derives, or `null` for the one moment described in the
 * header above: the selected zone is not (yet) in `ProjectStore`'s own map, or no plan has
 * hydrated. `dto.id` is read through `String(...)` because `ZoneId` is a branded string and
 * `ProjectStore.zones` is keyed by the bare kind.
 */
const overview = computed<RoomOverviewDto | null>(() => {
	const zone = dto.value.kind === 'zone' ? projectStore.zones.get(String(dto.value.id)) : undefined;
	const plan = projectStore.plan;
	return zone && plan ? buildRoomOverview(zone, plan) : null;
});

function assignSelected(zoneId: string): void {
	// The picker starts on no selection, so pressing Assign first is inert rather than a
	// command refused for an id that is the empty string.
	if (pickedAssetId.value === '') return;
	void runtime.commitEdit({
		kind: 'assign',
		zoneId: zoneId as never,
		assetId: pickedAssetId.value as never,
	});
	pickedAssetId.value = '';
}
</script>

<template>
	<div
		v-if="dto.kind === 'zone'"
		class="rp-room-inspector"
		:data-rp-id="dto.id"
	>
		<h2 class="rp-editor-panel-title">
			{{ dto.name }}
		</h2>

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
		</dl>

		<section
			class="rp-editor-inspector-requirements"
			:aria-label="tr('editor.inspector.requirements')"
		>
			<h3 class="rp-editor-panel-subtitle">
				{{ tr('editor.inspector.requirements') }}
			</h3>
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
				/>
			</ul>

			<div class="rp-editor-requirement-assign">
				<label for="rp-assign-asset">{{ tr('editor.inspector.assign.label') }}</label>
				<select
					id="rp-assign-asset"
					v-model="pickedAssetId"
				>
					<option
						v-for="option in assetOptions"
						:key="option.id"
						:value="option.id"
					>
						{{ option.name }}
					</option>
				</select>
				<button
					type="button"
					@click="assignSelected(dto.id)"
				>
					{{ tr('editor.inspector.assign.button') }}
				</button>
			</div>
		</section>

		<HomeownerQuestionNav
			v-if="overview !== null"
			:unavailable="overview.unavailableSections"
		/>
		<LinkedContentList
			v-if="overview !== null"
			:unavailable="overview.unavailableSections"
		/>

		<button
			type="button"
			class="rp-editor-inspector-delete"
			@click="runtime.deleteZone(dto.id, dto.name)"
		>
			{{ tr('editor.inspector.delete-zone') }}
		</button>
	</div>
</template>
