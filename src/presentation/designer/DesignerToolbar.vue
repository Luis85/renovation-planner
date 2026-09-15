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
 * **No button here carries a `title`.** Each one's text IS its accessible name, so a tooltip repeating
 * it shows a sighted user nothing new and may be announced twice (selection polish critique, finding 24).
 * The mode buttons' `title`s describe a gesture, which is why `DesignerSelectionModes` keeps them. Undo and
 * Redo are ONE group, `.rp-designer-history`, which `designer.css` ends on whichever row it wraps to — the
 * `flex: 1` spacer it replaces stopped pushing once the toolbar wrapped (finding 5).
 */
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { useDesignerRuntime } from './runtime';
import { isOutlineSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';
import DesignerSelectionModes from './DesignerSelectionModes.vue';
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
const MODES: readonly { readonly id: ToolId | null; readonly label: StringKey }[] = [
	{ id: null, label: 'designer.toolbar.pan' },
	...Object.entries(DESIGNER_TOOL_LABELS).map(([id, label]) => ({ id: id as ToolId, label: label as StringKey })),
];
</script>

<template>
	<div
		class="rp-designer-tools"
		role="toolbar"
		:aria-label="tr('designer.toolbar')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.label"
			type="button"
			class="rp-designer-tool-button"
			:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
			:aria-pressed="runtime.activeToolId.value === mode.id"
			@click="runtime.setTool(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
		<DesignerSelectionModes v-if="runtime.activeToolId.value === 'select' && isOutlineSelection(designStore.selection)" />
		<div class="rp-designer-history">
			<button
				type="button"
				class="rp-designer-tool-button"
				:disabled="!runtime.canUndo.value"
				@click="runtime.undo()"
			>
				{{ tr('designer.toolbar.undo') }}
			</button>
			<button
				type="button"
				class="rp-designer-tool-button"
				:disabled="!runtime.canRedo.value"
				@click="runtime.redo()"
			>
				{{ tr('designer.toolbar.redo') }}
			</button>
		</div>
		<DesignerViewMenu />
	</div>
</template>
