<script setup lang="ts">
/**
 * One persisted Zone, drawn (SDD §16's last two steps).
 *
 * It takes a `ZoneRenderModel` and hands `<VLine>` the model's own vertices — still world
 * millimetres, only repacked into the flat array Konva's `points` wants (see
 * `flatPoints`). It does not take a `Viewport` and never calls `worldToScreen`: pan and
 * zoom are the layer's own transform, so a pan re-renders no vertex here at all.
 * `tests/presentation/editor/scene.test.ts` asserts that array's reference identity across
 * a pan, because the defect it guards against — someone reintroducing a per-vertex
 * conversion — is structural and invisible to anything that only checks what is on screen.
 *
 * Nothing here writes: not to `ProjectStore`, not to a repository, and not back onto the
 * Konva node it produced.
 */
import { computed } from 'vue';
import { tr } from '../../../i18n/strings';
import type { ThemeTokens } from '../../theme/themeTokens';
import { labelAnchor, statusAppearance, zoneFillToken, type ZoneRenderModel } from './ZoneRenderModel';

const props = defineProps<{
	model: ZoneRenderModel;
	tokens: ThemeTokens;
	/** Stage pixels per world millimetre — what a screen-sized caption divides by. */
	zoom: number;
}>();

/**
 * Konva's `points` is a FLAT `[x, y, x, y, …]` array, not a list of points — hand it
 * `Point[]` and it warns `"points" attribute has non numeric element [object Object]` per
 * vertex and draws nothing. The flattening therefore has to happen somewhere, and it
 * happens HERE rather than in `toZoneRenderModel` so the render model keeps the domain's
 * own shape: `ZoneRenderModel.points` is what a Zone's geometry looks like, and Konva's
 * packing is this adapter's business.
 *
 * A `computed` and not an inline expression, because DoD 5 turns on reference identity: a
 * pan must not rebuild this array. `props.model.points` does not change when the camera
 * moves, so the cache holds and `<VLine>` receives the same array it had before.
 */
const flatPoints = computed(() => props.model.points.flatMap((point) => [point.x, point.y]));

const appearance = computed(() => statusAppearance(props.model.status));
const fill = computed(() => props.tokens[zoneFillToken(props.model.zoneType)]);
const anchor = computed(() => labelAnchor(props.model.points));

/**
 * Captions are sized in SCREEN pixels but positioned in world millimetres, so their font
 * size is divided back out of the zoom the layer applies. Konva has no "constant size"
 * flag for a descendant of a scaled container; this is the arithmetic that stands in for
 * one, and it is why the component needs the zoom even though the geometry does not.
 *
 * **`offsetY` is in LOCAL units and must NOT be multiplied by the scale.** Konva applies
 * the offset inside the node's own scaled space, so a local offset of `n` displaces the
 * node by `n × captionScale` world millimetres — which is exactly `n` screen pixels. The
 * first version multiplied by `captionScale` as well, putting the caption
 * `n / zoom` × further out: at the default zoom of 0.1 that is ten times too far, and
 * every zone's name landed off the top of the pane. Invisible to jsdom, which draws
 * nothing; found in `npm run harness-shot`.
 */
const CAPTION_PX = 12;
const captionScale = computed(() => 1 / props.zoom);

const statusCaption = computed(() => tr(appearance.value.captionKey));
</script>

<template>
	<!--
		Two line nodes over one point array, rather than one node with both a fill and a
		stroke. Konva's `opacity` is per NODE, so a translucent fill on a single node would
		take the outline down with it — and the fill has to be translucent, because a zone
		sits over an imported plan the user still needs to see through it.
	-->
	<VLine
		:config="{
			points: flatPoints,
			closed: true,
			fill,
			opacity: 0.28,
			listening: false,
			perfectDrawEnabled: false,
		}"
	/>
	<VLine
		:config="{
			points: flatPoints,
			closed: true,
			stroke: props.tokens.zoneStroke,
			strokeWidth: 1.5,
			dash: appearance.dash,
			strokeScaleEnabled: false,
			listening: false,
			perfectDrawEnabled: false,
		}"
	/>
	<VText
		:config="{
			x: anchor.x,
			y: anchor.y,
			offsetY: CAPTION_PX * 2.2,
			text: props.model.label,
			fontSize: CAPTION_PX,
			fill: props.tokens.zoneLabel,
			scaleX: captionScale,
			scaleY: captionScale,
			listening: false,
		}"
	/>
	<VText
		:config="{
			x: anchor.x,
			y: anchor.y,
			offsetY: CAPTION_PX * 1.1,
			text: statusCaption,
			fontSize: CAPTION_PX * 0.85,
			fill: props.tokens.zoneCaption,
			scaleX: captionScale,
			scaleY: captionScale,
			listening: false,
		}"
	/>
</template>
