<script setup lang="ts">
/**
 * M00's context bar: where the user is (`Project › Floor`, text — ADR-0017 gives it two
 * segments and no tree) and the two history actions. No perspective switch: only Plan has
 * content, and a switch with two dead options is the control-that-does-nothing slice 14
 * refuses; the `<slot name="perspective" />` is where one lands when a second perspective has
 * something to show. Undo/redo dispatch through the same decorated dispatcher every other
 * dispatch in the leaf uses (`runtime.undo`/`redo`).
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';

const runtime = useEditorRuntime();
const { project, plan } = storeToRefs(useProjectStore());
const crumbs = computed(() => [project.value?.name ?? '', plan.value?.name ?? ''].filter((c) => c !== ''));
</script>

<template>
	<header
		class="rp-context-bar"
		:aria-label="tr('editor.context-bar')"
	>
		<nav
			class="rp-context-bar__crumbs"
			:aria-label="tr('editor.context-bar')"
		>
			<span
				v-for="(crumb, index) in crumbs"
				:key="index"
				class="rp-context-bar__crumb"
			>{{ crumb }}</span>
		</nav>
		<slot name="perspective" />
		<span class="rp-context-bar__spacer" />
		<button
			type="button"
			class="rp-context-bar__button"
			data-rp-action="undo"
			:disabled="!runtime.canUndo.value"
			@click="runtime.undo()"
		>
			{{ tr('editor.context.undo') }}
		</button>
		<button
			type="button"
			class="rp-context-bar__button"
			data-rp-action="redo"
			:disabled="!runtime.canRedo.value"
			@click="runtime.redo()"
		>
			{{ tr('editor.context.redo') }}
		</button>
	</header>
</template>
