<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import { useRenovationProjectContext } from '../RenovationProjectContext';
import { useProjectWorkRead } from './projectWorkRead';
import { useProjectWorkActions } from './projectWorkActions';
import { useDialogStore } from '../../dialogs/dialog-store';
import NamedCatalogueForm from '../../catalogue/NamedCatalogueForm.vue';
import TradeResponsibility from '../../catalogue/TradeResponsibility.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { SAVE_STATE_KEYS } from '../../editor/save-state/save-state';
import type { WorkPackage } from '../../../domain/renovation/Renovation';
const props = defineProps<{ projectId: string }>();
const context = useRenovationProjectContext(), dialogs = useDialogStore();
const read = useProjectWorkRead(context.work, props.projectId), actions = useProjectWorkActions(context, read);
const filter = ref('all');
const floors = computed(() => Array.from(new Map(read.data.value?.rows.map(row => [row.planId, row.floor])).entries()));
const rows = computed(() => read.data.value?.rows.filter(row => filter.value === 'all' || row.planId === filter.value) ?? []);
const saveLabel = computed(() => tr(actions.save.state === 'saved' && read.error.value ? 'save-state.saved-refresh-needed' : SAVE_STATE_KEYS[actions.save.state]));
function progress(work: WorkPackage): string { return tr(('renovation.progress.' + work.progress) as 'renovation.progress.pending' | 'renovation.progress.in-progress' | 'renovation.progress.complete'); }
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
		class="rp-project-work rp-project-detail"
		:aria-label="tr('schedule.title')"
	>
		<header class="rp-project-detail__header">
			<button
				type="button"
				@click="context.navigate(projectId)"
			>
				{{ tr('view.project.prices-back') }}
			</button>
			<h2>{{ read.data.value?.project.name }} · {{ tr('schedule.title') }}</h2>
			<button
				v-if="context.origin"
				type="button"
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
				type="button"
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
				<div class="rp-project-work__controls">
					<label>{{ tr('schedule.floor') }}<select v-model="filter"><option value="all">{{ tr('schedule.all-floors') }}</option><option
						v-for="[id, name] in floors"
						:key="id"
						:value="id"
					>{{ name }}</option></select></label>
					<button
						type="button"
						:aria-disabled="actions.blocked.value || !actions.canUndo.value"
						@click="actions.step('undo')"
					>
						{{ tr('editor.context.undo') }}
					</button>
					<button
						type="button"
						:aria-disabled="actions.blocked.value || !actions.canRedo.value"
						@click="actions.step('redo')"
					>
						{{ tr('editor.context.redo') }}
					</button>
					<button
						type="button"
						:aria-disabled="actions.blocked.value"
						@click="createTrade"
					>
						{{ tr('trade.add') }}
					</button>
				</div>
				<p v-if="!rows.length">
					{{ tr('schedule.empty') }}
				</p>
				<ol class="rp-project-work__rows">
					<li
						v-for="row in rows"
						:key="row.planId + ':' + row.work.id"
						:data-work-id="row.work.id"
						:class="{ 'is-selected': context.origin?.planId === row.planId && context.origin.workId === row.work.id }"
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
							:aria-disabled="actions.blocked.value"
							@click="actions.edit(row)"
						>
							{{ tr('renovation.edit.work') }}
						</button>
						<button
							type="button"
							@click="actions.open(row)"
						>
							{{ tr('schedule.open-floor') }}
						</button>
					</li>
				</ol>
			</template>
		</div>
	</section>
</template>
