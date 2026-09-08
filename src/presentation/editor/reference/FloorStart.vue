<script setup lang="ts">
import { nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { activateCreationEntry } from '../add/creationCatalogue';
import ReferenceAction from './ReferenceAction.vue';
const emit = defineEmits<{ dismiss: [] }>();
const runtime = useEditorRuntime();
async function choose(choice: 'rooms' | 'empty', event: Event): Promise<void> {
 if (choice === 'rooms' && runtime.writesBlocked.value) return;
 const canvas = (event.currentTarget as HTMLElement).closest<HTMLElement>('.rp-plan-canvas') as HTMLElement;
 if (choice === 'rooms') activateCreationEntry('room', runtime); else emit('dismiss');
 await nextTick();
 if (canvas.isConnected) canvas.focus();
}
</script>
<template>
	<div
		class="rp-floor-start rp-empty-state rp-empty-state--overlay"
		data-rp-empty="floor-start"
	>
		<h2>{{ tr('editor.reference.start') }}</h2>
		<button
			type="button"
			class="rp-empty-state__action"
			:aria-disabled="runtime.writesBlocked.value"
			@click="choose('rooms', $event)"
		>
			{{ tr('editor.reference.rooms') }}
		</button>
		<ReferenceAction />
		<button
			type="button"
			@click="choose('empty', $event)"
		>
			{{ tr('editor.reference.empty') }}
		</button>
	</div>
</template>
