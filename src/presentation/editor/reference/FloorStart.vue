<script setup lang="ts">
import { nextTick } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { activateCreationEntry } from '../add/creationCatalogue';
import ReferenceAction from './ReferenceAction.vue';
import HostIcon from '../../components/HostIcon.vue';
import { useProjectStore } from '../../stores/ProjectStore';
const emit = defineEmits<{ dismiss: [] }>();
const runtime = useEditorRuntime();
const project = useProjectStore();
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
		<h2>{{ tr('editor.creation.set-up-floor', { name: project.plan?.name ?? tr('editor.floor') }) }}</h2>
		<p class="rp-floor-start__helper">
			{{ tr('editor.creation.start-help') }}
		</p>
		<button
			type="button"
			class="rp-empty-state__action"
			:aria-disabled="runtime.writesBlocked.value"
			@click="choose('rooms', $event)"
		>
			<HostIcon name="square-dashed" />
			<span class="rp-floor-start__title">{{ tr('editor.reference.rooms') }}</span>
			<span class="rp-floor-start__description">{{ tr('editor.reference.rooms-description') }}</span>
			<span class="rp-floor-start__recommended">{{ tr('editor.creation.recommended') }}</span>
		</button>
		<ReferenceAction>
			<HostIcon name="file-up" />
			<span class="rp-floor-start__title">{{ tr('editor.reference.upload') }}</span>
			<span class="rp-floor-start__description">{{ tr('editor.reference.upload-description') }}</span>
		</ReferenceAction>
		<button
			type="button"
			@click="choose('empty', $event)"
		>
			<HostIcon name="grid-2x-2" />
			<span class="rp-floor-start__title">{{ tr('editor.reference.empty') }}</span>
			<span class="rp-floor-start__description">{{ tr('editor.reference.empty-description') }}</span>
		</button>
	</div>
</template>
