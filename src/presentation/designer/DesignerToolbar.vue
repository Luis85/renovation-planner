<script setup lang="ts">
/**
 * The asset designer's toolbar (design slice B5): camera mode, one button per registered
 * designer tool, undo/redo and the View menu.
 *
 * **It is the only thing that makes any of those tools reachable**, which is why the plan for
 * this increment carries a section called *Mounting is not optional* and why this component
 * exists at all: Task B5's own file list had no toolbar in it while its commit message
 * promised "a toolbar that reaches all of them". A tool absent from the one control that can
 * activate it is invisible to all four gates, because nothing is wrong with the code — design
 * slice 7's `CalibrateTool` shipped that way for two whole slices.
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
 * **Every button draws a native icon now (AD18 item 3), and its text is drawn beside that icon
 * or hidden, depending on the leaf's width.** `grep -rn "HostIcon" src/presentation/designer/`
 * answered 0 before this card, against 40 files under `src/presentation/editor/`
 * (`grep -rln`) — the measurement behind C12's "match the current Plan Editor's interaction
 * conventions". It answers THREE lines now, and one of them is this sentence: the import and the
 * element both live in `DesignerToolButton.vue`, which is the one component in this directory
 * that draws a glyph. What the width decides is spelled in `styles/designer-toolbar.css` and
 * argued there, not here; WHICH glyph each tool wears is `tools/designerToolIcons.ts`, a module
 * rather than a `const` in this file because a `<script setup>` binding is not a module export
 * and AD18 item 5's `Add` rail has to be able to import it.
 *
 * **No button here carries a `title`.** Its label is its accessible name — as visible text and
 * as `aria-label`, the same string — so a tooltip repeating it shows a sighted user nothing new
 * and may be announced twice (selection polish critique, finding 24). That reason survived
 * iconification rather than being quietly re-taken: Obsidian draws its own tooltip from
 * `aria-label`, so the icon-only state is not a state with no tooltip. The mode buttons'
 * `title`s describe a gesture, which is why `DesignerSelectionModes` keeps them. Undo and Redo
 * are ONE group, `.rp-designer-history`, which `designer.css` ends on whichever row it wraps
 * to — the `flex: 1` spacer it replaces stopped pushing once the toolbar wrapped (finding 5).
 */
import type { IconName } from 'obsidian';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { DESIGNER_TOOL_ICONS } from './tools/designerToolIcons';
import { useDesignerRuntime } from './runtime';
import { isOutlineSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';
import DesignerSelectionModes from './DesignerSelectionModes.vue';
import DesignerToolButton from './DesignerToolButton.vue';
import DesignerViewMenu from './DesignerViewMenu.vue';

const runtime = useDesignerRuntime();
const designStore = useAssetDesignStore();

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
const MODES: readonly { readonly id: ToolId | null; readonly label: StringKey; readonly icon: IconName; readonly shape: boolean }[] = [
	{ id: null, label: 'designer.toolbar.pan', icon: 'hand', shape: false },
	...Object.entries(DESIGNER_TOOL_LABELS).map(([id, label]) => {
		const entry = DESIGNER_TOOL_ICONS[id as keyof typeof DESIGNER_TOOL_ICONS];
		return { id: id as ToolId, label: label as StringKey, icon: entry.icon as IconName, shape: entry.group === 'shape' };
	}),
];

/**
 * The three runs the template draws, cut out of ONE list by index rather than filtered into
 * three — so every mode is drawn exactly once whatever the table says, which three filters
 * could not promise: a row matching two predicates would draw twice and a row matching none
 * would vanish, and vanishing is design slice 7's defect over again.
 *
 * What the slices DO assume is that the `'shape'` rows are contiguous in `DESIGNER_TOOL_LABELS`.
 * They are, and a tool moved between them would be drawn inside the shape group with nothing
 * else wrong — so `designerIconToolbar.test.ts` reads the group's membership against the table
 * rather than trusting this paragraph.
 */
const SHAPE_START = MODES.findIndex((mode) => mode.shape);
const SHAPE_END = MODES.findLastIndex((mode) => mode.shape) + 1;
const LEADING_MODES = MODES.slice(0, SHAPE_START);
const SHAPE_MODES = MODES.slice(SHAPE_START, SHAPE_END);
const TRAILING_MODES = MODES.slice(SHAPE_END);
</script>

<template>
	<div
		class="rp-designer-tools"
		role="toolbar"
		:aria-label="tr('designer.toolbar')"
	>
		<DesignerToolButton
			v-for="mode in LEADING_MODES"
			:key="mode.label"
			:label="mode.label"
			:icon="mode.icon"
			:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
			:aria-pressed="runtime.activeToolId.value === mode.id"
			@click="runtime.setTool(mode.id)"
		/>
		<div
			class="rp-designer-shape-tools"
			role="group"
			:aria-label="tr('designer.shapes.group')"
		>
			<DesignerToolButton
				v-for="mode in SHAPE_MODES"
				:key="mode.label"
				:label="mode.label"
				:icon="mode.icon"
				:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
				:aria-pressed="runtime.activeToolId.value === mode.id"
				@click="runtime.setTool(mode.id)"
			/>
		</div>
		<DesignerToolButton
			v-for="mode in TRAILING_MODES"
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
		<DesignerViewMenu />
	</div>
</template>
