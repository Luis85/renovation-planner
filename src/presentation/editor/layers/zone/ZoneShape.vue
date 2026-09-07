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
import { tr } from '../../../i18n/strings';
import type { ThemeTokens } from '../../theme/themeTokens';
import { labelAnchor, statusAppearance, zoneFillToken, type ZoneRenderModel } from './ZoneRenderModel';
import { formatArea } from '../../shell/formatArea';

const props = defineProps<{
	model: ZoneRenderModel;
	tokens: ThemeTokens;
	/** Stage pixels per world millimetre — what a screen-sized caption divides by. */
	zoom: number;
	selected: boolean;
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
const CAPTION_PX = 14;
const captionScale = computed(() => 1 / props.zoom);
const captionLayout = computed(() => ({ x: anchor.value.x, y: anchor.value.y, width: 180, offsetX: 90, align: 'center',
	scaleX: captionScale.value, scaleY: captionScale.value, listening: false, wrap: 'none', ellipsis: true,
	stroke: props.tokens.canvasBackground, strokeWidth: 2, fillAfterStrokeEnabled: true }));

const statusCaption = computed(() => tr(appearance.value.captionKey));
</script>

<template>
	<VGroup :config="{ name: props.model.id, listening: false }">
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
				opacity: props.selected ? 0.12 : 0.025,
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
				...captionLayout,
				offsetY: CAPTION_PX * 1.6,
				text: props.model.label,
				fontSize: CAPTION_PX + 2,
				fontStyle: 'bold',
				height: CAPTION_PX + 5,
				fill: props.tokens.zoneLabel,
			}"
		/>
		<VText :config="{ ...captionLayout, offsetY: 0, text: formatArea(props.model.areaMm2), fontSize: CAPTION_PX, fill: props.tokens.zoneLabel }" />
		<VText
			:config="{
				...captionLayout,
				offsetY: -CAPTION_PX * 1.3,
				text: statusCaption,
				fontSize: CAPTION_PX * 0.85,
				fill: props.tokens.zoneCaption,
			}"
		/>
	</VGroup>
</template>
