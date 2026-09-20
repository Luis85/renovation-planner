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
 * **Every button draws a native icon now (AD18 item 3), and its text is drawn beside that icon
 * or hidden, depending on the leaf's width.** `grep -rn "HostIcon" src/presentation/designer/`
 * answered 0 before this card, against 40 files under `src/presentation/editor/`
 * (`grep -rln`) — the measurement behind C12's "match the current Plan Editor's interaction
 * conventions". It answers THREE lines now, and one of them is this sentence: the import and the
 * element both live in `DesignerToolButton.vue`, which is the one component in this directory
 * that draws a glyph. What the width decides FOR THIS TOOLBAR is spelled in
 * `styles/designer-toolbar.css` and argued there, not here — and it decides nothing for the
 * `Add` rail, which hides its labels at every width in `styles/designer-add.css` for a reason of
 * its own. WHICH glyph each tool wears is `tools/designerToolIcons.ts`, a module rather than a
 * `const` in this file because a `<script setup>` binding is not a module export and AD18 item
 * 5's `Add` rail has to be able to import it — which, since this card, it does.
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
		<DesignerViewMenu />
	</div>
</template>
