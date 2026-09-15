<script setup lang="ts">
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import type { wallFaceCue } from './wallFaceCue';
defineProps<{ cue: ReturnType<typeof wallFaceCue>; tokens: ThemeTokens; zoom: number }>();
const points = (value: readonly Point[]): number[] => value.flatMap(point => [point.x, point.y]);
</script>
<template>
	<VGroup
		v-if="cue"
		:config="{ name: 'wall-face-cue' }"
	>
		<VLine
			v-for="(face, index) in cue.faces"
			:key="index"
			:config="{ points: points(face), stroke: tokens.accent, strokeWidth: 3 / zoom, lineCap: 'round' }"
		/>
		<VLine :config="{ points: points(cue.arrow), stroke: tokens.accent, strokeWidth: 2 / zoom, lineCap: 'round', lineJoin: 'round' }" />
	</VGroup>
</template>
