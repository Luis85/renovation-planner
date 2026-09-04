<script setup lang="ts">
/**
 * The room draft's outline (design spec §2.2) — dashed, with its width and depth labelled
 * beside the two edges they describe.
 *
 * **Reads `useRoomDraftStore()` directly rather than `RenderState`, a deliberate deviation
 * from the rest of this layer's transient visuals.** Every other in-progress gesture here
 * (`polygonSketch`, `measurement`, `previewPolygon`) is a tool's own field on `RenderState`,
 * because a tool is the only writer and the layer only ever reads. The room draft is written
 * from TWO surfaces instead — the canvas drag (`DrawRoomTool`) and the Inspector's two
 * numeric fields (`NewRoomInspector.vue`, through `commitDimension`) — and both already
 * converge on `useRoomDraftStore().rect` (spec §2.2). Routing that through `RenderState` as
 * well would be a second place the two surfaces have to agree, for no reader this layer has
 * that `RenderState` does not already serve. It writes nothing and dispatches nothing.
 */
import { computed } from 'vue';
import { useRoomDraftStore } from '../add/room-draft-store';
import { formatMetres } from '../shell/formatLength';
import type { ThemeTokens } from '../theme/themeTokens';
import type { Point } from '../../../core/geometry/Point';
import type { ScreenPoint } from '../viewport/Viewport';

const props = defineProps<{
	tokens: ThemeTokens;
	toScreen: (point: Point) => ScreenPoint;
}>();

const draft = useRoomDraftStore();

/**
 * The unit the two edge labels carry, appended as `` `${formatMetres(…)} ${METRES}` ``.
 *
 * A bare glyph rather than a `StringKey`, the same exemption `NewRoomInspector`'s `NO_FIGURE`
 * takes and for the same reason: `m` is the SI symbol for a metre, identical in English and
 * German (and in every locale this plugin could ship), so a key for it would be one more entry
 * two translators have to keep saying the same thing. `I18N_LITERAL_BAN` cannot see it either
 * way — a Konva `text:` config is none of the six call sites that rule matches — so this is a
 * decision recorded at the code rather than one a gate is keeping.
 *
 * **The trigger is the per-plan units PBI**, which `shell/formatLength.ts` already names as
 * what replaces `formatMetres` and `formatArea` in one edit: the moment a plan can be in feet,
 * the unit stops being a constant and becomes a fact about the plan — at which point it comes
 * from the same place the FORMATTING does, not from a key and not from here.
 */
const METRES = 'm';

interface RoomDraftLabel {
	readonly x: number;
	readonly y: number;
	readonly text: string;
}

interface RoomDraftGeometry {
	readonly outlineFlat: readonly number[];
	readonly widthLabel: RoomDraftLabel;
	readonly depthLabel: RoomDraftLabel;
}

/**
 * The four corners, in the same clockwise-from-min-corner order `polygonForRect` in the
 * store builds them (top-left, top-right, bottom-right, bottom-left) — so a screen point at
 * index N here corresponds to the same corner a committed Zone's own geometry would carry.
 *
 * The width label sits centred above the top edge (`y - 14`, screen pixels — this layer is
 * screen-space throughout, like every other node here); the depth label sits beside the
 * right edge, offset outward by 8. Both stay upright rather than rotating with their edge,
 * per spec §2.2.
 */
const geometry = computed<RoomDraftGeometry | null>(() => {
	const rect = draft.rect;
	if (rect === null) return null;
	const topLeft = props.toScreen({ x: rect.x, y: rect.y });
	const topRight = props.toScreen({ x: rect.x + rect.width, y: rect.y });
	const bottomRight = props.toScreen({ x: rect.x + rect.width, y: rect.y + rect.depth });
	const bottomLeft = props.toScreen({ x: rect.x, y: rect.y + rect.depth });
	return {
		outlineFlat: [
			topLeft.x, topLeft.y,
			topRight.x, topRight.y,
			bottomRight.x, bottomRight.y,
			bottomLeft.x, bottomLeft.y,
		],
		widthLabel: {
			x: (topLeft.x + topRight.x) / 2,
			y: topLeft.y - 14,
			text: `${formatMetres(rect.width)} ${METRES}`,
		},
		depthLabel: {
			x: topRight.x + 8,
			y: (topRight.y + bottomRight.y) / 2,
			text: `${formatMetres(rect.depth)} ${METRES}`,
		},
	};
});
</script>

<template>
	<template v-if="geometry !== null">
		<VLine
			:config="{
				name: 'room-draft',
				points: geometry.outlineFlat,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				dash: [4, 4],
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
		<VText
			:config="{
				name: 'room-draft-label',
				text: geometry.widthLabel.text,
				x: geometry.widthLabel.x,
				y: geometry.widthLabel.y,
				fontSize: 12,
				fill: props.tokens.zoneLabel,
				listening: false,
			}"
		/>
		<VText
			:config="{
				name: 'room-draft-label',
				text: geometry.depthLabel.text,
				x: geometry.depthLabel.x,
				y: geometry.depthLabel.y,
				fontSize: 12,
				fill: props.tokens.zoneLabel,
				listening: false,
			}"
		/>
	</template>
</template>
