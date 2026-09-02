<script setup lang="ts">
/**
 * §60's toolbar region: camera mode plus one button per registered `EditorTool` — the
 * `MODES` table below is what makes registering the next tool a row rather than a fourth
 * near-identical block, so this comment states that rule instead of enumerating today's
 * tools, which the next tool would leave stale. Tool buttons mirror
 * `EditorRuntime.activeToolId` (the reactive mirror of `ToolManager`'s non-reactive
 * pointer) and drive it through `setTool`; undo/redo go through the same decorated
 * dispatcher every other dispatch in the leaf uses, so their refreshes and their history
 * flags are the shared ones.
 *
 * Camera mode (`null`) is what slice 5 shipped: drag pans. It is a toolbar STATE here
 * rather than an `EditorTool`, for the reason `EditorSurface.vue` states — the camera is
 * ephemeral UI, never a command.
 */
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { ToolId } from '../tools/editor-tool';

const runtime = useEditorRuntime();

/**
 * The mode buttons as DATA, one row per selectable mode — `null` being camera mode.
 *
 * A table rather than three near-identical ten-line `<button>` blocks: each block repeated
 * its own id in three places (the class test, the `aria-pressed` test and the click), and
 * a mismatch between the first two is a real accessibility defect that valid ARIA hides
 * from the axe-core suite. Registering the next tool is now a row.
 *
 * `StringKey` keeps it type-checked: a label key the string table does not declare fails
 * `npm run build`, exactly as a `tr(...)` call in a template does.
 */
const MODES: readonly { readonly id: ToolId | null; readonly label: StringKey }[] = [
	{ id: null, label: 'editor.toolbar.pan' },
	{ id: 'select', label: 'editor.toolbar.select' },
	{ id: 'draw-polygon', label: 'editor.toolbar.draw-zone' },
	{ id: 'calibrate', label: 'editor.toolbar.calibrate' },
];
</script>

<template>
	<div
		class="rp-editor-toolbar"
		role="toolbar"
		:aria-label="tr('editor.toolbar')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.label"
			type="button"
			class="rp-editor-tool-button"
			:class="{ 'rp-editor-tool-active': runtime.activeToolId.value === mode.id }"
			:aria-pressed="runtime.activeToolId.value === mode.id"
			:title="tr(mode.label)"
			@click="runtime.setTool(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
		<span class="rp-editor-toolbar-spacer" />
		<button
			type="button"
			class="rp-editor-tool-button"
			:disabled="!runtime.canUndo.value"
			:title="tr('editor.toolbar.undo')"
			@click="runtime.undo()"
		>
			{{ tr('editor.toolbar.undo') }}
		</button>
		<button
			type="button"
			class="rp-editor-tool-button"
			:disabled="!runtime.canRedo.value"
			:title="tr('editor.toolbar.redo')"
			@click="runtime.redo()"
		>
			{{ tr('editor.toolbar.redo') }}
		</button>
	</div>
</template>
