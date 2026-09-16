<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import StructureFacts from './StructureFacts.vue';
import OpeningDetails from './OpeningDetails.vue';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
import StructurePlanActions from './StructurePlanActions.vue';
import ItemColorControl from '../elements/ItemColorControl.vue';
import HostIcon from '../../components/HostIcon.vue';
import { useStructureInspectorTarget } from './useStructureInspectorTarget';
const { project, runtime, session, id, wall, opening, paused } = useStructureInspectorTarget();
const rooms = computed(() => project.structure.boundaries.filter(boundary => boundary.wallIds.includes(id.value)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId));
const openingLabel = computed(() => opening.value ? tr(`editor.add.${opening.value.kind}.label`) : '');
const subject = computed(() => project.plan?.renovation?.subjects.find(item => item.targetId === id.value));
const catalogue = computed(() => runtime.planning.baseline.value?.catalogue);
const materialName = (assetId: string | undefined) => assetId === undefined ? undefined : catalogue.value?.find(item => item.asset.id === assetId)?.asset.name ?? tr('renovation.material.unknown');
/** Only a wall, a door or a window carries a material or product; any other opening has no select to set one in. */
const takesMaterial = computed(() => !!wall.value || opening.value?.kind === 'door' || opening.value?.kind === 'window');
const materials = computed(() => catalogue.value && takesMaterial.value ? { existing: materialName(subject.value?.existing?.assetId), planned: subject.value?.planned?.assetId !== subject.value?.existing?.assetId ? materialName(subject.value?.planned?.assetId) : undefined } : null);
async function setMaterial(): Promise<void> {
	if (runtime.renovation.blocked.value) return;
	const planned = session.perspective === 'renovate' && session.mode === 'planned';
	runtime.renovation.focus(session.roomId, planned ? 'planned' : 'existing');
	await runtime.renovation.edit(planned ? 'planned' : 'existing', session.roomId, subject.value?.id ?? '');
}
async function remove(event: Event): Promise<void> {
	const opener = event.currentTarget as HTMLElement;
	const root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await runtime.structureActions.remove(id.value); await nextTick();
	if (opener.isConnected || !root?.isConnected) return;
	const target = root.querySelector<HTMLElement>('[data-rp-action="edit-structure"], [data-rp-rail="details"]') ?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}
async function openRenovation(event: Event): Promise<void> {
	if (!opening.value || !runtime.renovation.available || paused.value) return;
	const opener = event.currentTarget as HTMLElement;
	const inspector = opener.closest<HTMLElement>('[data-rp-region="inspector"]');
	runtime.renovation.focus(session.roomId, 'overview', opening.value.id);
	await nextTick();
	if (!opener.isConnected && inspector?.isConnected) inspector.focus();
}
</script>
<template>
	<section
		v-if="wall || opening"
		class="rp-structure-inspector"
		:data-rp-structure-kind="opening ? opening.kind : 'wall'"
	>
		<OpeningDetails
			v-if="opening"
			:opening="opening"
			:label="openingLabel"
			:materials="materials"
		/>
		<template v-else>
			<h3>{{ tr('editor.add.wall.label') }}</h3>
			<StructureFacts
				:wall="wall!"
				:rooms="rooms"
				:materials="materials"
			/>
		</template>
		<StructureRenovationEntry v-if="session.perspective === 'renovate'" />
		<StructurePlanActions />
		<ItemColorControl />
		<div
			v-if="opening && session.perspective === 'plan' && runtime.renovation.available"
			class="rp-inspector-primary rp-structure-renovate-route"
		>
			<button
				type="button"
				data-rp-action="renovate-opening"
				:aria-label="`${tr('renovation.renovate')}: ${openingLabel}`"
				:aria-disabled="paused"
				@click="openRenovation"
			>
				<HostIcon name="hammer" />
				<span>{{ tr('renovation.renovate') }}: {{ openingLabel }}</span>
				<HostIcon name="arrow-right" />
			</button>
		</div>
		<div
			v-if="runtime.renovation.available && materials"
			class="rp-inspector-actions"
		>
			<button
				type="button"
				class="rp-inspector-action"
				:aria-disabled="runtime.renovation.blocked.value"
				data-rp-action="set-material"
				@click="setMaterial"
			>
				{{ tr('editor.structure.set-material') }}
			</button>
		</div>
		<!-- The frame's group controls, above Delete so Delete stays the foot of the whole region (side panels spec §3). -->
		<slot name="actions" />
		<div class="rp-inspector-danger">
			<button
				type="button"
				:aria-disabled="paused"
				data-rp-action="delete-structure"
				@click="remove"
			>
				<HostIcon name="trash" />{{ tr('editor.structure.delete') }}
			</button>
		</div>
	</section>
</template>
