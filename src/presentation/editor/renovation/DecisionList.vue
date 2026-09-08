<script setup lang="ts">
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import type { RenovationDecision } from '../../../domain/renovation/Renovation';
import { tr } from '../../i18n/strings';
defineProps<{ decisions: readonly RenovationDecision[] }>();
const emit = defineEmits<{ remove: [id: string, name: string] }>();
const actions = useEditorRuntime().renovation, session = useRenovationSession();
</script>
<template>
	<section v-if="session.mode === 'planned' && decisions.length">
		<h4>{{ tr('renovation.question') }}</h4>
		<div
			v-for="item in decisions"
			:key="item.id"
			:data-rp-record="item.id"
		>
			<button
				type="button"
				data-rp-action="decision-record"
				@click="actions.edit('decision', item.roomId, item.id)"
			>
				{{ item.resolved ? tr('renovation.resolved') : tr('renovation.finding.decision') }}: {{ item.question }}
			</button>
			<p>{{ item.resolution }}</p>
			<button
				type="button"
				:disabled="actions.blocked.value"
				@click="emit('remove', item.id, item.question)"
			>
				{{ tr('renovation.delete') }}
			</button>
		</div>
	</section>
</template>
