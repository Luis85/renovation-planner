<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import StructureFacts from './StructureFacts.vue';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
import { useOpeningMoveAction } from './useOpeningMoveAction';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';
import CurveAction from '../curves/CurveAction.vue';
import HostIcon from '../../components/HostIcon.vue';
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const moveOpening = useOpeningMoveAction();
const id = computed(() => String(selection.selectedIds[0]));
const wall = computed(() => project.structure.walls.find(candidate => candidate.id === id.value));
const opening = computed(() => project.structure.openings.find(candidate => candidate.id === id.value));
const paused = computed(() => runtime.writesBlocked.value || runtime.structureActions.active.value);
const rooms = computed(() => project.structure.boundaries.filter(boundary => boundary.wallIds.includes(id.value)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId));
const subject = computed(() => project.plan?.renovation?.subjects.find(item => item.targetId === id.value));
const catalogue = computed(() => runtime.planning.baseline.value?.catalogue);
const materialName = (assetId: string | undefined) => assetId === undefined ? undefined : catalogue.value?.find(item => item.asset.id === assetId)?.asset.name ?? tr('renovation.material.unknown');
const materials = computed(() => catalogue.value ? { existing: materialName(subject.value?.existing?.assetId), planned: subject.value?.planned?.assetId !== subject.value?.existing?.assetId ? materialName(subject.value?.planned?.assetId) : undefined } : null);
async function setMaterial(): Promise<void> {
	const planned = session.perspective === 'renovate' && session.mode === 'planned';
	runtime.renovation.focus(session.roomId, planned ? 'planned' : 'existing');
	await runtime.renovation.edit(planned ? 'planned' : 'existing', session.roomId, subject.value?.id ?? '');
}
async function act(event: Event, remove: boolean): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await (remove ? runtime.structureActions.remove(id.value) : runtime.structureActions.edit(id.value));
	await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="edit-structure"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}
</script>
<template>
	<section
		v-if="wall || opening"
		class="rp-structure-inspector"
	>
		<h3>{{ tr(wall ? 'editor.add.wall.label' : `editor.add.${opening!.kind}.label`) }}</h3>
		<StructureFacts
			:wall="wall"
			:opening="opening"
			:rooms="rooms"
			:materials="materials"
		/>
		<div class="rp-inspector-actions">
			<button
				type="button"
				class="rp-inspector-action"
				:aria-disabled="paused"
				data-rp-action="edit-structure"
				@click="act($event, false)"
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
			<button
				v-if="runtime.renovation.available && materials"
				type="button"
				class="rp-inspector-action"
				:aria-disabled="runtime.renovation.blocked.value"
				data-rp-action="set-material"
				@click="setMaterial"
			>
				{{ tr('editor.structure.set-material') }}
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
		<!-- The frame's group controls, above Delete so Delete stays the foot of the whole region (side panels spec §3). -->
		<slot name="actions" />
		<div class="rp-inspector-danger">
			<button
				type="button"
				:aria-disabled="paused"
				data-rp-action="delete-structure"
				@click="act($event, true)"
			>
				<HostIcon name="trash" />{{ tr('editor.structure.delete') }}
			</button>
		</div>
	</section>
</template>
