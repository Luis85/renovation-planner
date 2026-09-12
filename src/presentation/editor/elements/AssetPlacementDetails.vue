<script setup lang="ts">
import { computed } from 'vue';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { membershipProbe } from '../../../domain/spatial/assetPlacement';
import { contains } from '../../../core/geometry/operations';
import type { AssetShapeAnswer } from '../../read-models/assetShapes';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { usePlanningContext } from '../planning/planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { formatMetres } from '../shell/formatLength';
const props = defineProps<{ element: SpatialElement }>();
const project = useProjectStore(), shapes = useAssetShapeStore(), context = usePlanEditorContext(), runtime = useEditorRuntime(), planning = usePlanningContext(), session = useRenovationSession();
const assetId = computed(() => props.element.assetId ?? '');
const answer = computed(() => shapes.answerFor(assetId.value));
const REASONS: Readonly<Record<Exclude<AssetShapeAnswer['kind'], 'placeable'>, StringKey>> = { missing: 'editor.asset.missing', unreadable: 'editor.asset.unreadable', 'no-shape': 'editor.asset.no-shape', unscaled: 'editor.asset.unscaled' };
const summary = computed(() => {
	const value = answer.value;
	if (value === null) return '';
	return value.kind === 'placeable' ? tr('editor.asset.dimensions', { width: formatMetres(value.dimensions.width), depth: formatMetres(value.dimensions.depth) }) : tr(REASONS[value.kind]);
});
const room = computed(() => [...project.zones.values()].find(zone => { if (zone.zoneType !== 'Room') return false; const inside = contains(zone, membershipProbe(props.element)); return inside.ok && inside.value; }));
const canAddMaterial = computed(() => runtime.renovation.available && room.value !== undefined && planning.baseline.value !== null
	&& !planning.baseline.value.materials.some(({ entity }) => entity.assetId === assetId.value && entity.origin.zoneId === room.value?.id && entity.source?.rule === 'placement-count'));
async function addMaterial(): Promise<void> {
	if (!room.value) return;
	session.roomId = room.value.id; session.targetId = room.value.id; session.focusedId = '';
	await planning.edit('material', '', { assetId: assetId.value, rule: 'placement-count' });
}
function openDesigner(): void { void context.navigation?.asset?.(assetId.value); }
</script>
<template>
	<p>{{ summary }}</p>
	<div class="rp-dialog-actions">
		<button
			v-if="context.navigation?.asset && answer?.kind !== 'missing'"
			type="button"
			data-rp-action="open-asset-designer"
			@click="openDesigner"
		>
			{{ tr('editor.asset.open-designer') }}
		</button>
		<button
			type="button"
			data-rp-action="replace-asset"
			:aria-disabled="runtime.elementTask.assets.blocked.value"
			@click="runtime.elementTask.assets.replace(element.id, runtime.assetOptions.value)"
		>
			{{ tr('editor.asset.replace') }}
		</button>
		<button
			v-if="canAddMaterial"
			type="button"
			data-rp-action="add-asset-material"
			@click="addMaterial"
		>
			{{ tr('editor.asset.add-material') }}
		</button>
	</div>
</template>
