<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import type { ShapeLookup } from './elementFootprint';
import { assetShapeConfig } from './assetShapeConfig';
const props = defineProps<{ placements: readonly NamedSpatialElement[]; shapeOf: ShapeLookup; selectedIds: readonly string[]; hoveredId: string | null; tokens: ThemeTokens; zoom: number }>();
const shapes = computed(() => props.placements.map(element => assetShapeConfig(element, props.shapeOf,
	{ selected: props.selectedIds.includes(element.id), hovered: props.hoveredId === element.id, tokens: props.tokens, zoom: props.zoom })));
</script>
<template>
	<VGroup>
		<VGroup
			v-for="shape in shapes"
			:key="shape.id"
			:config="{ name: 'element-asset ' + shape.id }"
		>
			<VLine
				v-if="shape.clearance"
				:config="shape.clearance"
			/>
			<VLine :config="shape.footprint" />
			<template v-if="shape.cross">
				<VLine
					v-for="(line, index) in shape.cross"
					:key="index"
					:config="{ name: 'asset-placeholder-cross', points: line, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom }"
				/>
			</template>
			<VLine :config="shape.tick" />
			<VText :config="shape.label" />
		</VGroup>
	</VGroup>
</template>
