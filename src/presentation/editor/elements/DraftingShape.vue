<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import { patternTile } from '../structure/patternTile';
import { draftingMarks } from './draftingMarks';
const props = defineProps<{ element: NamedSpatialElement; selected: boolean; tokens: ThemeTokens; zoom: number }>();
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
/** The cross-hatch is the stone tile's two diagonals in theme colours (plan drafting tools design §6). */
const tile = computed(() => props.element.kind === 'hatch' ? patternTile('stone', props.tokens.zoneStroke, props.tokens.canvasBackground) : null);
function fillOf(fill: 'solid' | 'pattern' | undefined) {
	if (fill === 'solid') return { fill: stroke.value };
	return fill === 'pattern' && tile.value ? { fillPatternImage: tile.value, fillPatternRepeat: 'repeat', fillPatternScale: { x: 1 / props.zoom, y: 1 / props.zoom } } : {};
}
/** Configs only, in script: the template stays one flat loop per node type for fallow's template complexity budget. */
const marks = computed(() => {
	const drawn = draftingMarks(props.element, props.zoom), weight = props.selected ? 2 : 1;
	return {
		lines: drawn.lines.map(line => ({ name: line.name, points: line.points, closed: line.closed === true, dash: line.dash ?? [], stroke: stroke.value, strokeWidth: line.strokeWidth * weight, listening: false, ...fillOf(line.fill) })),
		circles: drawn.circles.map(circle => ({ ...circle, stroke: stroke.value, strokeWidth: circle.strokeWidth * weight, listening: false })),
		texts: drawn.texts.map(item => ({ ...item, fill: props.selected ? props.tokens.accent : props.tokens.zoneLabel, align: 'center', listening: false, wrap: 'none' })),
	};
});
</script>
<template>
	<VGroup :config="{ name: 'drafting-shape', listening: false }">
		<VLine
			v-for="(line, index) in marks.lines"
			:key="'line-' + index"
			:config="line"
		/>
		<VCircle
			v-for="(circle, index) in marks.circles"
			:key="'circle-' + index"
			:config="circle"
		/>
		<VText
			v-for="(item, index) in marks.texts"
			:key="'text-' + index"
			:config="item"
		/>
	</VGroup>
</template>
