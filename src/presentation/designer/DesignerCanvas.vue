<script setup lang="ts">
/**
 * The asset designer's Konva stage: the five layers of `layers/` — four world-space and the
 * gesture layer above them — drawn through the same gesture surface the plan editor uses
 * (design slice B4, ADR-0015). It was four until the review fixes gave the designer a
 * transient layer; counted from `DesignerLayerName` rather than remembered.
 *
 * **`EditorSurface` is shared, not copied.** Task B1 lifted every pointer, wheel and key door
 * out of `PlanCanvas.vue` for exactly this mount — some thirty documented findings about
 * chorded buttons, held keys, foreign pointers and interrupted gestures live in that one file,
 * and a second canvas re-deriving them would rediscover every one. What this component owns is
 * what is DRAWN inside it and nothing about how it is driven.
 *
 * **The `ToolManager` is the LEAF's, not this component's** (design slice B5). Task B4 built
 * one here with a context factory that threw, because nothing registered a designer tool yet;
 * B5 registered the tools and moved the manager to `DesignerRuntime`, which is what the toolbar —
 * mounted in the shell's own region and not this component's child — can reach. Camera mode is
 * still what "no active tool" means, and it is still what pans and zooms here.
 *
 * **The gesture in progress is drawn by `DesignerGestureLayer`, last and in screen space.**
 * For a whole increment it was not — no task built a designer interaction layer, and a user
 * traced against a close target drawn nowhere — which the docblocks of this file,
 * `registerDesignerTools.ts` and `AssetDesignerRoot.vue` recorded as a gap and nothing
 * scheduled. The arithmetic is `editor/layers/gestureGeometry.ts`, shared with the plan editor.
 *
 * **The palette follows the theme.** A canvas cannot read a CSS variable —
 * `fill: var(--text-normal)` means nothing to a 2D context — so `resolveThemeTokens` is the
 * bridge, exactly as it is for the plan editor, and `useThemeTokens` is what keeps that bridge
 * current: `AssetDesignerDeps.onThemeChange` carries Obsidian's `css-change` to this surface
 * the way `PlanEditorContext.onThemeChange` carries it to the other one. It resolved ONCE at
 * setup for two tasks, which is why a user who switched theme with a designer open kept a
 * light-theme stroke on a dark ground until the leaf was reopened; `designerTheme.test.ts`
 * replaced that sentence with a case.
 *
 * **What is still resolved against `document.documentElement`, said plainly rather than
 * implied:** the plan editor passes its own root element so a theme scoping variables to a
 * subtree is read where the canvas actually sits, and this component owns no such element —
 * its outermost node belongs to `EditorSurface`. So it passes `ref(null)`, which is the
 * composable's documented fallback. A subtree-scoped theme is therefore read from the document
 * here; closing that means hoisting the tokens to `AssetDesignerRoot`, which owns
 * `.renovation-asset-designer`, and handing them down as a prop.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import { useEditorStore } from '../stores/EditorStore';
import EditorSurface from '../editor/surface/EditorSurface.vue';
import BackgroundLayer from '../editor/layers/background/BackgroundLayer.vue';
import type { BackgroundStatus } from '../editor/layers/background/BackgroundRenderModel';
import { useThemeTokens } from '../editor/theme/useThemeTokens';
import { STAGE_PIXELS, viewportTransform, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { boundsOfZones } from '../editor/viewport/zoneExtent';
import { useSelectionStore } from '../editor/selection/selection-store';
import { useAssetDesignerContext } from './AssetDesignerContext';
import { useAssetDesignStore } from './stores/assetDesignStore';
import { useDesignerRuntime } from './runtime';
import { BACKGROUND_LAYER, designerLayerConfig } from './layers/backgroundLayer';
import { footprintOutline } from './layers/footprintLayer';
import { clearanceOutline } from './layers/clearanceLayer';
import { anchorMark, facingArrow } from './layers/anchorLayer';
import DesignerGestureLayer from './layers/DesignerGestureLayer.vue';

/**
 * What a screen reader calls this surface. `EditorSurface` requires it rather than defaulting
 * to `editor.canvas`, which is what stops this canvas announcing itself as "Plan canvas" —
 * jsdom resolves either name perfectly well and the axe cases assert that a name EXISTS.
 */
const CANVAS_LABEL: StringKey = 'designer.canvas';

const emit = defineEmits<{ backgroundStatus: [status: BackgroundStatus] }>();

const context = useAssetDesignerContext();
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

const { tokens } = useThemeTokens(ref(null), context.onThemeChange);
// The LEAF's manager, so the toolbar in the shell above and the gestures on this canvas drive
// one object. A manager built here would be a second one nothing outside this component could
// reach — the shape Task B4 shipped while there were no tools to reach.
const { toolManager, renderState, setTool } = useDesignerRuntime();
/**
 * The selection store, for `EditorSurface`'s Escape routing alone — none of this surface's five
 * registered tools ever call `context.selection.select(...)`, so `selectedIds` never leaves
 * `[]` today. Wired anyway, the way `PlanCanvas.vue` wires the SAME store class: a second
 * `useSelectionStore()` call resolves to one Pinia instance per app, so this is not a second
 * store to keep in step with the one `runtime.ts` already hands every tool through
 * `EditorContext.selection` — it is that store, read here.
 */
const selection = useSelectionStore();

/**
 * `routeEscape`'s `returned-to-select` arm always asks for the Plan Editor's neutral tool,
 * `'select'` — a tool this surface never registers (`registerDesignerTools` names
 * `trace-footprint`, `trace-clearance`, `set-anchor`, `set-facing` and `calibrate`, and no
 * `select`). `runtime.setTool('select')` would throw `no tool is registered for id 'select'`
 * the first time a user pressed Escape over an empty-buffered trace or a not-yet-pressed
 * anchor/facing tool. Camera mode — `null` — is this surface's own neutral state (see the
 * file header: "Camera mode is still what 'no active tool' means"), so that is what this
 * surface returns to instead; `routeEscape` itself is unaware of the substitution; the
 * outcome it reports back is unread here.
 */
function escapeSetTool(id: ToolId | null): void {
	setTool(id === 'select' ? null : id);
}

const transform = computed(() => viewportTransform(viewport.value));

/**
 * The camera's inverse, from the ONE statement of it. Every screen-sized mark on a world-space
 * layer divides by this rather than deriving it; see `layers/anchorLayer.ts`.
 */
const worldPerPixel = computed(() => worldPerScreenPixel(viewport.value, STAGE_PIXELS));

const shape = computed(() => design.value?.shape ?? null);

/**
 * The asset's own spec sheet — Task B7's stored reference, finally read by something that
 * draws. `AssetBackgroundRef` satisfies `BackgroundDocumentRef` structurally, which is what
 * lets the plan editor's own layer take it without either entity importing the other's type.
 */
const background = computed(() => design.value?.background ?? null);

/** The asset's OWN calibration, reduced to the raster's drawn scale; `1` uncalibrated. */
const pixelsPerWorldUnit = computed(() => design.value?.calibration?.pixelsPerWorldUnit ?? 1);

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
		:render-state="renderState"
		:editor="editor"
		:framed-bounds="framedBounds"
		:canvas-label="CANVAS_LABEL"
		:set-tool="escapeSetTool"
		:has-selection="() => selection.selectedIds.length > 0"
		:clear-selection="() => selection.clear()"
	>
		<template #default="{ size }">
			<VStage :config="size">
				<!--
					The asset's spec sheet, drawn by the SAME component the plan editor mounts.
					Its position among its siblings is the contract — see `layers/backgroundLayer.ts`
					— and `visible` is a literal because this surface has no layer-visibility
					control to bind: the plan editor's `WorkspaceStore` is a Plan Editor concern.
				-->
				<BackgroundLayer
					:name="BACKGROUND_LAYER"
					:reference="background"
					:vault="context.vault"
					:transform="transform"
					:visible="true"
					:pixels-per-world-unit="pixelsPerWorldUnit"
					:file-changes="context.onVaultFileChanged"
					@status="(status) => emit('backgroundStatus', status)"
				/>
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
				<!--
					Screen space and LAST: the gesture in progress sits over every committed
					picture, sized in pixels. `layers.test.ts` asserts this order by name.
				-->
				<DesignerGestureLayer
					:render-state="renderState"
					:tokens="tokens"
				/>
			</VStage>
		</template>
		<template #overlay>
			<slot />
		</template>
	</EditorSurface>
</template>
