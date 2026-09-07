<script setup lang="ts">
import { inRenovationScope } from './renovationSummary';
import EvidencePins from '../planning/EvidencePins.vue';
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import type { NodeTransform } from '../viewport/Viewport';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { EMPTY_RENOVATION, orderedWork, reviewRenovation } from '../../../domain/renovation/Renovation';
import { openingPoints } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
const props = defineProps<{ tokens: ThemeTokens; transform: NodeTransform; zoom: number; visible: boolean }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const value = computed(() => project.plan?.renovation ?? EMPTY_RENOVATION);
const markers = computed(() => {
	if (session.perspective !== 'review' && !['existing', 'planned', 'work'].includes(session.mode)) return [];
	const records = session.perspective === 'review' ? reviewRenovation(value.value).map(item => ({ id: item.recordId, roomId: item.roomId, label: tr(`renovation.finding.${item.kind}`) }))
		: session.mode === 'work' ? orderedWork(value.value).filter(item => inRenovationScope(item, session.roomId, session.targetId)).map(item => ({ ...item, label: item.title }))
			: value.value.subjects.filter(item => inRenovationScope(item, session.roomId, session.targetId) && item[session.mode === 'existing' ? 'existing' : 'planned']).map(item => ({ ...item, label: session.mode === 'existing' ? item.existing?.description : `${item.planned ? tr(`renovation.change.${item.planned.change}`) : ''} ${item.planned?.description || item.existing?.description}` }));
	// Each room stacks its own markers from its own top: the review list spans every room,
	// and a floor-wide index put a later room's first marker rows below it (a Codex P2 on #87).
	const rows = new Map<string, number>();
	return records.flatMap(item => {
		const room = project.zones.get(item.roomId);
		if (!room?.points.length) return [];
		const row = rows.get(item.roomId) ?? 0;
		rows.set(item.roomId, row + 1);
		const left = Math.min(...room.points.map(point => point.x)), top = Math.min(...room.points.map(point => point.y));
		return [{ ...item, text: `${row + 1}. ${item.label}`, x: left + 20 / props.zoom, y: top + (30 + row * 26) / props.zoom }];
	});
});
const comparisons = computed(() => value.value.subjects.flatMap(item => {
	if (!item.planned) return [];
	const structure = item.planned.change === 'remove' ? project.structure : project.intended ?? project.structure;
	const wall = structure.walls.find(candidate => candidate.id === item.targetId), opening = structure.openings.find(candidate => candidate.id === item.targetId);
	const element = structure.elements?.find(candidate => candidate.id === item.targetId);
	const points = wall ? [wall.start, wall.end] : opening ? openingPoints(opening, structure.walls) : element?.points ?? [];
	return points.length ? [{ id: item.id, closed: element?.kind === 'object', points: points.flatMap(point => [point.x, point.y]), x: points[0].x, y: points[0].y, label: tr(`renovation.change.${item.planned.change}`), remove: item.planned.change === 'remove' }] : [];
}));
function focus(roomId: string, id: string): void {
	const issue = session.perspective === 'review' ? reviewRenovation(value.value).find(item => item.recordId === id) : undefined;
	const mode = issue ? (issue.kind === 'blocked' || issue.kind === 'missing-outcome' ? 'work' : 'planned') : session.mode;
	runtime.renovation.focus(roomId, mode, id);
	if (issue?.kind === 'decision') void runtime.renovation.edit('decision', roomId, id);
}
</script>
<template>
	<VLayer :config="{ name: 'annotation', listening: session.perspective !== 'plan', visible, ...transform }">
		<VGroup :config="{ name: 'renovation', visible: session.visible && session.perspective !== 'plan' }">
			<EvidencePins
				:tokens="tokens"
				:zoom="zoom"
			/>
			<VGroup
				v-for="item in comparisons"
				:key="item.id"
				:config="{ listening: false }"
			>
				<VLine :config="{ points: item.points, closed: item.closed, stroke: tokens.accent, strokeWidth: 5 / zoom, dash: item.remove ? [3 / zoom, 6 / zoom] : [12 / zoom, 4 / zoom] }" />
				<VText :config="{ x: item.x, y: item.y - 18 / zoom, text: item.label, fontSize: 14 / zoom, fill: tokens.zoneStroke }" />
			</VGroup>
			<VGroup
				v-for="(item, index) in markers"
				:key="`${item.id}:${index}`"
				:config="{ name: 'renovation-marker', x: item.x, y: item.y, onClick: () => focus(item.roomId, item.id), onTap: () => focus(item.roomId, item.id) }"
			>
				<VRect :config="{ width: 190 / zoom, height: 24 / zoom, fill: tokens.canvasBackground, stroke: session.focusedId === item.id ? tokens.accent : tokens.zoneStroke, strokeWidth: 1 / zoom }" />
				<VText :config="{ x: 5 / zoom, y: 4 / zoom, width: 180 / zoom, height: 18 / zoom, ellipsis: true, wrap: 'none', text: item.text, fontSize: 13 / zoom, fill: tokens.zoneLabel }" />
			</VGroup>
		</VGroup>
	</VLayer>
</template>
