<script setup lang="ts">
/**
 * The asset designer's Konva stage: the four layers of `layers/`, drawn through the same
 * gesture surface the plan editor uses (design slice B4, ADR-0015).
 *
 * **`EditorSurface` is shared, not copied.** Task B1 lifted every pointer, wheel and key door
 * out of `PlanCanvas.vue` for exactly this mount — some thirty documented findings about
 * chorded buttons, held keys, foreign pointers and interrupted gestures live in that one file,
 * and a second canvas re-deriving them would rediscover every one. What this component owns is
 * what is DRAWN inside it and nothing about how it is driven.
 *
 * **Camera-only, today.** `EditorSurface` requires a `ToolManager`, and nothing registers a
 * designer tool until Task B5 — so this one is built with `designerToolsUnavailable` and has
 * no tools in it. That is not a degraded state: "no active tool" IS camera mode in this
 * editor, which is what pans and zooms here. B5 registers into a manager it moves to
 * `DesignerRuntime`, where a toolbar mounted in the shell's own region can reach it; it is
 * local to this component only while this component is its only consumer.
 *
 * **The palette is resolved ONCE, at setup, and that is a stated limitation rather than a
 * convention.** A canvas cannot read a CSS variable — `fill: var(--text-normal)` means nothing
 * to a 2D context — so `resolveThemeTokens` is the bridge, exactly as it is for the plan
 * editor. What the plan editor has and this does not is `PlanEditorContext.onThemeChange`:
 * `AssetDesignerDeps` carries no theme subscription, so a user who switches theme or toggles
 * dark mode with a designer open keeps the old palette until the leaf is reopened. Closing
 * that is one member on the deps bundle plus the composition root's existing `css-change`
 * binding, and it is written here rather than left to be rediscovered. It resolves against
 * `document.documentElement` for the same reason `useThemeTokens` does at setup: this
 * component's own element does not exist yet, and the subtree-scoped refinement is what the
 * missing subscription would buy back.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { StringKey } from '../i18n/locales/en';
import { useEditorStore } from '../stores/EditorStore';
import EditorSurface from '../editor/surface/EditorSurface.vue';
import { ToolManager } from '../editor/tools/tool-manager';
import { resolveThemeTokens } from '../editor/theme/themeTokens';
import { STAGE_PIXELS, viewportTransform, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { boundsOfZones } from '../editor/viewport/zoneExtent';
import { useAssetDesignStore } from './stores/assetDesignStore';
import { designerToolsUnavailable } from './designerToolContext';
import { designerLayerConfig } from './layers/backgroundLayer';
import { footprintOutline } from './layers/footprintLayer';
import { clearanceOutline } from './layers/clearanceLayer';
import { anchorMark, facingArrow } from './layers/anchorLayer';

/**
 * What a screen reader calls this surface. `EditorSurface` requires it rather than defaulting
 * to `editor.canvas`, which is what stops this canvas announcing itself as "Plan canvas" —
 * jsdom resolves either name perfectly well and the axe cases assert that a name EXISTS.
 */
const CANVAS_LABEL: StringKey = 'designer.canvas';

const editor = useEditorStore();
/**
 * Kept as the OBJECT `storeToRefs` returns rather than destructured, because
 * `EditorSurface.activeToolId` is a `Ref` prop and Vue's template compiler unwraps a top-level
 * setup binding that IS a ref. Destructured, `:active-tool-id="editorRefs.activeToolId"` passes `null` —
 * the value — and the surface's pointer doors then read `.value` off it on the first press.
 * A property access on a plain object is not unwrapped, which is why `PlanCanvas` can write
 * `runtime.activeToolId` and why this one property is reached through its holder.
 *
 * The prop is the `Ref` and not its value on purpose: the pointer doors read it synchronously,
 * in the same tick a toolbar click writes it, and a plain value would only refresh on the
 * host's next render.
 */
const editorRefs = storeToRefs(editor);
const viewport = editorRefs.viewport;
const { design } = storeToRefs(useAssetDesignStore());

const tokens = ref(resolveThemeTokens(document.documentElement));
const toolManager = new ToolManager(designerToolsUnavailable);

const transform = computed(() => viewportTransform(viewport.value));

/**
 * The camera's inverse, from the ONE statement of it. Every screen-sized mark on a world-space
 * layer divides by this rather than deriving it; see `layers/anchorLayer.ts`.
 */
const worldPerPixel = computed(() => worldPerScreenPixel(viewport.value, STAGE_PIXELS));

const shape = computed(() => design.value?.shape ?? null);

const footprint = computed(() => footprintOutline(shape.value, tokens.value));
const clearance = computed(() => clearanceOutline(shape.value, tokens.value));
const anchor = computed(() => anchorMark(shape.value, tokens.value, worldPerPixel.value));
const facing = computed(() => facingArrow(shape.value, tokens.value, worldPerPixel.value));

/**
 * What `Shift+1` and `Shift+2` frame. The first is the whole design — the footprint and, when
 * there is one, the clearance around it, since a clearance reaches outside the outline it
 * belongs to and a fit that cropped it would hide the thing being fitted.
 *
 * `Shift+2` frames the SELECTION and answers `null`, because there is nothing selectable on
 * this canvas yet. A fit with nothing to frame does nothing, which is `boundsOfZones`' own
 * rule: a jump to nowhere costs the user the view they had and says nothing about why.
 *
 * It goes through `boundsOfZones` rather than scanning coordinates here — the function is
 * named for the plan editor's caller and typed for any `{ points }`, and a second definition of
 * "the box around these points" in this layer would be free to disagree with Core's.
 */
function framedBounds(all: boolean): BoundingBox | null {
	const current = shape.value;
	if (!all || current === null) return null;
	return boundsOfZones([current.footprint, ...(current.clearance === null ? [] : [current.clearance])]);
}
</script>

<template>
	<EditorSurface
		:tool-manager="toolManager"
		:active-tool-id="editorRefs.activeToolId"
		:editor="editor"
		:framed-bounds="framedBounds"
		:canvas-label="CANVAS_LABEL"
	>
		<template #default="{ size }">
			<VStage :config="size">
				<!--
					Empty, and drawn anyway: Task B7 supplies the reference this layer will load.
					Its position among its siblings is the contract — see `layers/backgroundLayer.ts`.
				-->
				<VLayer :config="designerLayerConfig('asset-background', transform)" />
				<VLayer :config="designerLayerConfig('asset-footprint', transform)">
					<VLine
						v-if="footprint !== null"
						:config="{ ...footprint, name: 'asset-footprint-outline' }"
					/>
				</VLayer>
				<VLayer :config="designerLayerConfig('asset-clearance', transform)">
					<VLine
						v-if="clearance !== null"
						:config="{ ...clearance, name: 'asset-clearance-outline' }"
					/>
				</VLayer>
				<VLayer :config="designerLayerConfig('asset-anchor', transform)">
					<VCircle
						v-if="anchor !== null"
						:config="{ ...anchor, name: 'asset-anchor-mark' }"
					/>
					<VLine
						v-if="facing !== null"
						:config="{ ...facing.shaft, name: 'asset-facing-shaft' }"
					/>
					<VLine
						v-if="facing !== null"
						:config="{ ...facing.head, name: 'asset-facing-head' }"
					/>
				</VLayer>
			</VStage>
		</template>
		<template #overlay>
			<slot />
		</template>
	</EditorSurface>
</template>
