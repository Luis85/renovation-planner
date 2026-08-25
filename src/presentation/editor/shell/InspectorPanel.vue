<script setup lang="ts">
/**
 * §60's inspector region, filled by design slice 8: the selection's DTO (SDD §59:
 * Selection → Inspector Query → Inspector DTO → Vue UI) with name and area for a zone,
 * a count for a multi-selection, nothing when empty — plus this slice's one write
 * affordance, delete, which dispatches through the same decorated history every other
 * gesture in the leaf uses.
 *
 * Selection → DTO runs through `InspectorStore.hydrateFrom`, watched off the selection
 * store — the pipeline slice 6 declared, not a second one beside it.
 */
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';

const runtime = useEditorRuntime();
const { selectedIds } = storeToRefs(useSelectionStore());

// Selection changed → re-run the query for whatever is selected now. The same call the
// post-command refresh funnel makes on the OTHER side (refresh), so the panel has
// exactly two moments: selection changed, or the selected entity changed.
watch(
	() => [...selectedIds.value],
	(ids) => void runtime.hydrateInspector(ids),
	{ immediate: true },
);

const dto = runtime.inspectorDto;

/**
 * `'en-US'`, deliberately, not the host locale: a decimal comma on a de-DE machine and a
 * decimal point everywhere else would make the same area render two ways for the same
 * vault. One stable format until the string table grows a formatting rule of its own
 * (slice 9's quantity engine is where units and locales get decided properly).
 */
const formatArea = (areaMm2: number): string =>
	`${(areaMm2 / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })} m²`;
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
			<button
				type="button"
				class="rp-editor-inspector-delete"
				@click="runtime.deleteZone(dto.id)"
			>
				{{ tr('editor.inspector.delete-zone') }}
			</button>
		</div>
	</aside>
</template>
