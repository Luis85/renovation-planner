<script setup lang="ts">
/**
 * §60's inspector region: the selection's DTO (SDD §59) with name and area for a zone, a
 * count for a multi-selection, nothing when empty — plus slice 8's delete affordance and
 * design slice 10's Requirements panel. Every edit dispatches through
 * `runtime.commitEdit`, which is the Inspector store's ONE commit path (§59): assign
 * through the reversible assignment adapter, quantity and cost overrides through theirs,
 * each with a "reset to calculated" affordance that sends `null` — a value in this seam,
 * not an absence.
 *
 * Deleting a zone is the ONE control that does not go through `commitEdit`, and
 * `runtime.deleteZone` says why: it dispatches through the same `inspector.commit`, but a
 * reference refusal is something the delete FLOW acts on rather than reports.
 *
 * Selection → DTO runs through `InspectorStore.hydrateFrom`, watched off the selection
 * store — the pipeline slice 6 declared, not a second one beside it.
 */
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Money } from '../../../core/money/Money';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import RequirementRow from './RequirementRow.vue';

const runtime = useEditorRuntime();
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
 * `'en-US'`, deliberately, not the host locale: a decimal comma on a de-DE machine and a
 * decimal point everywhere else would make the same area render two ways for the same
 * vault. One stable format until the string table grows a formatting rule of its own
 * (slice 9's quantity engine is where units and locales get decided properly).
 */
const formatArea = (areaMm2: number): string =>
	`${(areaMm2 / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })} m²`;

function setQuantity(requirementId: RequirementId, quantity: number | null): void {
	void runtime.commitEdit({ kind: 'quantity-override', requirementId, quantity });
}

function setCost(requirementId: RequirementId, cost: Money | null): void {
	void runtime.commitEdit({ kind: 'cost-override', requirementId, cost });
}

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
	<aside
		class="rp-editor-inspector"
		:aria-label="tr('editor.inspector')"
	>
		<h2 class="rp-editor-panel-title">
			{{ tr('editor.inspector') }}
		</h2>
		<p
			v-if="dto.kind === 'empty'"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.empty') }}
		</p>
		<p
			v-else-if="dto.kind === 'multiple'"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.multiple') }}
		</p>
		<div
			v-else
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
						@set-quantity="(quantity) => setQuantity(row.requirementId, quantity)"
						@set-cost="(cost) => setCost(row.requirementId, cost)"
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
	</aside>
</template>
