<script setup lang="ts">
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { elementLength } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import { formatMetres } from '../shell/formatLength';
defineProps<{ elements: readonly NamedSpatialElement[]; selectedIds: readonly string[]; tokens: ThemeTokens; zoom: number }>();
</script>
<template>
	<VGroup>
		<VGroup
			v-for="element in elements"
			:key="element.id"
			:config="{ name: `element-${element.kind}` }"
		>
			<VLine :config="{ points: element.points.flatMap(point => [point.x, point.y]), closed: element.kind === 'object', stroke: selectedIds.includes(element.id) ? tokens.accent : tokens.zoneStroke, strokeWidth: (selectedIds.includes(element.id) ? 3 : 2) / zoom, dash: element.kind === 'fence' ? [4 / zoom, 4 / zoom] : [], fill: element.kind === 'object' ? tokens.canvasBackground : undefined }" />
			<VText
				v-if="element.points[0]"
				:config="{ x: element.points[0].x, y: element.points[0].y - 18 / zoom, text: element.kind === 'measurement' ? `${element.name} · ${formatMetres(elementLength(element))} m` : element.name, fontSize: 12 / zoom, fill: tokens.zoneLabel, listening: false }"
			/>
		</VGroup>
	</VGroup>
</template>
