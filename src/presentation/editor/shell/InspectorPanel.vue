<script setup lang="ts">
/**
 * The Inspector's ROOM state (component library §8 calls this `RoomInspector`; Task 16
 * renames the file) — a BODY the frame (`EntityInspector.vue`, Task 15) routes to once
 * exactly one entity is selected. Through Task 14 this component owned the whole §60
 * inspector region — its own `<aside>`, its title and the empty/multiple-selection text —
 * and Task 15 shed all three to the frame, which now owns the routing `dto.kind` used to
 * decide here: this template renders only the `'zone'` case, since the frame never mounts it
 * for zero or several selected ids.
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
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { usePlanEditorContext } from '../PlanEditorContext';
import { formatArea } from './formatArea';
import RequirementRow from './RequirementRow.vue';

const runtime = useEditorRuntime();
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
		class="rp-editor-inspector-zone"
	>
		<dl class="rp-editor-inspector-fields">
			<dt>{{ tr('editor.inspector.name') }}</dt>
			<dd>{{ dto.name }}</dd>
			<dt>{{ tr('editor.inspector.area') }}</dt>
			<dd>{{ formatArea(dto.areaMm2) }}</dd>
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

		<button
			type="button"
			class="rp-editor-inspector-delete"
			@click="runtime.deleteZone(dto.id, dto.name)"
		>
			{{ tr('editor.inspector.delete-zone') }}
		</button>
	</div>
</template>
