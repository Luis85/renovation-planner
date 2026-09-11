<script setup lang="ts">
/**
 * The parent zone's outline on a detail plan (ADR-0028): dashed, labelled, never a hit candidate,
 * never listed, never saved into this plan, and derived from the parent on every hierarchy read,
 * so recalibrating this plan does not move it. Mounted inside the background layer, so it hides
 * with the reference and adds no eighth layer to §17's seven.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import type { ThemeTokens } from '../theme/themeTokens';
import { guideOutline } from './parentZoneGuide';

const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const CAPTION_PX = 14;

const outline = computed(() => (hierarchy.value.parentZone === null ? null : guideOutline(hierarchy.value.parentZone)));
const line = computed(() => outline.value === null ? null : {
	name: 'parent-zone-guide',
	points: polygonPolyline(outline.value, 0.25 / props.zoom).flatMap((point) => [point.x, point.y]),
	closed: true,
	stroke: props.tokens.zoneStroke,
	strokeWidth: 1.5,
	dash: [8, 6],
	strokeScaleEnabled: false,
	listening: false,
});
const caption = computed(() => outline.value === null ? null : {
	name: 'parent-zone-guide-caption',
	x: 0,
	y: 0,
	offsetY: CAPTION_PX * 1.4,
	scaleX: 1 / props.zoom,
	scaleY: 1 / props.zoom,
	text: outline.value.name,
	fontSize: CAPTION_PX,
	fill: props.tokens.zoneCaption,
	listening: false,
});
</script>

<template>
	<VGroup :config="{ name: 'parent-zone-guide-group', listening: false }">
		<VLine
			v-if="line"
			:config="line"
		/>
		<VText
			v-if="caption"
			:config="caption"
		/>
	</VGroup>
</template>
