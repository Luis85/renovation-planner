<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { parseCoordinateMetres } from '../shell/formatLength';
import { placementPoints } from '../../../domain/spatial/assetPlacement';
const runtime = useEditorRuntime(), task = runtime.elementTask.assets, draft = task.draft;
const point = computed(() => {
	const x = parseCoordinateMetres(draft.text.x), y = parseCoordinateMetres(draft.text.y);
	return x.ok && y.ok ? { x: x.mm, y: y.mm } : null;
});
const placeBlocked = computed(() => task.blocked.value || point.value === null || draft.shape === null);
function placeTyped(): void {
	if (placeBlocked.value || !point.value || !draft.shape) return;
	void task.place(placementPoints(point.value, draft.shape.facing));
}
</script>
<template>
	<section
		class="rp-element-task"
		data-rp-form="asset-place"
	>
		<h3>{{ draft.name }}</h3>
		<p>{{ tr('editor.asset.form-hint') }}</p>
		<p
			v-if="draft.error"
			role="alert"
		>
			{{ trError(draft.error) }}
		</p>
		<form @submit.prevent="placeTyped">
			<label class="rp-dialog-field">{{ tr('editor.area.x') }}<input
				v-model="draft.text.x"
				name="asset-x"
				type="text"
				inputmode="decimal"
			></label>
			<label class="rp-dialog-field">{{ tr('editor.area.y') }}<input
				v-model="draft.text.y"
				name="asset-y"
				type="text"
				inputmode="decimal"
			></label>
			<div class="rp-dialog-actions">
				<button
					type="submit"
					data-rp-action="place-asset"
					:aria-disabled="placeBlocked"
				>
					{{ tr('editor.asset.place') }}
				</button>
				<button
					type="button"
					data-rp-action="done-placing"
					@click="runtime.setTool('select')"
				>
					{{ tr('editor.asset.done') }}
				</button>
			</div>
		</form>
	</section>
</template>
