<script setup lang="ts">
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
import type { ProjectWorkRow } from '../../../application/queries/schedule/ProjectWork';
import type { WorkPackage } from '../../../domain/renovation/Renovation';
import TradeResponsibility from '../../catalogue/TradeResponsibility.vue';
import { tr } from '../../i18n/strings';
defineProps<{ row: ProjectWorkRow; origin?: ProjectOrigin; blocked: boolean }>();
defineEmits<{ edit: [row: ProjectWorkRow]; open: [row: ProjectWorkRow] }>();
function progress(work: WorkPackage): string { return tr(('renovation.progress.' + work.progress) as 'renovation.progress.pending' | 'renovation.progress.in-progress' | 'renovation.progress.complete'); }
</script>
<template>
	<li
		:data-work-id="row.work.id"
		:class="{ 'is-selected': origin?.planId === row.planId && origin.workId === row.work.id }"
	>
		<h3>{{ row.work.title }}</h3>
		<p>{{ row.floor }} · {{ row.rooms.map(room => room.name ?? tr('schedule.room-missing', { id: room.id })).join(', ') }}</p>
		<p>{{ progress(row.work) }} · <TradeResponsibility :work="row.work" /></p>
		<p>{{ tr('schedule.start') }}: {{ row.work.schedule?.start ?? tr('schedule.unscheduled') }} · {{ tr('schedule.end') }}: {{ row.work.schedule?.end ?? tr('schedule.unscheduled') }}</p>
		<p v-if="row.blocking.length">
			{{ tr('renovation.blocked', { names: row.blocking.map(item => item.title).join(', ') }) }}
		</p>
		<p v-else>
			{{ tr('schedule.no-blockers') }}
		</p>
		<button
			type="button"
			:aria-disabled="blocked"
			@click="$emit('edit', row)"
		>
			{{ tr('renovation.edit.work') }}
		</button>
		<button
			type="button"
			@click="$emit('open', row)"
		>
			{{ tr('schedule.open-floor') }}
		</button>
	</li>
</template>
