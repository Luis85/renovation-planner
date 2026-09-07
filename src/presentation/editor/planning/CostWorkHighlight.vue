<script setup lang="ts">
import { computed } from 'vue';
import { spatialContexts } from '../../../domain/renovation/SharedLinks';
import { useProjectStore } from '../../stores/ProjectStore';
import { useRenovationSession } from '../renovation/renovationSession';
import { inRenovationScope } from '../renovation/renovationSummary';
import { structureRecords } from '../structure/structureRecords';
import type { ThemeTokens } from '../theme/themeTokens';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const project = useProjectStore(), session = useRenovationSession();
const outlines = computed(() => {
	if (session.perspective !== 'renovate' || session.mode !== 'costs') return [];
	if (!project.plan?.renovation) return [];
	const work = project.plan.renovation.work.find(item => item.id === session.focusedId);
	if (!work) return [];
	const records = structureRecords(project.structure, project.plan.id);
	const intended = structureRecords(project.intended ?? project.structure, project.plan.id);
	// Work has no measurement-state authority: show current targets, with intended-only additions as a fallback.
	const geometry = new Map([...intended, ...records, ...project.zones.values()].map(item => [item.id, item]));
	const targets = new Set(spatialContexts(work).filter(item => inRenovationScope(item, session.roomId, session.targetId)).map(item => item.targetId));
	return [...targets].flatMap(id => {
		const target = geometry.get(id);
		return target?.points.length ? [{ id, points: target.points.flatMap(point => [point.x, point.y]), closed: project.zones.has(id) || target.zoneType === 'object' }] : [];
	});
});
</script>
<template>
	<VLine
		v-for="item in outlines"
		:key="item.id"
		:config="{ name: 'cost-work-source', id: item.id, points: item.points, closed: item.closed, stroke: tokens.accent, strokeWidth: 4 / zoom, listening: false }"
	/>
</template>
