<script setup lang="ts">
import MaterialNumbers from './MaterialNumbers.vue';
import type { materialRows } from './planningProjection';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import { ref } from 'vue';
import { formatPlanningNumber } from '../../i18n/planningFormat';
defineProps<{ row: ReturnType<typeof materialRows>[number]; number: number }>();
const emit = defineEmits<{ remove: [id: string] }>();
const planning = usePlanningContext(), session = useRenovationSession();
const expanded = ref(false);
</script>
<template>
	<tbody
		class="rp-material-row"
		:data-rp-record="row.entity.id"
		:class="{ 'is-selected': session.focusedId === row.entity.id }"
	>
		<tr>
			<th scope="row">
				<div class="rp-material-identity">
					<span
						class="rp-material-number"
					>{{ number }}. </span>
					<button
						type="button"
						class="rp-record-title"
						:aria-current="session.focusedId === row.entity.id ? 'true' : undefined"
						@click="planning.runtime.renovation.focus(session.roomId, 'materials', row.entity.id)"
					>
						{{ row.name }}
						<span v-if="session.focusedId === row.entity.id"> · {{ tr('planning.selected') }}</span>
					</button>
					<button
						type="button"
						class="rp-material-disclosure"
						data-rp-material-details
						:aria-label="tr('planning.material-details', { name: row.name })"
						:aria-expanded="expanded"
						@click="expanded = !expanded"
					>
						<span aria-hidden="true">{{ expanded ? '−' : '⋯' }}</span>
					</button>
				</div>
				<p
					v-if="row.stale"
					role="status"
				>
					{{ tr(row.refused ? 'planning.refused' : 'planning.stale') }}
				</p>
			</th>
			<td>
				{{ formatPlanningNumber(row.needed) }} {{ row.entity.unit }}
				<span class="rp-material-quantity-source">{{ tr(row.entity.quantity.override || row.source.rule === 'manual' ? 'planning.manual-badge' : 'planning.calculated-badge') }}</span>
			</td>
			<td>{{ formatPlanningNumber(row.procurement?.purchased || '0') }} {{ row.entity.unit }}</td>
		</tr>
		<tr
			v-show="expanded"
			class="rp-material-detail-row"
		>
			<td colspan="3">
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
			</td>
		</tr>
	</tbody>
</template>
