<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { inRenovationScope } from '../renovation/renovationSummary';
import { structureRecords } from '../structure/structureRecords';
import { spatialOutlinePoints } from '../selection/spatialOutlinePoints';
import { boundingBoxOf } from '../../../core/geometry/operations';
const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const markers = computed(() => {
 if (session.perspective !== 'renovate' || session.mode !== 'materials') return [];
 const materials = runtime.planning.baseline.value?.materials ?? [];
 const current = structureRecords(project.structure, project.plan?.id ?? ''), intended = structureRecords(project.intended ?? project.structure, project.plan?.id ?? '');
 const geometry = (records: typeof current) => new Map([...project.zones.values(), ...records].map(item => [item.id, item]));
 const currentPoints = geometry(current), intendedPoints = geometry(intended);
 const rows = materials.filter(({ entity }) => inRenovationScope({ roomId: entity.origin.zoneId, targetId: entity.source?.targetId ?? entity.origin.zoneId }, session.roomId, session.targetId));
 const offsets = new Map<string, number>();
 return rows.flatMap(({ entity }, index) => {
  const targetId = entity.source?.targetId ?? entity.origin.zoneId, target = (entity.source?.state === 'intended' ? intendedPoints : currentPoints).get(targetId);
  if (!target?.points.length) return [];
  const shape = { ...target, kind: 'kind' in target ? target.kind === 'room' || target.kind === 'area' ? undefined : target.kind : undefined };
  const points = spatialOutlinePoints(shape, 0.25 / props.zoom), box = boundingBoxOf(target);
  if (!box.ok) return [];
  const offset = offsets.get(targetId) ?? 0; offsets.set(targetId, offset + 1);
  return [{ id: entity.id, roomId: entity.origin.zoneId, number: index + 1,
   x: box.value.min.x + (22 + offset * 34) / props.zoom,
   y: box.value.min.y + 22 / props.zoom,
   points: points.flatMap(point => [point.x, point.y]), closed: project.zones.has(targetId) || (entity.source?.state === 'intended' ? intended : current).some(item => item.id === targetId && item.kind === 'object') }];
 });
});
</script>
<template>
	<VGroup
		v-for="item in markers"
		:key="item.id"
	>
		<VLine
			v-if="session.focusedId === item.id"
			:config="{ name: 'material-source', points: item.points, closed: item.closed, stroke: tokens.accent, strokeWidth: 4 / zoom, listening: false }"
		/>
		<VGroup :config="{ name: 'material-marker', id: item.id, x: item.x, y: item.y, onClick: () => runtime.renovation.focus(item.roomId, 'materials', item.id), onTap: () => runtime.renovation.focus(item.roomId, 'materials', item.id) }">
			<VCircle :config="{ radius: 14 / zoom, fill: tokens.canvasBackground, stroke: session.focusedId === item.id ? tokens.accent : tokens.zoneStroke, strokeWidth: 2 / zoom }" />
			<VText :config="{ x: -9 / zoom, y: -7 / zoom, width: 18 / zoom, align: 'center', text: String(item.number), fontSize: 14 / zoom, fill: tokens.zoneLabel }" />
		</VGroup>
	</VGroup>
</template>
