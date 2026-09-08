<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useSelectionStore } from '../selection/selection-store';
import { tr } from '../../i18n/strings';
import { parseCoordinateMetres } from '../shell/formatLength';
import type { CanvasGroupAction } from '../selection/canvasGroupActions';
const runtime = useEditorRuntime(), selection = useSelectionStore();
const groups = runtime.groupActions, x = ref('0'), y = ref('0');
const root = ref<HTMLElement | null>(null);
const actions = computed(() => groups.actions(selection.selectedIds));
const delta = computed(() => { const dx = parseCoordinateMetres(x.value), dy = parseCoordinateMetres(y.value); return dx.ok && dy.ok ? { dx: dx.mm, dy: dy.mm } : null; });
async function move(): Promise<void> {
	if (groups.disabled.value || !delta.value || (!delta.value.dx && !delta.value.dy)) return;
	await groups.moveBy(delta.value);
}
function rotate(degrees?: number): void { if (groups.target.value) void groups.rotate(groups.target.value.id, degrees); }
async function run(action: CanvasGroupAction, event: Event): Promise<void> {
	const origin = event.currentTarget as HTMLElement, owned = origin.ownerDocument.activeElement === origin;
	const inspector = root.value?.closest<HTMLElement>('[data-rp-region="inspector"]');
	await action.run(); await nextTick();
	if (!owned || origin.isConnected || origin.ownerDocument.activeElement !== origin.ownerDocument.body) return;
	if (action.id === 'inspect') inspector?.focus();
	else inspector?.querySelector<HTMLButtonElement>('[data-rp-group-controls] button:not(:disabled)')?.focus();
}
</script>
<template>
	<section
		v-if="actions.length || groups.target.value"
		ref="root"
		class="rp-group-controls"
		data-rp-group-controls
	>
		<p v-if="groups.saved.value">
			<strong>{{ groups.saved.value.name }}</strong> · {{ tr('editor.group.saved') }}
		</p>
		<div class="rp-inline-actions">
			<button
				v-for="action in actions"
				:key="action.id"
				type="button"
				:data-rp-group-action="action.id"
				:disabled="action.disabled"
				@click="run(action, $event)"
			>
				{{ tr(action.label) }}
			</button>
		</div>
		<details v-if="groups.target.value">
			<summary>{{ tr('editor.group.transform') }}</summary>
			<p>{{ tr('editor.group.transform-hint') }}</p>
			<div class="rp-inline-actions">
				<button
					type="button"
					data-rp-group-transform="left"
					:disabled="groups.disabled.value"
					@click="rotate(-90)"
				>
					{{ tr('editor.group.left') }}
				</button>
				<button
					type="button"
					data-rp-group-transform="right"
					:disabled="groups.disabled.value"
					@click="rotate(90)"
				>
					{{ tr('editor.group.right') }}
				</button>
				<button
					type="button"
					data-rp-group-transform="rotate"
					:disabled="groups.disabled.value"
					@click="rotate()"
				>
					{{ tr('editor.input.rotate') }}
				</button>
			</div>
			<form @submit.prevent="move">
				<label class="rp-dialog-field">{{ tr('editor.group.move-x') }}<input
					v-model="x"
					name="group-dx"
					inputmode="decimal"
					:readonly="groups.disabled.value"
				></label>
				<label class="rp-dialog-field">{{ tr('editor.group.move-y') }}<input
					v-model="y"
					name="group-dy"
					inputmode="decimal"
					:readonly="groups.disabled.value"
				></label>
				<button
					type="submit"
					:disabled="groups.disabled.value || !delta || (!delta.dx && !delta.dy)"
				>
					{{ tr('editor.group.move') }}
				</button>
			</form>
		</details>
	</section>
</template>
