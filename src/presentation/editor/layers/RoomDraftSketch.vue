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
 *
 * **The template's ONE `<VGroup>` root, always mounted, is a correctness requirement rather
 * than a wrapper — and it took two separate measurements to arrive at, because the obvious
 * half of it is not the half that bites.** vue-konva orders a layer's children by walking the
 * LAYER's own subtree and resolving each vnode to a Konva node (`I`/`B`/`R`, `vue-konva.mjs`
 * 3.4.0), then `a.forEach((node, i) => node.setZIndex(i))`. Two things follow, and this
 * component was on the wrong side of both: the draft's dashed outline and its two labels drew
 * OVER the selection outline and its vertex handles, which `keepAdding` reaches on the first
 * drag after a room is created.
 *
 * - **A FRAGMENT root is unresolvable.** `B` does not descend into a slotless component
 *   vnode's `children` — that is `null` — so it asks `R` for the component's own node, and
 *   `R` answers `component.__konvaNode || R(component.subTree)`. A root that is three
 *   siblings, or a single `<template v-if>` around them (which compiles to the same Fragment),
 *   has a subTree whose `.component` is `null`, so `R` answers `null`, the nodes are left out
 *   of the ordering array entirely, and the parent walk that attached them leaves them at the
 *   END for good. Nothing is logged either: `W` reports an unresolvable child only when
 *   `el.tagName` is set, and a Fragment's `el` is a Text anchor with none. A Group's node IS
 *   resolvable, so it takes this component's place in the array at the position
 *   `InteractionLayer` mounts it. **Hoisting the `v-if` to the call site does not fix this**
 *   — measured, not reasoned: with three roots each carrying their own `v-if` the ordering
 *   case in `roomDraftSketch.test.ts` failed at the identical index.
 * - **And the group may not carry the `v-if` itself, because the ordering pass runs on the
 *   LAYER's `onUpdated`.** A rectangle appearing re-renders only THIS component, and Vue runs
 *   a parent's update job before a child's — so the layer's reindex has already happened by
 *   the time the group is created, and the new group is appended at the end until something
 *   else happens to re-render the layer. Measured both ways: with the `v-if` on the group,
 *   drafting after a selection settled left it at index 5 of 6, and only a later selection
 *   change moved it to 0. Mounted unconditionally, the group is created inside the layer's own
 *   first render pass, so its index is right from then on and the `v-if` on its CHILDREN is
 *   what makes this component draw nothing before a rectangle exists.
 *
 * The group is an IDENTITY transform — no `x`, `y`, `scale` or `rotation` — so the
 * screen-space coordinates `geometry` computes below reach Konva unchanged, which is what the
 * existing `points()` assertion in that same file holds. `listening: false` matches every node
 * here and the layer above them (SDD §62). Its whole cost when no draft exists is one empty
 * Konva node, which draws nothing and is what reserves the position.
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

/** Shared by both labels, so the offsets that centre them can be derived rather than guessed. */
const LABEL_FONT_PX = 12;

/**
 * The box the width label is centred INSIDE, so that centring needs no text measurement: the
 * node is offset by half this box, and `align: 'center'` puts the glyphs in the middle of it.
 *
 * A box rather than an `offsetX` of half the measured width, because a declarative config has
 * no node to measure — Konva does that internally, after this object is built. Wide enough for
 * the longest label the draft can hold (`1000 m`, against `MAX_ROOM_SIDE_MM`), and a longer one
 * would still be centred rather than clipped: with `wrap: 'none'` an over-long line overflows a
 * centred box symmetrically.
 */
const LABEL_BOX_PX = 120;

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
 * right edge, offset outward by 8 and centred on it. Both stay upright rather than rotating
 * with their edge, per spec §2.2.
 *
 * **Both `x`/`y` below are EDGE MIDPOINTS, and a Konva `Text` is positioned by its top-left
 * corner** — so each needs an offset to make the coordinate mean what this docblock says. It
 * did not, and the sentence above is the one that was false: the width label began AT the
 * midpoint and ran rightwards (measured: centre 373 against an edge midpoint of 358, a 15px
 * error that grows with the text), and the depth label hung down from its midpoint by half
 * its height. The offsets live in the template beside the `x`/`y` they correct, because that
 * is the only place both halves of the claim are visible at once.
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
	<VGroup :config="{ name: 'room-draft-group', listening: false }">
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
					width: LABEL_BOX_PX,
					offsetX: LABEL_BOX_PX / 2,
					align: 'center',
					wrap: 'none',
					fontSize: LABEL_FONT_PX,
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
					offsetY: LABEL_FONT_PX / 2,
					fontSize: LABEL_FONT_PX,
					fill: props.tokens.zoneLabel,
					listening: false,
				}"
			/>
		</template>
	</VGroup>
</template>
