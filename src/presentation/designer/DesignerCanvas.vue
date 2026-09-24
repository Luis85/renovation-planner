<script setup lang="ts">
/**
 * The asset designer's Konva stage: the layers of `layers/` — the world-space ones and the
 * gesture layer above them — drawn through the same gesture surface the plan editor uses
 * (design slice B4, ADR-0015). Named by `DesignerLayerName` and not counted here: the count
 * changed with a transient layer, a details layer and the selection layer, and a number in
 * this sentence was wrong after each.
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
 * **What is still resolved against `document.body`, said plainly rather than implied:** the
 * plan editor passes its own root element so a theme scoping variables to a subtree is read
 * where the canvas actually sits, and this component owns no such element — its outermost node
 * belongs to `EditorSurface`. So it passes `ref(null)`, which is the composable's documented
 * fallback, `body`, where Obsidian declares its palette. A theme scoping variables below `body`
 * is therefore not read here; closing that means hoisting the tokens to `AssetDesignerRoot`,
 * which owns `.renovation-asset-designer`, and handing them down as a prop.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type Konva from 'konva';
import { followPixelRatio } from '../editor/scene/followPixelRatio';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { StringKey } from '../i18n/locales/en';
import { useEditorStore } from '../stores/EditorStore';
import EditorSurface from '../editor/surface/EditorSurface.vue';
import BackgroundLayer from '../editor/layers/background/BackgroundLayer.vue';
import type { BackgroundStatus } from '../editor/layers/background/BackgroundRenderModel';
import { useThemeTokens } from '../editor/theme/useThemeTokens';
import CanvasGrid from '../editor/layers/CanvasGrid.vue';
import { STAGE_PIXELS, viewportTransform, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { useAssetDesignerContext } from './AssetDesignerContext';
import { useAssetDesignStore } from './stores/assetDesignStore';
import { designFrame, useDesignerRuntime } from './runtime';
import { designerGrid } from './grid/designerGrid';
import { BACKGROUND_LAYER, designerLayerConfig } from './layers/backgroundLayer';
import { footprintOutline } from './layers/footprintLayer';
import { clearanceOutline } from './layers/clearanceLayer';
import { detailOutlines, footprintEdge } from './layers/detailsLayer';
import { anchorMark, facingArrow } from './layers/anchorLayer';
import { selectionFrame, selectionMarks } from './layers/selectionLayer';
import { isOutlineSelection } from './selection/designerSelection';
import { drawnSelection } from './selection/hitTest';
import DesignerGestureLayer from './layers/DesignerGestureLayer.vue';
import DesignerRulers from './rulers/DesignerRulers.vue';
import DesignerDimensions from './dimensions/DesignerDimensions.vue';
import DesignerLegend from './legend/DesignerLegend.vue';
import RotateArrowIcon from '../editor/elements/RotateArrowIcon.vue';
import { selectionKeyActions } from './designerKeys';

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
const designStore = useAssetDesignStore();
const { design, selection, mode, preview } = storeToRefs(designStore);

const { tokens } = useThemeTokens(ref(null), context.onThemeChange);
// The LEAF's manager, so the toolbar in the shell above and the gestures on this canvas drive
// one object. A manager built here would be a second one nothing outside this component could
// reach — the shape Task B4 shipped while there were no tools to reach.
const { toolManager, renderState, setTool, editShape, activeToolId, partView, backgroundOpacity, showClearance } = useDesignerRuntime();
/**
 * An arrow key nudges the designer's selection (symbols spec, Decision 10) by `EditorSurface`'s own
 * `arrowVector` — 10 mm a press, 100 mm with Shift — as one conditional shape write per press, under
 * Select only: an outline moves, the anchor moves, and a facing or no selection writes nothing.
 */
const { nudgeSelection } = selectionKeyActions(designStore, editShape, { activeToolId, partView, showClearance });
/** No area task exists in this surface, so Enter on its canvas finishes nothing. */
const noArea = (): void => undefined;

const transform = computed(() => viewportTransform(viewport.value));

/**
 * The camera's inverse, from the ONE statement of it. Every screen-sized mark on a world-space
 * layer divides by this rather than deriving it; see `layers/anchorLayer.ts`.
 */
const worldPerPixel = computed(() => worldPerScreenPixel(viewport.value, STAGE_PIXELS));

/** The grid as drawn — the COMMITTED design's, so dragging the footprint does not slide the grid under the drag. */
const grid = computed(() => designerGrid(design.value?.shape ?? null, worldPerPixel.value));

/**
 * What every world layer draws: a gesture's in-flight PREVIEW while one is live, else the committed
 * design. `DesignerSelectTool`'s commit clears its own preview only once the write has settled, so a
 * release does not flash back to the old shape before the refresh lands; `DesignerSelectTool`'s
 * header names what else can clear a preview in that window.
 */
const shape = computed(() => preview.value ?? design.value?.shape ?? null);

/**
 * The asset's own spec sheet — Task B7's stored reference, finally read by something that
 * draws. `AssetBackgroundRef` satisfies `BackgroundDocumentRef` structurally, which is what
 * lets the plan editor's own layer take it without either entity importing the other's type.
 */
const background = computed(() => design.value?.background ?? null);

/** The asset's OWN calibration, reduced to the raster's drawn scale; `1` uncalibrated. */
const pixelsPerWorldUnit = computed(() => design.value?.calibration?.pixelsPerWorldUnit ?? 1);

const footprint = computed(() => footprintOutline(shape.value, tokens.value, worldPerPixel.value));
// The Parts panel's leaf-local visibility (AD09). An editing aid, not output: it drops a graphic
// from this frame and reaches nothing the vault holds, so the plan's placement and the library's
// mark go on drawing every graphic the shape has.
const details = computed(() => detailOutlines(shape.value, tokens.value, worldPerPixel.value, partView.hidden.value));
const footprintEdgeLine = computed(() => footprintEdge(shape.value, tokens.value, worldPerPixel.value));
/**
 * An outline's handles and rotate arrow only under Select, the one tool that grabs them: under another tool a drawn handle
 * is a control that does nothing. What stays is what SHOWS the selection — an outline's accent restroke,
 * and the anchor's or the facing's ring, which is that selection's only mark (follow-up A1). With nothing
 * selected `selectionMarks` draws nothing, so that case needs no arm here.
 *
 * A selected part that is not drawn — the clearance while `Show clearance` is off, a Parts-hidden
 * graphic — draws no marks at all (AD18-R20, `drawnSelection`, the rule `hitDesign` asks too). `drawnPart`
 * is this component's one reading, and the rulers' extent band and `Shift+2` below take it too (AD18-R23).
 */
const drawnPart = computed(() => drawnSelection(selection.value, { hidden: partView.hidden.value, clearanceHidden: !showClearance.value }));
const marks = computed(() => {
	const drawn = selectionMarks(shape.value, drawnPart.value, mode.value, tokens.value, worldPerPixel.value);
	return activeToolId.value === 'select' || !isOutlineSelection(selection.value) ? drawn : { outline: drawn.outline, handles: [], rotate: null };
});
const clearance = computed(() => clearanceOutline(shape.value, tokens.value, worldPerPixel.value));
const anchor = computed(() => anchorMark(shape.value, tokens.value, worldPerPixel.value));
const facing = computed(() => facingArrow(shape.value, tokens.value, worldPerPixel.value));

/**
 * What `Shift+1` and `Shift+2` frame. The first is the whole design — the footprint and, when
 * there is one, the clearance around it, since a clearance reaches outside the outline it
 * belongs to and a fit that cropped it would hide the thing being fitted.
 *
 * `Shift+2` frames the SELECTION as drawn — `selectionFrame` over `drawnPart`, `null` with nothing
 * selected and for a selected part the canvas does not draw (AD18-R23). A fit with nothing to frame
 * does nothing, which is `boundsOfZones`' own rule: a jump to nowhere costs the user the view they had
 * and says nothing about why.
 *
 * The whole-design box is `designFrame` (`runtime.ts`), which Apply preset fits to as well, and the fit an
 * opened design takes below asks this very function — so none of the three frames a design differently.
 */
function framedBounds(all: boolean): BoundingBox | null {
	const current = shape.value;
	if (current === null) return null;
	return all ? designFrame(current) : selectionFrame(current, drawnPart.value, worldPerPixel.value);
}

/**
 * An asset OPENS framed, as `Shift+1` frames it (selection polish critique, finding 1): opened at the default
 * camera, a toilet was a few dozen pixels in the corner with its handles piled on it. Once, the first time
 * the stage has an area — the canvas mounts only over a design already read, so what is drawn then is the
 * design as opened. A design with no shape at that moment keeps its camera, and `once` ends the question
 * there: a footprint traced afterwards is drawn at the camera the user traced it at, never jumped to.
 * Nothing restores a camera to defer to: `AssetDesignerView.getState` persists the asset id alone.
 *
 * **Not the same watch `PlanCanvas` runs.** `PlanCanvas` registers its watch only once, and only if
 * the stage is not yet ready when it mounts; the watch itself returns on a fall and stops itself
 * after the first rise — its own comment says "Only the rise counts". This one registers
 * unconditionally with `{ once: true }` and does not read the value it fired on, so it can spend its
 * one callback on a FALL just as easily as on a rise. That is what makes a canvas REMOUNTED inside the
 * same app — `AssetDesignerRoot`'s `v-if` can swap it out and back without resetting
 * `EditorStore.stageSize` — never frame a second time if the stage was already measured when it
 * remounted: the watch spends its one callback on the fall to zero instead. Harmless today, because
 * `fitTo` ignores a zero stage and the very first mount always rises from zero; a canvas that reaches
 * that remount case opens unframed.
 */
watch(
	() => editor.stageSize.width > 0 && editor.stageSize.height > 0,
	() => {
		const bounds = framedBounds(true);
		if (bounds !== null) editor.fitTo(bounds, editor.stageSize);
	},
	{ once: true },
);

/**
 * vue-konva's `VStage` exposes `getStage()`; the layers follow the monitor's pixel ratio through
 * it, exactly as `PlanCanvas.vue` wires the other stage. The ref is set by the time `onMounted`
 * runs — `VStage` renders unconditionally inside the slot — so the null arm Vue types for it is
 * unreachable and is not written. The disposer runs in this component's `onBeforeUnmount`,
 * which Vue invokes BEFORE `VStage`'s own destroys the stage.
 */
const stageRef = ref<{ getStage(): Konva.Stage } | null>(null);
let stopPixelRatio!: () => void;
onMounted(() => { stopPixelRatio = followPixelRatio((stageRef.value as { getStage(): Konva.Stage }).getStage()); });
onBeforeUnmount(() => stopPixelRatio());
</script>

<template>
	<EditorSurface
		:tool-manager="toolManager"
		:active-tool-id="editorRefs.activeToolId"
		:render-state="renderState"
		:editor="editor"
		:framed-bounds="framedBounds"
		:canvas-label="CANVAS_LABEL"
		:set-tool="setTool"
		:has-selection="() => designStore.selection !== null"
		:clear-selection="() => designStore.select(null)"
		:nudge-selection="nudgeSelection"
		:finish-area="noArea"
	>
		<template #default="{ size }">
			<VStage
				ref="stageRef"
				:config="size"
			>
				<!--
					The asset's spec sheet, drawn by the SAME component the plan editor mounts.
					Its position among its siblings is the contract — see `layers/backgroundLayer.ts`
					— and `visible` is a literal because this surface has no layer-visibility
					control to bind: layer visibility in the plan editor's `WorkspaceStore` is a
					Plan Editor concern (its `gridVisible` is shared).

					`opacity` is NOT a literal, and it is the one thing on this mount that is not:
					`DesignerViewMenu`'s third row binds the leaf's own `backgroundOpacity` ref
					(AD12-R1). It is a VIEW preference and reaches nothing the vault holds —
					`runtime.ts` carries the whole account.

					**It is a DECLARED prop of that component, and it had to become one.** The first
					version of this binding relied on Vue's attribute FALLTHROUGH onto the root
					`<VLayer>`: that does reach the Konva node — vue-konva's node factory builds
					`{ ...attrs, ...props.config, ...listeners }` and applies it — but `props.config`
					spreads AFTER `attrs`, so putting `opacity` in that component's config literal
					would have silently won over this binding, and `inheritAttrs: false` or a second
					root node there would have dropped it. Vue warned on every mount besides, since
					`<VLayer>` renders no DOM element to inherit an attribute. `BackgroundLayer.vue`
					declares `opacity?: number` defaulting to `1` now, so the plan editor's mount is
					unchanged and `vue-tsc` holds this line.
				-->
				<BackgroundLayer
					:name="BACKGROUND_LAYER"
					:reference="background"
					:vault="context.vault"
					:transform="transform"
					:visible="true"
					:opacity="backgroundOpacity"
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
				<VLayer :config="designerLayerConfig('asset-details', transform)">
					<VLine
						v-for="detail in details"
						:key="detail.id"
						:config="{ ...detail, name: 'asset-detail' }"
					/>
					<VLine
						v-if="footprintEdgeLine !== null"
						:config="{ ...footprintEdgeLine, name: 'asset-footprint-edge' }"
					/>
				</VLayer>
				<VLayer :config="{ ...designerLayerConfig('asset-clearance', transform), visible: showClearance }">
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
					The selection: above every committed part it can be drawn across, below the gesture.
				-->
				<VLayer :config="designerLayerConfig('asset-selection', transform)">
					<VLine
						v-if="marks.outline !== null"
						:config="{ ...marks.outline, name: 'asset-selection-outline' }"
					/>
					<VLine
						v-if="marks.rotate !== null"
						:config="{ ...marks.rotate.stem, name: 'asset-rotate-stem' }"
					/>
					<VRect
						v-for="(handle, index) in marks.handles"
						:key="index"
						:config="{ ...handle, name: 'asset-selection-handle' }"
					/>
					<RotateArrowIcon
						v-if="marks.rotate !== null"
						:at="marks.rotate.at"
						:world-per-pixel="worldPerPixel"
						:tokens="tokens"
						direction="clockwise"
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
			<!--
				ABOVE the stage, where the Plan Editor mounts its grid below: a design is usually traced over an opaque
				spec sheet, and a grid under it would snap to lines nobody can see (snapping spec §5).
			-->
			<CanvasGrid
				:step-mm="grid.step"
				:origin="grid.origin"
			/>
		</template>
		<!--
			The overlay slot: the rulers first, then the dimensions, then the key (AD18-R16
			Task 4), then whatever the shell passed down — the empty state today — so a card
			meant to be read sits OVER all three rather than under them. All four are
			`position: absolute` against `.rp-plan-canvas`, and none of them takes any layout at
			all, which is what holds AD18-R10's floor on the canvas's share of the shell.

			The dimensions come SECOND, and it is the one ordering here that is not merely about
			reading: they carry the only controls of the four — real buttons and a real form
			(AD18-R11) — so they must paint over the rulers' strips. The key after them (the legend
			over `DesignerScaleBar`) takes no press but is OPAQUE, and a camera can put a label in
			its corner, so DOM order alone would bury that label: `z-index: 1` on a resting label,
			in `designer-dimensions.css`, is what keeps it pressable. The empty state must still
			paint over everything, since a surface with nothing drawn has nothing to measure — and
			nothing to explain the vocabulary of, which is `legendRows.ts`'s own account of why
			the legend draws no row at all over the same `null` shape that state answers.
		-->
		<template #overlay>
			<DesignerRulers :selection="drawnPart" />
			<DesignerDimensions />
			<DesignerLegend />
			<slot />
		</template>
	</EditorSurface>
</template>
