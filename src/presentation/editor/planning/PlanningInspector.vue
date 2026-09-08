<script setup lang="ts">
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import MaterialsInspector from './MaterialsInspector.vue';
import CostsInspector from './CostsInspector.vue';
import EvidenceInspector from './EvidenceInspector.vue';
const planning = usePlanningContext(), session = useRenovationSession();
</script>
<template>
	<p
		v-if="planning.loading.value"
		role="status"
	>
		{{ tr('planning.loading') }}
	</p>
	<p
		v-if="planning.failed.value"
		role="alert"
	>
		{{ tr('planning.read-failed') }} <button
			type="button"
			@click="planning.refresh"
		>
			{{ tr('planning.retry') }}
		</button>
	</p>
	<template v-if="planning.baseline.value">
		<MaterialsInspector
			v-if="session.mode === 'materials'"
			:baseline="planning.baseline.value"
		/><CostsInspector
			v-else-if="session.mode === 'costs'"
			:baseline="planning.baseline.value"
		/><EvidenceInspector
			v-else
			:baseline="planning.baseline.value"
		/>
	</template>
</template>
