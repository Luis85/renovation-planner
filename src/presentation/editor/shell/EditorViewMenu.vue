<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useEditorRuntime } from '../runtime';
import { usePlanFrame } from '../viewport/usePlanFrame';
import { screenPoint } from '../viewport/Viewport';

const editor = useEditorStore(), workspace = useWorkspaceStore();
const runtime = useEditorRuntime();
const framedBounds = usePlanFrame();
const disclosure = ref<HTMLDetailsElement | null>(null);
const hasFloor = computed(() => framedBounds(true) !== null);
const hasSelection = computed(() => framedBounds(false) !== null);
function blocked(): boolean { return runtime.toolManager.gestureInFlight || editor.dragState !== null; }
function fit(all: boolean): void {
	if (blocked()) return;
	const bounds = framedBounds(all);
	if (bounds !== null) editor.fitTo(bounds, editor.stageSize);
}
function zoom(factor: number): void {
	if (blocked()) return;
	editor.zoomByFactor(screenPoint(editor.stageSize.width / 2, editor.stageSize.height / 2), factor);
}
function toggleSnap(event: Event): void {
	const input = event.target as HTMLInputElement;
	if (!blocked()) editor.snappingEnabled = input.checked;
	input.checked = editor.snappingEnabled;
}
/** A press anywhere else closes the menu, in CAPTURE so the canvas's own `.stop` cannot hide it (as `AddMenu` does). */
function outside(event: Event): void {
	const menu = disclosure.value as HTMLDetailsElement;
	if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
}
onMounted(() => document.addEventListener('pointerdown', outside, { capture: true }));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, { capture: true }));
function escape(event: KeyboardEvent): void {
	if (event.key !== 'Escape') return;
	event.stopPropagation();
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !disclosure.value) return;
	event.preventDefault();
	disclosure.value.open = false;
	disclosure.value.querySelector('summary')?.focus();
}
</script>

<template>
	<details
		ref="disclosure"
		class="rp-view-menu"
		@keydown="escape"
	>
		<summary class="rp-context-bar__button">
			{{ tr('editor.view') }}
		</summary>
		<div class="rp-view-menu__content">
			<button
				type="button"
				:disabled="!hasFloor"
				data-rp-view="floor"
				@click="fit(true)"
			>
				{{ tr('editor.view.fit-floor') }} <kbd>F</kbd>
			</button>
			<button
				type="button"
				:disabled="!hasSelection"
				data-rp-view="selection"
				@click="fit(false)"
			>
				{{ tr('editor.view.fit-selection') }} <kbd>⇧2</kbd>
			</button>
			<div class="rp-view-menu__zoom">
				<button
					type="button"
					data-rp-view="zoom-out"
					:aria-label="tr('editor.view.zoom-out')"
					@click="zoom(1 / 1.25)"
				>
					−
				</button>
				<output :aria-label="tr('editor.zoom')">{{ Math.round(editor.viewport.zoom * 100) }}%</output>
				<button
					type="button"
					data-rp-view="zoom-in"
					:aria-label="tr('editor.view.zoom-in')"
					@click="zoom(1.25)"
				>
					+
				</button>
			</div>
			<label><input
				v-model="workspace.gridVisible"
				type="checkbox"
				data-rp-view="grid"
			>{{ tr('editor.view.grid') }}</label>
			<label><input
				v-model="workspace.northVisible"
				type="checkbox"
				data-rp-view="north"
			>{{ tr('editor.view.north') }}</label>
			<label><input
				:checked="editor.snappingEnabled"
				type="checkbox"
				data-rp-view="snap"
				@change="toggleSnap"
			>{{ tr('editor.view.snap') }}</label>
			<p>{{ tr('editor.view.snap-hint') }}</p>
		</div>
	</details>
</template>
