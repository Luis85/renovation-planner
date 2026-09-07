<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { usePlanEditorContext } from '../PlanEditorContext';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import RenovationLinkedSummary from './RenovationLinkedSummary.vue';
import { useReviewPresentation } from './useReviewPresentation';
import ReviewRoomDetails from './ReviewRoomDetails.vue';

const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const context = usePlanEditorContext();
const { floor, rows } = useReviewPresentation();
const changes = computed(() => {
	const value = floor.value?.plannedChanges;
	return value && value.state !== 'unavailable' ? String(value.value) : tr('editor.selection.unknown');
});
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
					:data-rp-review-number="room.markerNumber ?? undefined"
					:aria-pressed="selected?.id === room.id"
					@click="runtime.selectAndFrame(room.id)"
				>
					<span
						v-if="room.markerNumber"
						class="rp-review-room-number"
					>{{ room.markerNumber }}</span>
					<HostIcon
						v-else
						:name="room.icon"
					/>
					<span class="rp-review-room__name">{{ room.name }}</span>
					<span class="rp-review-room__changes">{{ tr('renovation.summary.change-count', { count: String(room.changes) }) }}</span>
					<span class="rp-review-room__status">{{ room.status }}</span>
				</button>
			</li>
		</ul>
		<ReviewRoomDetails
			v-if="selected"
			:room="selected"
		/>
	</section>
</template>
