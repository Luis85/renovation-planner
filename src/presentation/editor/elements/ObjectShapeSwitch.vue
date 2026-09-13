<script setup lang="ts">
/**
 * Rectangle or free-form for an item (2026-09-13 item modes spec §A), drawn in the task bar and in details:
 * two doors onto `elementTask.setShape`, which refuses on its own while the draft is busy or holds typed
 * input, so `aria-disabled` here only says what the action already does.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import { useEditorRuntime } from '../runtime';
import type { ObjectShapeMode } from './objectShape';

const task = useEditorRuntime().elementTask, draft = task.draft;
const MODES: readonly { readonly shape: ObjectShapeMode; readonly label: StringKey }[] = [
	{ shape: 'rectangle', label: 'editor.object.mode.rectangle' },
	{ shape: 'free', label: 'editor.object.mode.free' },
];
</script>

<template>
	<div
		class="rp-object-shape"
		role="group"
		:aria-label="tr('editor.object.mode')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.shape"
			type="button"
			:data-rp-object-shape="mode.shape"
			:aria-pressed="draft.shape === mode.shape"
			:aria-disabled="task.shapeLocked.value"
			@click="task.setShape(mode.shape)"
		>
			{{ tr(mode.label) }}
		</button>
	</div>
</template>
