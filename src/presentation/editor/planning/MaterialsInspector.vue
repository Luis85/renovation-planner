<script setup lang="ts">
import { inRenovationScope } from '../renovation/renovationSummary';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import MaterialRow from './MaterialRow.vue';
import { computed, onBeforeUnmount, ref } from 'vue';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { materialRows, shoppingBody } from './planningProjection';
import { tr } from '../../i18n/strings';
import { useDialogStore } from '../../dialogs/dialog-store';
import { materialReferents } from '../../../application/commands/renovation/planningLinks';
const props = defineProps<{ baseline: PlanningBaseline }>();
const planning = usePlanningContext(), session = useRenovationSession(), dialogs = useDialogStore(), error = ref(''), generating = ref(false);
let alive = true; onBeforeUnmount(() => { alive = false; });
const rows = computed(() => materialRows(props.baseline).filter(item => inRenovationScope({ roomId: item.entity.origin.zoneId, targetId: item.source.targetId }, session.roomId, session.targetId)));
const groups = computed(() => [...new Set(rows.value.map(item => item.source.workId))].map(id => ({ id, name: props.baseline.plan.entity.renovation?.work.find(item => item.id === id)?.title ?? tr('planning.unassigned'), rows: rows.value.filter(item => item.source.workId === id) })));
async function remove(id: string): Promise<void> {
	const baseline = props.baseline;
	if (planning.blocked.value || dialogs.current) return;
	const links = materialReferents(baseline.plan.entity.renovation?.depth, id);
	if (links.length) { error.value = `${tr('planning.resolve-links')} ${links.join(', ')}`; return; }
	if (await dialogs.openDialog({ kind: 'confirm', title: tr('renovation.delete'), message: id }) !== 'confirm' || !alive) return;
	const command = planning.context.commands.planning?.material(baseline, { deleteId: id }, planning.runtime.structureTask.ledger);
	if (command) { const result = await planning.runtime.dispatcher.run(command); if (alive && !result.ok) error.value = tr('planning.write-failed'); }
}
async function shopping(): Promise<void> {
	if (generating.value || planning.blocked.value) return;
	const body = shoppingBody(props.baseline);
	if (body === null) { error.value = tr('planning.stale'); return; }
	generating.value = true;
	try { const result = await planning.context.commands.shoppingNote?.(props.baseline.plan.entity.id, `# ${tr('planning.shopping')}\n\n${body}\n`); if (alive && result && !result.ok) error.value = tr('planning.write-failed'); }
	finally { generating.value = false; }
}
</script>
<template>
	<button
		type="button"
		:disabled="planning.blocked.value"
		data-rp-new-material
		@click="planning.edit('material')"
	>
		{{ tr('planning.edit.material') }}
	</button>
	<button
		v-if="planning.context.navigation"
		type="button"
		data-rp-open-library
		@click="planning.context.navigation.library()"
	>
		{{ tr('planning.open-library') }}
	</button>
	<details>
		<summary>{{ tr('planning.procurement') }}</summary>
		<p>{{ tr('planning.procurement-policy') }}</p>
	</details>
	<section
		v-for="group in groups"
		:key="group.id"
		class="rp-planning-group"
	>
		<h4>{{ group.name }}</h4>
		<ol class="rp-renovation-list">
			<MaterialRow
				v-for="row in group.rows"
				:key="row.entity.id"
				:row="row"
				@remove="remove"
			/>
		</ol>
	</section>
	<p v-if="!rows.length">
		{{ tr('renovation.empty') }}
	</p>
	<button
		v-if="planning.context.commands.shoppingNote"
		type="button"
		:disabled="planning.blocked.value || generating"
		@click="shopping"
	>
		{{ tr('planning.shopping') }}
	</button>
	<p
		v-if="error"
		role="alert"
	>
		{{ error }}
	</p>
</template>
