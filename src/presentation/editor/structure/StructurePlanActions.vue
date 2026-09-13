<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import { useOpeningMoveAction } from './useOpeningMoveAction';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';
import CurveAction from '../curves/CurveAction.vue';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
import HostIcon from '../../components/HostIcon.vue';

const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const moveOpening = useOpeningMoveAction();
const id = computed(() => String(selection.selectedIds[0]));
const wall = computed(() => project.structure.walls.find(candidate => candidate.id === id.value));
const opening = computed(() => project.structure.openings.find(candidate => candidate.id === id.value));
const paused = computed(() => runtime.writesBlocked.value || runtime.structureActions.active.value);

async function edit(event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.structureActions.edit(id.value); await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="edit-structure"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}
</script>
<template>
	<template v-if="session.perspective === 'plan'">
		<div class="rp-inspector-actions">
			<button
				type="button"
				class="rp-inspector-action"
				:aria-disabled="paused"
				data-rp-action="edit-structure"
				@click="edit"
			>
				{{ tr('editor.structure.edit') }}
			</button>
			<button
				v-if="opening"
				type="button"
				class="rp-inspector-action"
				:aria-disabled="!runtime.openingMove.available.value"
				data-rp-action="move-opening"
				@click="moveOpening(id, $event.currentTarget as HTMLElement)"
			>
				{{ tr('editor.opening-move.action') }}
			</button>
		</div>
		<details class="rp-inspector-more">
			<summary>
				<span>{{ tr('editor.structure.more') }}</span>
				<HostIcon
					name="chevron-down"
					class="rp-sidebar-section__chevron"
				/>
			</summary>
			<ObjectRotationControls :id="id" />
			<div
				v-if="wall"
				class="rp-inspector-actions"
			>
				<CurveAction :id="id" />
			</div>
			<StructureRenovationEntry />
		</details>
	</template>
</template>
