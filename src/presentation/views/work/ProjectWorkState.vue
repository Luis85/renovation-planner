<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import { useRenovationProjectContext } from '../RenovationProjectContext';
import { useProjectWorkRead } from './projectWorkRead';
import { useProjectWorkActions } from './projectWorkActions';
import { useDialogStore } from '../../dialogs/dialog-store';
import NamedCatalogueForm from '../../catalogue/NamedCatalogueForm.vue';
import ProjectWorkToolbar from './ProjectWorkToolbar.vue';
import ProjectWorkRow from './ProjectWorkRow.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { SAVE_STATE_KEYS } from '../../editor/save-state/save-state';
const props = defineProps<{ projectId: string }>();
const context = useRenovationProjectContext(), dialogs = useDialogStore();
const read = useProjectWorkRead(context.work, props.projectId), actions = useProjectWorkActions(context, read);
const filter = ref('all');
const floors = computed(() => Array.from(new Map(read.data.value?.rows.map(row => [row.planId, row.floor])).entries()));
const rows = computed(() => read.data.value?.rows.filter(row => filter.value === 'all' || row.planId === filter.value) ?? []);
const saveLabel = computed(() => tr(actions.save.state === 'saved' && read.error.value ? 'save-state.saved-refresh-needed' : SAVE_STATE_KEYS[actions.save.state]));
let alive = true;
onBeforeUnmount(() => { alive = false; });
async function createTrade(): Promise<void> {
 if (actions.blocked.value || dialogs.current || !context.work) return;
 const busy = ref(false);
 await dialogs.openDialog({ kind: 'form', title: tr('trade.add'), component: markRaw(NamedCatalogueForm), busy,
  props: { kind: 'trade', busy, create: context.work.trades.create } });
 if (alive) await read.refresh();
}
</script>
<template>
	<section
		class="rp-project-work rp-project-detail rp-project-downstream"
		:aria-label="tr('schedule.title')"
	>
		<header class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="context.navigate(projectId)"
			>
				{{ tr('view.project.prices-back') }}
			</button>
			<h2 class="rp-project-detail__name">
				{{ read.data.value?.project.name }} · {{ tr('schedule.title') }}
			</h2>
			<button
				v-if="context.origin"
				type="button"
				class="rp-project-detail__open-note"
				@click="context.openPlan(context.origin.planId, context.origin)"
			>
				{{ tr('schedule.return') }}
			</button>
			<span role="status">{{ saveLabel }}</span>
		</header>
		<div class="rp-project-detail__body">
			<p>{{ tr('schedule.scope') }}</p>
			<p
				v-if="read.error.value"
				role="alert"
			>
				{{ trError(read.error.value) }}
			</p>
			<p
				v-if="read.loading.value"
				role="status"
			>
				{{ tr('view.project.loading') }}
			</p>
			<p
				v-if="actions.save.unrecoveredWrite"
				role="alert"
			>
				{{ tr('schedule.unrecovered') }}
			</p>
			<button
				v-if="read.error.value"
				type="button"
				class="rp-project-downstream__retry"
				@click="read.refresh"
			>
				{{ tr('view.project.resume-retry') }}
			</button>
			<template v-if="read.data.value">
				<p
					v-if="read.data.value.unreadablePlans"
					role="status"
				>
					{{ tr('view.project.some-plans-unreadable', { count: String(read.data.value.unreadablePlans) }) }}
				</p>
				<p
					v-if="read.data.value.roomsIncomplete"
					role="status"
				>
					{{ tr('schedule.rooms-incomplete') }}
				</p>
				<ProjectWorkToolbar
					v-model="filter"
					:floors="floors"
					:blocked="actions.blocked.value"
					:can-undo="actions.canUndo.value"
					:can-redo="actions.canRedo.value"
					@step="actions.step"
					@create-trade="createTrade"
				/>
				<p v-if="!rows.length">
					{{ tr('schedule.empty') }}
				</p>
				<ol class="rp-project-work__rows">
					<ProjectWorkRow
						v-for="row in rows"
						:key="row.planId + ':' + row.work.id"
						:row="row"
						:origin="context.origin"
						:blocked="actions.blocked.value"
						@edit="actions.edit"
						@open="actions.open"
					/>
				</ol>
			</template>
		</div>
	</section>
</template>
