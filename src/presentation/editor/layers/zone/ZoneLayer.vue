<script setup lang="ts">
/**
 * The Zone layer — this slice's main content.
 *
 * It iterates `ProjectStore.zones` and renders one `ZoneShape` per entry, **keyed by
 * `zone.id`** and never by array index or Konva instance identity, so Vue's
 * reconciliation stays correct when the zone list changes shape in slice 6.
 *
 * The layer, not a shape, carries the viewport transform — see `viewportTransform`.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../../stores/ProjectStore';
import type { ThemeTokens } from '../../theme/themeTokens';
import type { NodeTransform } from '../../viewport/Viewport';
import { toZoneRenderModel } from './ZoneRenderModel';
import ZoneShape from './ZoneShape.vue';

const props = defineProps<{
	transform: NodeTransform;
	tokens: ThemeTokens;
	visible: boolean;
	zoom: number;
}>();

const { zones } = storeToRefs(useProjectStore());

const models = computed(() => [...zones.value.values()].map((zone) => toZoneRenderModel(zone)));
</script>

<template>
	<VLayer
		:config="{
			name: 'zone',
			listening: false,
			visible: props.visible,
			...props.transform,
		}"
	>
		<ZoneShape
			v-for="model in models"
			:key="model.id"
			:model="model"
			:tokens="props.tokens"
			:zoom="props.zoom"
		/>
	</VLayer>
</template>
