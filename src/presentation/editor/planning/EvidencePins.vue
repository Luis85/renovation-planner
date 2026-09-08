<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const pins = computed(() => {
	if (!['documents', 'photos', 'notes'].includes(session.mode) || session.perspective !== 'renovate') return [];
	const type = session.mode === 'photos' ? 'photo' : session.mode === 'notes' ? 'note' : 'document';
	const rows = (project.plan?.renovation?.depth?.evidence ?? []).filter(item => item.roomId === session.roomId && item.type === type && (!session.evidencePhase || item.phase === session.evidencePhase));
	return rows.flatMap((item, index) => {
		const room = project.zones.get(item.roomId);
		if (!item.pin || !room?.points.length) return [];
		const xs = room.points.map(point => point.x), ys = room.points.map(point => point.y);
		return [{ ...item, number: index + 1, x: Math.min(...xs) + item.pin.x * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + item.pin.y * (Math.max(...ys) - Math.min(...ys)) }];
	});
});
</script>
<template>
	<VGroup
		v-for="item in pins"
		:key="item.id"
		:config="{ name: 'evidence-pin', x: item.x, y: item.y, onClick: () => runtime.renovation.focus(item.roomId, session.mode, item.id), onTap: () => runtime.renovation.focus(item.roomId, session.mode, item.id) }"
	>
		<VCircle :config="{ radius: 14 / zoom, fill: tokens.canvasBackground, stroke: session.focusedId === item.id ? tokens.accent : tokens.zoneStroke, strokeWidth: 2 / zoom }" />
		<VText :config="{ x: -8 / zoom, y: -7 / zoom, text: String(item.number), fontSize: 14 / zoom, fill: tokens.zoneLabel }" />
	</VGroup>
</template>
