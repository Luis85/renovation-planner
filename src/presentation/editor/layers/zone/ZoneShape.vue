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
 *
 * **The single `<VGroup>` root, always mounted, is what makes `ZoneLayer`'s `v-for` order the
 * PAINT order** — a correctness requirement rather than a wrapper, and the same one
 * `RoomDraftSketch.vue` (its docblock carries the full measurement) arrived at. vue-konva
 * orders a layer's children by walking the LAYER's subtree and resolving each vnode to a
 * Konva node, then `setZIndex`ing them in that order; a component whose root is a FRAGMENT —
 * four siblings, as this template was — resolves to `null`, so its nodes never enter the
 * ordering array and keep the position they were first appended at. Paint order was
 * therefore MOUNT order, while `ProjectStore.zones` is rebuilt as a fresh Map on every
 * hydrate: reorder the zones in the vault and the picture kept the old stacking, silently,
 * for overlapping zones. `tests/presentation/editor/zoneLayerOrder.test.ts` holds it.
 *
 * Two constraints on the group, both inherited from that measurement. It carries no `v-if`,
 * because the reindex runs on the LAYER's update and a group created later is appended after
 * that pass has already run. And it is an IDENTITY transform — no `x`, `y`, `scale` — so the
 * world millimetres below reach Konva unchanged, which is what `scene.test.ts`'s `flatPoints`
 * identity case reads. `listening: false` matches all four children and the layer above them
 * (SDD §62); Konva resolves hit-testing by walking a node's ANCESTORS, so a listening group
 * would be needed here the day any of them takes pointer events.
 */
import { computed } from 'vue';
import type { ThemeTokens } from '../../theme/themeTokens';
import { labelAnchor, zoneFillToken, type ZoneRenderModel } from './ZoneRenderModel';
import { formatArea } from '../../shell/formatArea';
import { captionOffsetY, type NumberedPin } from './captionPlacement';
import type { BoundingBox } from '../../../../core/geometry/BoundingBox';
import { polygonPolyline } from '../../../../core/geometry/curvePolyline';

const props = defineProps<{
	model: ZoneRenderModel;
	tokens: ThemeTokens;
	/** Stage pixels per world millimetre — what a screen-sized caption divides by. */
	zoom: number;
	selected: boolean;
	pins: readonly NumberedPin[];
	dimensionObstacles: readonly BoundingBox[];
	captionViewport: BoundingBox | null;
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
const flatPoints = computed(() => {
	const points = props.model.bulges?.some(value => value !== 0) ? polygonPolyline(props.model, 0.25 / props.zoom) : props.model.points;
	return points.flatMap((point) => [point.x, point.y]);
});

const fill = computed(() => props.tokens[zoneFillToken(props.model.zoneType)]);
const anchor = computed(() => labelAnchor(props.model.points, props.model.bulges));

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
const CAPTION_PX = 14;
const captionScale = computed(() => 1 / props.zoom);
// Viewport/obstacle movement often leaves a caption in the same place. Propagate only a
// changed displacement, so vue-konva does not diff six unchanged configs for every Room.
const captionDisplacement = computed(() => captionOffsetY(anchor.value, props.pins, props.zoom, props.dimensionObstacles, props.captionViewport));
const captionLayout = computed(() => ({ x: anchor.value.x, y: anchor.value.y + captionDisplacement.value, width: 180, offsetX: 90, align: 'center',
	scaleX: captionScale.value, scaleY: captionScale.value, listening: false, wrap: 'none', ellipsis: true,
	stroke: props.tokens.canvasBackground, strokeWidth: 2, fillAfterStrokeEnabled: true }));

const groupConfig = computed(() => ({ name: props.model.id, listening: false }));
// Invisible at rest and translucent when selected: M01 draws no resting fill, and the node
// stays MOUNTED at zero opacity because `ZoneLayer`'s paint order and `scene.test.ts`'s
// `flatPoints` identity case both rest on this group's child list keeping its shape.
const fillConfig = computed(() => ({ points: flatPoints.value, closed: true, fill: fill.value,
	opacity: props.selected ? 0.12 : 0, listening: false, perfectDrawEnabled: false }));
const outlineConfig = computed(() => ({ points: flatPoints.value, closed: true, stroke: props.tokens.zoneStroke,
	strokeWidth: 1, strokeScaleEnabled: false, listening: false, perfectDrawEnabled: false }));
const nameConfig = computed(() => ({ ...captionLayout.value, offsetY: CAPTION_PX * 1.6,
	text: props.model.label, fontSize: CAPTION_PX + 2, fontStyle: 'bold', height: CAPTION_PX + 5, fill: props.tokens.zoneLabel }));
const areaConfig = computed(() => ({ ...captionLayout.value, offsetY: 0,
	text: formatArea(props.model.areaMm2), fontSize: CAPTION_PX, fill: props.tokens.zoneLabel }));
</script>

<template>
	<VGroup
		v-memo="[groupConfig, fillConfig, outlineConfig, nameConfig, areaConfig]"
		:config="groupConfig"
	>
		<!--
			Two line nodes over one point array, rather than one node with both a fill and a
			stroke. Konva's `opacity` is per NODE, so a translucent fill on a single node would
			take the outline down with it — and the fill is translucent when selected and
			invisible otherwise, since a zone sits over an imported plan the user still needs
			to see through it and M01 draws no resting fill at all.
		-->
		<VLine :config="fillConfig" />
		<VLine :config="outlineConfig" />
		<VText :config="nameConfig" />
		<VText :config="areaConfig" />
	</VGroup>
</template>
