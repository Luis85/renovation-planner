<script setup lang="ts">
import MaterialNumbers from './MaterialNumbers.vue';
import type { materialRows } from './planningProjection';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
defineProps<{ row: ReturnType<typeof materialRows>[number] }>();
const emit = defineEmits<{ remove: [id: string] }>();
const planning = usePlanningContext(), session = useRenovationSession();
</script>
<template>
	<li
		class="rp-material-row"
		:data-rp-record="row.entity.id"
		:class="{ 'is-selected': session.focusedId === row.entity.id }"
	>
		<button
			type="button"
			class="rp-record-title"
			:aria-current="session.focusedId === row.entity.id ? 'true' : undefined"
			@click="planning.runtime.renovation.focus(session.roomId, 'materials', row.entity.id)"
		>
			{{ row.name }}
			<span v-if="session.focusedId === row.entity.id"> · {{ tr('planning.selected') }}</span>
		</button>
		<p
			v-if="row.stale"
			role="status"
		>
			{{ tr(row.refused ? 'planning.refused' : 'planning.stale') }}
		</p>
		<MaterialNumbers :row="row" />
		<div class="rp-planning-actions">
			<button
				type="button"
				:disabled="planning.blocked.value"
				@click="planning.edit('material', row.entity.id)"
			>
				{{ tr('renovation.edit') }}
			</button><button
				type="button"
				:disabled="planning.blocked.value"
				@click="planning.edit('procurement', row.entity.id)"
			>
				{{ tr('planning.procurement') }}
			</button><button
				type="button"
				@click="planning.runtime.renovation.focus(session.roomId, 'costs', row.entity.id)"
			>
				{{ tr('renovation.costs') }}
			</button><button
				type="button"
				@click="planning.runtime.renovation.focus(session.roomId, 'documents', row.entity.id)"
			>
				{{ tr('renovation.documents') }}
			</button><button
				v-if="row.source.workId"
				type="button"
				@click="planning.runtime.renovation.focus(session.roomId, 'work', row.source.workId)"
			>
				{{ tr('renovation.work') }}
			</button><button
				type="button"
				:disabled="planning.blocked.value"
				@click="emit('remove', row.entity.id)"
			>
				{{ tr('renovation.delete') }}
			</button>
		</div>
	</li>
</template>
