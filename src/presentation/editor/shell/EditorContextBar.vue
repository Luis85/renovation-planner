<script setup lang="ts">
/** Project return, floor context, perspectives, and the shared history controls. */
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useRenovationSession } from '../renovation/renovationSession';
import { usePlanEditorContext } from '../PlanEditorContext';
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_PERSPECTIVE_ICONS } from '../editorIcons';

const runtime = useEditorRuntime();
const session = useRenovationSession();
const context = usePlanEditorContext();
const { project, plan } = storeToRefs(useProjectStore());
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
		<nav
			v-if="runtime.renovation.available"
			class="rp-renovation-switch"
			:aria-label="tr('renovation.plan')"
		>
			<button
				v-for="perspective in ['plan', 'renovate', 'review'] as const"
				:key="perspective"
				class="rp-perspective-button"
				:data-rp-perspective="perspective"
				type="button"
				:aria-pressed="session.perspective === perspective"
				@click="runtime.renovation.perspective(perspective)"
			>
				<HostIcon :name="EDITOR_PERSPECTIVE_ICONS[perspective]" />{{ tr(`renovation.${perspective}`) }}
			</button>
		</nav>
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
	</header>
</template>
