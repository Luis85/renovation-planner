<script setup lang="ts">
/** Project return, floor context, perspectives, and the shared history controls. */
import { nextTick } from 'vue';
import type { Perspective } from '../renovation/renovationSession';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useRenovationSession } from '../renovation/renovationSession';
import { usePlanEditorContext } from '../PlanEditorContext';
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_PERSPECTIVE_ICONS } from '../editorIcons';
import EditorViewMenu from './EditorViewMenu.vue';

const runtime = useEditorRuntime();
const session = useRenovationSession();
const context = usePlanEditorContext();
const { project, plan } = storeToRefs(useProjectStore());
const perspectives: readonly Perspective[] = ['plan', 'renovate', 'review'];
async function switchPerspective(event: KeyboardEvent, current: Perspective): Promise<void> {
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
	const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
	if (!delta && event.key !== 'Home' && event.key !== 'End') return;
	event.preventDefault();
	const index = event.key === 'Home' ? 0 : event.key === 'End' ? perspectives.length - 1 : (perspectives.indexOf(current) + delta + perspectives.length) % perspectives.length;
	const next = perspectives[index];
	const group = (event.currentTarget as HTMLElement).parentElement;
	await runtime.renovation.perspective(next);
	await nextTick();
	group?.querySelector<HTMLElement>(`[data-rp-perspective="${session.perspective}"]`)?.focus();
}
</script>

<template>
	<header
		class="rp-context-bar"
		:aria-label="tr('editor.context-bar')"
	>
		<div class="rp-context-bar__crumbs">
			<button
				v-if="project?.name && context.navigation"
				type="button"
				class="rp-context-bar__crumb rp-context-bar__button"
				data-rp-open-project
				@click="context.navigation.project(project.id)"
			>
				{{ project.name }}
			</button>
			<span
				v-else-if="project?.name"
				class="rp-context-bar__crumb"
			>{{ project.name }}</span>
			<span
				v-if="plan?.name"
				class="rp-context-bar__crumb"
			>{{ plan.name }}</span>
		</div>
		<slot name="perspective" />
		<div
			v-if="runtime.renovation.available"
			class="rp-renovation-switch"
			role="radiogroup"
			:aria-label="tr('editor.shell.perspectives')"
		>
			<button
				v-for="perspective in perspectives"
				:key="perspective"
				class="rp-perspective-button"
				:data-rp-perspective="perspective"
				type="button"
				role="radio"
				:aria-checked="session.perspective === perspective"
				:tabindex="session.perspective === perspective ? 0 : -1"
				@keydown="switchPerspective($event, perspective)"
				@click="runtime.renovation.perspective(perspective)"
			>
				<HostIcon :name="EDITOR_PERSPECTIVE_ICONS[perspective]" />{{ tr(`renovation.${perspective}`) }}
			</button>
		</div>
		<span class="rp-context-bar__spacer" />
		<button
			v-if="session.perspective !== 'review'"
			type="button"
			class="rp-context-bar__button"
			data-rp-action="undo"
			:disabled="!runtime.canUndo.value"
			@click="runtime.undo()"
		>
			<HostIcon name="undo-2" />{{ tr('editor.context.undo') }}
		</button>
		<button
			v-if="session.perspective !== 'review'"
			type="button"
			class="rp-context-bar__button"
			data-rp-action="redo"
			:disabled="!runtime.canRedo.value"
			@click="runtime.redo()"
		>
			<HostIcon name="redo-2" />{{ tr('editor.context.redo') }}
		</button>
		<EditorViewMenu />
		<button
			type="button"
			class="rp-context-bar__button rp-focus-leaf"
			@click="context.focusLeaf()"
		>
			<HostIcon name="panels-top-left" />{{ tr('editor.unsupported-width.action') }}
		</button>
	</header>
</template>
