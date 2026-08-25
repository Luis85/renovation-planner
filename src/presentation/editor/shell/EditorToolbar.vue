<script setup lang="ts">
/**
 * §60's toolbar region, filled by design slice 8: camera mode, select, draw-zone, and
 * undo/redo. Tool buttons mirror `EditorRuntime.activeToolId` (the reactive mirror of
 * `ToolManager`'s non-reactive pointer) and drive it through `setTool`; undo/redo go
 * through the same decorated dispatcher every other dispatch in the leaf uses, so their
 * refreshes and their history flags are the shared ones.
 *
 * Camera mode (`null`) is what slice 5 shipped: drag pans. It is a toolbar STATE here
 * rather than an `EditorTool`, for the reason `PlanCanvas.vue` states — the camera is
 * ephemeral UI, never a command.
 */
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';

const runtime = useEditorRuntime();
</script>

<template>
	<div
		class="rp-editor-toolbar"
		role="toolbar"
		:aria-label="tr('editor.toolbar')"
	>
		<button
			type="button"
			class="rp-editor-tool-button"
			:class="{ 'rp-editor-tool-active': runtime.activeToolId.value === null }"
			:aria-pressed="runtime.activeToolId.value === null"
			:title="tr('editor.toolbar.pan')"
			@click="runtime.setTool(null)"
		>
			{{ tr('editor.toolbar.pan') }}
		</button>
		<button
			type="button"
			class="rp-editor-tool-button"
			:class="{ 'rp-editor-tool-active': runtime.activeToolId.value === 'select' }"
			:aria-pressed="runtime.activeToolId.value === 'select'"
			:title="tr('editor.toolbar.select')"
			@click="runtime.setTool('select')"
		>
			{{ tr('editor.toolbar.select') }}
		</button>
		<button
			type="button"
			class="rp-editor-tool-button"
			:class="{ 'rp-editor-tool-active': runtime.activeToolId.value === 'draw-polygon' }"
			:aria-pressed="runtime.activeToolId.value === 'draw-polygon'"
			:title="tr('editor.toolbar.draw-zone')"
			@click="runtime.setTool('draw-polygon')"
		>
			{{ tr('editor.toolbar.draw-zone') }}
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
