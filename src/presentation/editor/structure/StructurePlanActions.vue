<script setup lang="ts">
import { nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useOpeningMoveAction } from './useOpeningMoveAction';
import ObjectRotationControls from '../elements/ObjectRotationControls.vue';
import CurveAction from '../curves/CurveAction.vue';
import StructureRenovationEntry from './StructureRenovationEntry.vue';
import HostIcon from '../../components/HostIcon.vue';
import { useStructureInspectorTarget } from './useStructureInspectorTarget';

const moveOpening = useOpeningMoveAction();
const { runtime, session, id, wall, opening, paused } = useStructureInspectorTarget();

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
