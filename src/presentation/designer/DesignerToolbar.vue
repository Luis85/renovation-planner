<script setup lang="ts">
/**
 * The asset designer's toolbar (design slice B5): camera mode, one button per registered
 * designer tool that is not a drawing SHAPE, undo/redo and the View menu.
 *
 * **It used to be the only thing that made any tool reachable, and AD18-R3 ended that for four
 * of them.** The four Basic-shape tools are drawn by `DesignerAddPanel.vue` now — MOVED, not
 * duplicated — so the standing claim is narrower than it was and has to be written narrower:
 * between this component and that one, every registered designer tool has exactly one button.
 * The two filter the same `DESIGNER_TOOL_ICONS` table on the same `group` field with
 * complementary predicates, which is what makes "exactly one" a property of the data rather
 * than of two templates agreeing; `designerAddRail.test.ts` asks it of the mounted shell.
 *
 * Why that claim is worth a check at all is why this component exists: Task B5's own file list
 * had no toolbar in it while its commit message promised "a toolbar that reaches all of them",
 * and a tool absent from the one control that can activate it is invisible to all four gates,
 * because nothing is wrong with the code — design slice 7's `CalibrateTool` shipped that way
 * for two whole slices.
 *
 * Modelled deliberately on the Plan Editor's own toolbar, down to the `MODES` table and the
 * `aria-pressed` mirror — the two surfaces' toolbars answered the same questions about
 * different tools, and a reader who knew one did not have to learn the other. **The Plan
 * Editor's has since been retired** (Task 13 replaced it with a context bar and a floating
 * Select/Add group, since that surface's tools are reachable without a toolbar at all); this
 * one remains the asset designer's own, out of that task's scope. What was never shared is the
 * component — this one injects `DesignerRuntime` and reads `DESIGNER_TOOL_LABELS`, and a
 * generic toolbar parameterised over both would need its runtime, its label table and its
 * subject injected, which is three parameters to save nine lines of template.
 *
 * Camera mode (`null`) is a toolbar STATE rather than one more `EditorTool`, exactly as it is on
 * a plan: the camera is ephemeral UI (SDD §15) and never a command, so "no active tool" is what
 * pans and zooms here.
 *
 * **Every button draws a native icon now (AD18 item 3), and AD18-R17's Task 2 hides its text at
 * every width rather than only below a breakpoint — boards 01 and 02 both draw this row
 * icon-only.** `grep -rn "HostIcon" src/presentation/designer/` answered 0 before AD18 item 3,
 * against 40 files under `src/presentation/editor/` (`grep -rln`) — the measurement behind C12's
 * "match the current Plan Editor's interaction conventions". It answered THREE lines after that
 * card: the import and the element both lived in `DesignerToolButton.vue`, the one component in
 * this directory that drew a glyph, plus this sentence. **It answers SEVEN now, and this file is
 * a second importer since AD18-R16's Task 1**: the zoom cluster's four buttons draw a bare
 * `HostIcon` in a plain `<button>` rather than through `DesignerToolButton`, because that
 * component always carries a label span (and must not grow a prop that hides it — its own
 * docblock's correction) while the cluster has no width at which one is shown — which every
 * button in this toolbar now shares, unconditionally, since Task 2. `DesignerToolButton` is
 * still the one component that draws an icon BESIDE a label; a bare `HostIcon` beside no label
 * at all is this file's own second convention now, not a second one competing with it. WHETHER
 * the label draws is spelled in `styles/designer-toolbar.css` and argued there, not here — the
 * rule is NOT scoped to `.rp-designer-tools`, so it also reaches the `Add` rail's own copy of
 * `.rp-designer-tool-label`; that rail shows its own at every width instead (AD18-R16 Task 3) and
 * wins the overlap by import order, which that partial's own comment argues. Neither sentence
 * belongs here.
 * WHICH glyph each tool wears is `tools/designerToolIcons.ts`, a module rather than a `const` in
 * this file because a `<script setup>` binding is not a module export and AD18 item 5's `Add`
 * rail has to be able to import it — which, since this card, it does.
 *
 * **No button here carries a `title`.** Its label is its accessible name — as visible text and
 * as `aria-label`, the same string — so a tooltip repeating it shows a sighted user nothing new
 * and may be announced twice (selection polish critique, finding 24). That reason survived
 * iconification rather than being quietly re-taken: Obsidian draws its own tooltip from
 * `aria-label`, so the icon-only state is not a state with no tooltip. The mode buttons'
 * `title`s describe a gesture, which is why `DesignerSelectionModes` keeps them. Undo and Redo
 * are ONE group, `.rp-designer-history`, which `designer.css` ends on whichever row it wraps
 * to — the `flex: 1` spacer it replaces stopped pushing once the toolbar wrapped (finding 5).
 * The zoom cluster keeps the same rule for the same reason: its accessible names ARE its labels,
 * so a `title` would repeat every one of them.
 */
import type { IconName } from 'obsidian';
import { computed } from 'vue';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import { useEditorStore } from '../stores/EditorStore';
import { screenPoint } from '../editor/viewport/Viewport';
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { DESIGNER_TOOL_ICONS } from './tools/designerToolIcons';
import { designFrame, useDesignerRuntime } from './runtime';
import { isOutlineSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';
import DesignerSelectionModes from './DesignerSelectionModes.vue';
import DesignerToolButton from './DesignerToolButton.vue';
import DesignerViewMenu from './DesignerViewMenu.vue';
import HostIcon from '../components/HostIcon.vue';

const runtime = useDesignerRuntime();
const designStore = useAssetDesignStore();
const editorStore = useEditorStore();

/**
 * The mode buttons as DATA, one row per selectable mode — `null` being camera mode, which has
 * no entry in the tool table because it is not a tool.
 *
 * DERIVED from `DESIGNER_TOOL_LABELS` rather than re-listed here, which is the whole mechanism
 * this slice leans on: that table's keys are the `DesignerToolId` union, and
 * `registerDesignerTools` builds a record TOTAL over the same union and registers every value
 * of it. So a tool offered here with nothing registered behind it is a build error one file
 * over, rather than a button that throws when somebody presses it.
 *
 * `Object.entries` loses the key's literal type, so the row is typed on the way out. That is
 * the one unchecked step in the chain and it is why `designerToolbar.test.ts` clicks every
 * button and asserts the manager's active tool, rather than counting them.
 */
const MODES: readonly { readonly id: ToolId | null; readonly label: StringKey; readonly icon: IconName }[] = [
	{ id: null, label: 'designer.toolbar.pan', icon: 'hand' },
	...Object.entries(DESIGNER_TOOL_LABELS).flatMap(([id, label]) => {
		const entry = DESIGNER_TOOL_ICONS[id as keyof typeof DESIGNER_TOOL_ICONS];
		// The `'shape'` rows are DROPPED rather than cut out by index (AD18-R3): they are drawn in
		// `DesignerAddPanel.vue` now, whose own filter is the exact complement of this one over the
		// same two-valued field — so every registered tool is still drawn exactly once, which is
		// what the three-run spelling this replaces was reaching for by index. The old spelling
		// also rested on the `'shape'` rows being CONTIGUOUS in `DESIGNER_TOOL_LABELS`; a predicate
		// rests on nothing, so that assumption is gone with it rather than merely untested.
		return entry.group === 'shape' ? [] : [{ id: id as ToolId, label: label as StringKey, icon: entry.icon as IconName }];
	}),
];

/**
 * The camera's scale, whole percent — moved here from the status region (AD18 item 1, ruling
 * AD18-R16's Task 1). `StatusBar`'s own `zoomPercent` sets the precedent for rounding: a readout
 * that jitters in its last digit is one people stop reading.
 *
 * **Two standing answers to one question was refused rather than duplicated.** The status
 * region stated it beside the Shift hint and the grid step; the concept boards draw it beside
 * undo/redo instead, so it moved rather than growing a second reader. `AssetDesignerRoot.vue`'s
 * `.rp-designer-status` no longer states it — `assetDesignerRoot.test.ts` pins the absence.
 *
 * Gated on `design !== null` at the template, same as the region it left: a scale stated over a
 * leaf that is loading or failed is a fact about nothing, and `AssetDesignStore.fail` blanks
 * `design` for both.
 */
const zoomPercent = computed(() => Math.round(editorStore.viewport.zoom * 100));

/**
 * Refused while a gesture is running — a pan, or a tool's own drag — the same guard
 * `EditorViewMenu.vue`'s `blocked()` gives its own zoom and fit buttons: a camera move under a
 * held drag would change what the drag lands on.
 */
function blocked(): boolean {
	return runtime.toolManager.gestureInFlight || editorStore.dragState !== null;
}

/**
 * The zoom cluster's two buttons — factor 1.25 about the stage centre, exactly as
 * `EditorViewMenu.vue`'s own `zoom()` does it, because a keyboard-reachable button has no
 * pointer position to anchor on.
 */
function zoom(factor: number): void {
	if (blocked()) return;
	editorStore.zoomByFactor(screenPoint(editorStore.stageSize.width / 2, editorStore.stageSize.height / 2), factor);
}

/**
 * The fit button — the SAME fit the designer's opening camera uses, called a third time rather
 * than rewritten: `designFrame` is already the one definition `DesignerCanvas`'s opening watch
 * and `runtime.applyShape`'s preset fit share, so this button cannot drift from either of them.
 *
 * `preview` is deliberately not read here the way `DesignerCanvas.framedBounds` reads it for
 * `Shift+1`: `blocked()` above already refuses this button while a gesture is in flight, which
 * is the only state where a preview shape and the committed one could differ, so the committed
 * `design.shape` is the whole answer whenever this function is reachable at all.
 *
 * **No `bounds !== null` guard, unlike this function's two siblings.** `DesignerCanvas.framedBounds`
 * and `runtime.applyShape` both keep one, because a PREVIEW shape — mid-gesture geometry a tool has
 * not finished validating — can be degenerate for an instant. This function never sees that state
 * (the paragraph above says why), and a COMMITTED `design.shape` cannot make `designFrame` answer
 * `null`: `validateAssetShape` already refuses a footprint that does not enclose an area
 * (`AssetShape.ts`'s own `enclosesArea` check), which is exactly what `boundsOfZones` would need to
 * fail for. A guard neither gesture nor a real command can ever trip is a branch this file's own
 * coverage floor can never close — reviewed and removed rather than proven with a fixture built by
 * hand to hold a shape no validated command would ever produce.
 */
function fitDesign(): void {
	if (blocked()) return;
	const shape = designStore.design?.shape ?? null;
	if (shape === null) return;
	editorStore.fitTo(designFrame(shape) as BoundingBox, editorStore.stageSize);
}

/**
 * `aria-disabled` is only ever the literal string `'true'`, never `'false'` — house pattern,
 * `DesignerActionButton.vue`'s own `ariaDisabled`. Gated on `design?.shape` alone, not
 * `blocked()`: the zoom-in/out buttons beside this one take no visual state for a held gesture
 * either, and `fitDesign` already refuses the click for both reasons above.
 */
const fitAriaDisabled = computed(() => ((designStore.design?.shape ?? null) === null ? 'true' : undefined));
</script>

<template>
	<div
		class="rp-designer-tools"
		role="toolbar"
		:aria-label="tr('designer.toolbar')"
	>
		<DesignerToolButton
			v-for="mode in MODES"
			:key="mode.label"
			:label="mode.label"
			:icon="mode.icon"
			:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
			:aria-pressed="runtime.activeToolId.value === mode.id"
			@click="runtime.setTool(mode.id)"
		/>
		<DesignerSelectionModes v-if="runtime.activeToolId.value === 'select' && isOutlineSelection(designStore.selection)" />
		<div class="rp-designer-history">
			<DesignerToolButton
				label="designer.toolbar.undo"
				icon="undo-2"
				:disabled="!runtime.canUndo.value"
				@click="runtime.undo()"
			/>
			<DesignerToolButton
				label="designer.toolbar.redo"
				icon="redo-2"
				:disabled="!runtime.canRedo.value"
				@click="runtime.redo()"
			/>
		</div>
		<!--
			AD18 item 1's zoom cluster: board 01 draws `− 100% +` beside undo/redo, board 02
			`100% ▾` — a `role="group"` here rather than two separate controls, so a screen reader
			hears one cluster rather than three unrelated buttons. Icon-only by MARKUP rather than
			by CSS, unlike the mode buttons above (Task 2 made those icon-only too, but through
			`styles/designer-toolbar.css` hiding a label span `DesignerToolButton` still renders):
			this cluster's buttons carry no label markup at all, so there is no width at which one
			could reappear. `aria-label` alone is each button's accessible name either way — no
			`title`, the same convention this file's own header records for every other button
			here. Magnifiers (`zoom-out`/`zoom-in`) since Task 2, matching board 01's glyphs —
			`circle-minus`/`circle-plus` were last round's choice, made when `minus` still belonged
			to `draw-line`.
		-->
		<div
			class="rp-designer-zoom"
			role="group"
			:aria-label="tr('designer.toolbar.zoom')"
		>
			<button
				type="button"
				class="rp-designer-tool-button"
				data-rp-view="zoom-out"
				:aria-label="tr('editor.view.zoom-out')"
				@click="zoom(1 / 1.25)"
			>
				<HostIcon name="zoom-out" />
			</button>
			<output
				v-if="designStore.design !== null"
				:aria-label="tr('editor.zoom')"
			>{{ zoomPercent }}%</output>
			<button
				type="button"
				class="rp-designer-tool-button"
				data-rp-view="zoom-in"
				:aria-label="tr('editor.view.zoom-in')"
				@click="zoom(1.25)"
			>
				<HostIcon name="zoom-in" />
			</button>
			<button
				type="button"
				class="rp-designer-tool-button"
				data-rp-view="zoom-fit"
				:aria-label="tr('designer.toolbar.zoom-fit')"
				:aria-disabled="fitAriaDisabled"
				@click="fitDesign()"
			>
				<HostIcon name="maximize" />
			</button>
		</div>
		<DesignerViewMenu />
	</div>
</template>
