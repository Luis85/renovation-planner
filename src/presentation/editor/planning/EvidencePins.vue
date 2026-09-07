<script setup lang="ts">
import type { ThemeTokens } from '../theme/themeTokens';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEvidencePins } from './evidencePins';
defineProps<{ tokens: ThemeTokens; zoom: number }>();
const runtime = useEditorRuntime(), session = useRenovationSession(), pins = useEvidencePins();
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
