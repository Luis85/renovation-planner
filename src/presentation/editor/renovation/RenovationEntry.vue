<script setup lang="ts">
import { usePlanEditorContext } from '../PlanEditorContext';
const context = usePlanEditorContext();
import { useEditorRuntime } from '../runtime';
import { useRenovationSession, type RenovationMode } from './renovationSession';
import { tr } from '../../i18n/strings';
import { computed, nextTick, ref } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import RenovationNavigationButton from './RenovationNavigationButton.vue';
import HostIcon from '../../components/HostIcon.vue';
import RelatedRenovationNavigation from './RelatedRenovationNavigation.vue';
const props = defineProps<{ roomId: string; targetName?: string }>();
const runtime = useEditorRuntime(), session = useRenovationSession(), project = useProjectStore();
const roomName = computed(() => project.zones.get(props.roomId)?.name ?? props.targetName ?? tr('renovation.select-room'));
const detailVisible = computed(() => runtime.renovation.available && session.mode !== 'overview');
const semantic = computed(() => ['existing', 'work', 'planned'].includes(session.mode));
const navigationVisible = computed(() => session.mode === 'overview' || semantic.value || ['documents', 'photos', 'notes'].includes(session.mode));
function detailTitle(): string { return semantic.value ? tr(`renovation.title.${session.mode as 'existing' | 'planned' | 'work'}`, { name: roomName.value }) : tr(`renovation.${session.mode}`); }
const expanded = ref(false), opener = ref<HTMLButtonElement | null>(null);
const relatedIcon = computed(() => expanded.value ? 'chevron-up' : 'chevron-down');
const focusedRenovationOverview = computed(() => session.perspective === 'renovate' && session.mode === 'overview');
function editableStructureTarget(targetId: string): boolean {
	for (const structure of [project.structure, project.intended]) {
		if (!structure) continue;
		if ([...structure.walls, ...structure.openings, ...structure.elements ?? []].some(item => item.id === targetId)) return true;
	}
	return false;
}
const workEligible = computed(() => runtime.renovation.available && (project.zones.has(props.roomId) || editableStructureTarget(session.targetId)));
const modes = computed(() => session.mode === 'overview' && session.perspective === 'plan'
	? context.commands.planning ? ['existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes'] as const : ['existing', 'planned', 'work'] as const
	: session.mode === 'overview' ? ['existing', 'planned', 'work'] as const
	: semantic.value ? ['existing', 'work', 'planned'] as const : ['documents', 'photos', 'notes'].includes(session.mode) ? ['documents', 'photos', 'notes'] as const : [] as const);
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
async function addWork(): Promise<void> {
	if (!workEligible.value || runtime.renovation.blocked.value) return;
	const roomId = props.roomId || session.roomId;
	runtime.renovation.focus(roomId, 'work');
	await runtime.renovation.edit('work', roomId);
}
async function editLayout(): Promise<void> {
	await runtime.renovation.perspective('plan');
}
</script>
<template>
	<template v-if="detailVisible">
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
			{{ detailTitle() }}
		</h3>
	</template>
	<nav
		v-if="runtime.renovation.available"
		v-show="navigationVisible"
		class="rp-renovation-switch rp-room-navigation"
		:class="{ 'rp-room-navigation--semantic': session.mode !== 'overview' }"
		:aria-label="tr('renovation.renovate')"
	>
		<RenovationNavigationButton
			v-for="mode in modes"
			:key="mode"
			:mode="mode"
			:current="session.mode"
			@navigate="navigate"
		/>
	</nav>
	<section
		v-if="focusedRenovationOverview"
		class="rp-renovation-overview-actions"
		:aria-label="tr('renovation.work')"
	>
		<button
			v-if="workEligible"
			type="button"
			class="mod-cta"
			data-rp-action="add-work"
			:disabled="runtime.renovation.blocked.value"
			@click="addWork"
		>
			<HostIcon name="plus" />{{ tr('renovation.add.work') }}
		</button>
		<button
			type="button"
			class="rp-renovation-layout-route"
			data-rp-action="edit-layout"
			@click="editLayout"
		>
			{{ tr('editor.element.plan-geometry') }}<HostIcon name="arrow-right" />
		</button>
	</section>
	<template v-if="detailVisible">
		<button
			v-if="context.commands.planning"
			ref="opener"
			type="button"
			class="rp-related-navigation-opener"
			data-rp-room-navigation
			:aria-expanded="expanded"
			@click="expanded = !expanded"
		>
			{{ tr('renovation.summary.linked') }}<HostIcon :name="relatedIcon" />
		</button>
		<RelatedRenovationNavigation
			v-if="context.commands.planning"
			:expanded="expanded"
			:modes="relatedModes"
			@navigate="navigate"
		/>
	</template>
</template>
