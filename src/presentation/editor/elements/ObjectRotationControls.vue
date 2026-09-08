<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { runInspectorAction } from '../shell/restoreInspectorActionFocus';
import HostIcon from '../../components/HostIcon.vue';
const props = defineProps<{ id: string }>();
const runtime = useEditorRuntime();
const target = computed(() => runtime.rotationActions.target.value);
const visible = computed(() => target.value?.id === props.id && runtime.activeToolId.value === 'select');
const hostWall = computed(() => target.value?.wall !== undefined && target.value.id !== target.value.wall.id);
const label = computed(() => tr(hostWall.value ? 'editor.rotation.host-wall' : 'editor.rotation.by'));
const blocked = computed(() => runtime.rotationActions.blocked.value || runtime.rotationActions.active.value);
function rotate(event: Event, degrees?: number): Promise<void> { return runInspectorAction(event, 'rotate-object', () => runtime.rotationActions.rotate(props.id, degrees)); }
</script>
<template>
	<div
		v-if="visible"
		class="rp-object-rotation-actions"
		:class="{ 'rp-object-rotation-actions--host': hostWall }"
		role="group"
		:aria-label="label"
	>
		<button
			type="button"
			data-rp-action="rotate-object"
			:aria-disabled="blocked"
			@click="rotate($event)"
		>
			<HostIcon name="rotate-cw" />
			{{ label }}
		</button>
		<button
			type="button"
			data-rp-action="rotate-object-left"
			:aria-label="tr('editor.rotation.counterclockwise')"
			:aria-disabled="blocked"
			@click="rotate($event, -90)"
		>
			<HostIcon name="rotate-ccw" />
			{{ tr('editor.rotation.left-quarter') }}
		</button>
		<button
			type="button"
			data-rp-action="rotate-object-right"
			:aria-label="tr('editor.rotation.clockwise')"
			:aria-disabled="blocked"
			@click="rotate($event, 90)"
		>
			<HostIcon name="rotate-cw" />
			{{ tr('editor.rotation.right-quarter') }}
		</button>
		<p
			v-if="hostWall"
			class="rp-object-rotation-hint"
		>
			{{ tr('editor.rotation.host-wall-hint') }}
		</p>
	</div>
</template>
