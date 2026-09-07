<script setup lang="ts">
import { computed } from 'vue';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useFloorSummary } from '../shell/useFloorSummary';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { usePlanEditorContext } from '../PlanEditorContext';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import TransformationSummary from './TransformationSummary.vue';
import RenovationLinkedSummary from './RenovationLinkedSummary.vue';
import { renovationSummary } from './renovationSummary';

const props = defineProps<{ findings: readonly { roomId: string }[]; available: boolean }>();
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const context = usePlanEditorContext(), floor = useFloorSummary();
const changes = computed(() => {
	const value = floor.value?.plannedChanges;
	return value && value.state !== 'unavailable' ? String(value.value) : tr('editor.selection.unknown');
});
const complete = computed(() => props.available && !project.stale && project.unreadableZones === 0);
const rows = computed(() => (floor.value?.rooms ?? []).map(room => {
	const count = props.findings.filter(item => item.roomId === room.id).length;
	return { ...room, changes: renovationSummary(project.plan?.renovation ?? EMPTY_RENOVATION, room.id).changes,
		status: !complete.value ? tr('renovation.review.unavailable') : count ? tr('renovation.summary.open', { count: String(count) }) : tr('renovation.review.no-room-findings'),
		icon: !complete.value ? 'clipboard-list' : count ? 'triangle-alert' : 'circle-check' };
}));
const selected = computed(() => rows.value.find(room => room.id === selection.focusedId));
</script>

<template>
	<section
		v-if="floor"
		class="rp-review-summary"
		:aria-label="tr('renovation.review')"
	>
		<p class="rp-review-summary__counts">
			{{ tr('renovation.review.room-count', { count: String(floor.rooms.length) }) }} ·
			{{ tr('renovation.summary.change-count', { count: changes }) }}
		</p>
		<p v-if="project.unreadableZones > 0">
			{{ tr('editor.inspector.partial', { count: String(project.unreadableZones) }) }}
		</p>
		<RenovationLinkedSummary v-if="context.commands.planning" />
		<ul class="rp-review-rooms">
			<li
				v-for="room in rows"
				:key="room.id"
			>
				<button
					type="button"
					:data-rp-review-room="room.id"
					:aria-pressed="selected?.id === room.id"
					@click="runtime.selectAndFrame(room.id)"
				>
					<HostIcon :name="room.icon" />
					<span class="rp-review-room__name">{{ room.name }}</span>
					<span class="rp-review-room__changes">{{ tr('renovation.summary.change-count', { count: String(room.changes) }) }}</span>
					<span class="rp-review-room__status">{{ room.status }}</span>
				</button>
			</li>
		</ul>
		<div v-if="selected">
			<h4>{{ selected.name }}</h4>
			<TransformationSummary :room-id="selected.id" />
			<RenovationLinkedSummary v-if="context.commands.planning" :room-id="selected.id" />
			<button
				type="button"
				class="mod-cta"
				data-rp-action="review-open-room"
				@click="runtime.renovation.focus(selected.id, 'overview')"
			>
				{{ tr('renovation.review.open-room', { name: selected.name }) }}<HostIcon name="arrow-right" />
			</button>
		</div>
	</section>
</template>
