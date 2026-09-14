<script setup lang="ts">
import { computed } from 'vue';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { elementLength, pointKind } from '../../../domain/spatial/SpatialElement';
import { postSection } from '../../../domain/spatial/structuralElement';
import { area } from '../../../core/geometry/operations';
import { formatArea } from '../shell/formatArea';
import { formatMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
import AssetPlacementDetails from './AssetPlacementDetails.vue';
const props = defineProps<{ element: SpatialElement }>();
const measuredArea = computed(() => area({ points: props.element.points }));
/** The stair line, in its own component: fallow scores template cognitive complexity, and this ternary sat nested two conditionals deep. */
const stairSummary = computed(() => {
	const { element } = props, stair = element.stair;
	if (element.kind !== 'stair' || !stair) return null;
	return tr('editor.stair.summary', { width: formatMetres(stair.width), run: formatMetres(elementLength(element)), treads: String(stair.treads), direction: tr(stair.direction === 'up' ? 'editor.stair.up' : 'editor.stair.down') });
});
/** Section or length and width for a post or beam, in metres like every other inspector measure. */
const structuralSummary = computed(() => {
	const value = props.element;
	if (value.kind === 'beam' && value.width) return tr('editor.structural.beam-summary', { length: formatMetres(elementLength(value)), width: formatMetres(value.width) });
	const section = value.kind === 'post' ? postSection(value.points) : null;
	return section ? tr('editor.structural.post-summary', { width: formatMetres(section.width), depth: formatMetres(section.depth) }) : null;
});
/** One template branch for both measured summaries. */
const summary = computed(() => stairSummary.value ?? structuralSummary.value);
const showLength = computed(() => !pointKind(props.element.kind));
</script>
<template>
	<p
		v-if="element.kind === 'object' && measuredArea.ok"
		class="rp-inspector-subline"
	>
		{{ formatArea(measuredArea.value) }}
	</p>
	<p
		v-else-if="summary"
		class="rp-inspector-subline"
	>
		{{ summary }}
	</p>
	<AssetPlacementDetails
		v-else-if="element.kind === 'asset'"
		:element="element"
	/>
	<p
		v-else-if="showLength"
		class="rp-inspector-subline"
	>
		{{ formatMetres(elementLength(element)) }} m
	</p>
</template>
