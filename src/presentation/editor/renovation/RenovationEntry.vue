<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession, type RenovationMode } from './renovationSession';
import { tr } from '../../i18n/strings';
import { computed, nextTick, ref } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import HostIcon from '../../components/HostIcon.vue';
import RoomNavigation from './RoomNavigation.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';
const props = defineProps<{ roomId: string }>();
const runtime = useEditorRuntime(), session = useRenovationSession(), project = useProjectStore();
const roomName = computed(() => project.zones.get(props.roomId)?.name ?? tr('renovation.select-room'));
const semantic = computed(() => ['existing', 'work', 'planned'].includes(session.mode));
const expanded = ref(false), opener = ref<HTMLButtonElement | null>(null);
/** The breadcrumb, the title and the linked navigation all belong to a mode other than the overview. */
const detail = computed(() => runtime.renovation.available && session.mode !== 'overview');
const planning = computed(() => context.commands.planning);
const chevron = computed(() => expanded.value ? 'chevron-up' : 'chevron-down');
const title = computed(() => semantic.value ? tr(`renovation.title.${session.mode as 'existing' | 'planned' | 'work'}`, { name: roomName.value }) : tr(`renovation.${session.mode}`));
const relatedModes = computed(() => ['documents', 'photos', 'notes'].includes(session.mode) ? ['materials', 'costs'] as const : ['materials', 'costs', 'documents', 'photos', 'notes'] as const);
async function navigate(mode: RenovationMode, event: Event): Promise<void> {
	const button = event.currentTarget as HTMLElement;
	const inspector = button.closest<HTMLElement>('[data-rp-region="inspector"]');
	runtime.renovation.focus(props.roomId, mode);
	expanded.value = false;
	await nextTick();
	if (!inspector?.isConnected) return;
	if (button.isConnected && button.classList.contains('rp-room-navigation__button')) button.focus();
	else (opener.value ?? inspector).focus();
}
</script>
<template>
	<template v-if="detail">
		<div class="rp-room-breadcrumb">
			<button
				type="button"
				data-rp-mode="overview"
				@click="navigate('overview', $event)"
			>
				{{ roomName }}
			</button>
			<HostIcon name="chevron-right" />
			<span>{{ tr(`renovation.${session.mode}`) }}</span>
		</div>
		<h3 class="rp-room-detail-title">
			{{ title }}
		</h3>
	</template>
	<RoomNavigation
		v-if="runtime.renovation.available"
		@navigate="navigate"
	/>
	<template v-if="detail">
		<button
			v-if="planning"
			ref="opener"
			type="button"
			class="rp-related-navigation-opener"
			data-rp-room-navigation
			:aria-expanded="expanded"
			@click="expanded = !expanded"
		>
			{{ tr('renovation.summary.linked') }}<HostIcon :name="chevron" />
		</button>
		<nav
			v-if="planning"
			v-show="expanded"
			class="rp-related-navigation"
			:aria-label="tr('renovation.summary.linked')"
		>
			<button
				v-for="mode in relatedModes"
				:key="mode"
				type="button"
				:data-rp-mode="mode"
				@click="navigate(mode, $event)"
			>
				<HostIcon :name="EDITOR_MODE_ICONS[mode]" />{{ tr(`renovation.${mode}`) }}
			</button>
		</nav>
	</template>
</template>
