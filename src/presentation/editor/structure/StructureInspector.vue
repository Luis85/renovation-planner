<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
import StructureFacts from './StructureFacts.vue';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
import StructurePlanActions from './StructurePlanActions.vue';
import HostIcon from '../../components/HostIcon.vue';
import { useStructureInspectorTarget } from './useStructureInspectorTarget';
const { project, runtime, session, id, wall, opening, paused } = useStructureInspectorTarget();
const openingHost = computed(() => opening.value ? project.structure.walls.find(candidate => candidate.id === opening.value?.hostId) : undefined);
const rooms = computed(() => project.structure.boundaries.filter(boundary => boundary.wallIds.includes(id.value)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId));
const openingRooms = computed(() => {
	const hostId = openingHost.value?.id;
	return hostId ? project.structure.boundaries
		.filter(boundary => boundary.wallIds.includes(hostId))
		.map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId) : [];
});
const openingLabel = computed(() => opening.value ? tr(`editor.add.${opening.value.kind}.label`) : '');
const openingHostLabel = computed(() => {
	const hostId = openingHost.value?.id;
	return hostId
		? tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(candidate => candidate.id === hostId) + 1) })
		: opening.value?.hostId ?? '';
});
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
	runtime.renovation.focus(session.roomId, 'overview', opening.value.id);
	await nextTick();
	(event.currentTarget as HTMLElement).closest<HTMLElement>('[data-rp-region="inspector"]')?.focus();
}
</script>
<template>
	<section
		v-if="wall || opening"
		class="rp-structure-inspector"
		:data-rp-structure-kind="opening ? opening.kind : 'wall'"
	>
		<template v-if="opening">
			<h3 data-rp-opening-identity>{{ openingLabel }}</h3>
			<p
				class="rp-structure-opening-context"
				data-rp-opening-context
			>
				{{ openingRooms.length ? openingRooms.join(' / ') : tr('renovation.target.none') }}
			</p>
			<p
				v-if="project.plan?.name"
				class="rp-structure-opening-floor"
				data-rp-opening-floor
			>
				<span>{{ tr('editor.inspector.floor-context') }}:</span> {{ project.plan.name }}
			</p>
			<dl class="rp-editor-inspector-fields rp-structure-opening-facts">
				<dt>{{ tr('editor.structure.host') }}</dt>
				<dd data-rp-opening-property="host">{{ openingHostLabel }}</dd>
				<dt>{{ tr('renovation.target.room') }}</dt>
				<dd data-rp-opening-property="room-context">
					{{ openingRooms.length ? openingRooms.join(' / ') : tr('renovation.target.none') }}
				</dd>
				<dt>{{ tr('editor.structure.width') }}</dt>
				<dd data-rp-opening-property="width">{{ formatMetres(opening.width) }} m</dd>
				<dt>{{ tr('editor.structure.height') }}</dt>
				<dd data-rp-opening-property="height">{{ formatMetres(opening.height) }} m</dd>
				<dt>{{ tr('editor.structure.offset') }}</dt>
				<dd data-rp-opening-property="offset">{{ formatMetres(opening.offset) }} m</dd>
				<dt>{{ tr('editor.structure.sill') }}</dt>
				<dd data-rp-opening-property="sill">{{ formatMetres(opening.sill) }} m</dd>
				<template v-if="materials">
					<dt>{{ tr('renovation.product') }}</dt>
					<dd>{{ materials.existing ?? tr('renovation.material.none') }}</dd>
					<template v-if="materials.planned">
						<dt>{{ tr('editor.structure.planned-material') }}</dt>
						<dd>{{ materials.planned }}</dd>
					</template>
				</template>
			</dl>
		</template>
		<template v-else>
			<h3>{{ tr('editor.add.wall.label') }}</h3>
			<StructureFacts
				:wall="wall"
				:rooms="rooms"
				:materials="materials"
			/>
		</template>
		<StructureRenovationEntry v-if="session.perspective === 'renovate'" />
		<StructurePlanActions />
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
