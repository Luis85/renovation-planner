<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import { createEntityId } from '../../../core/identity/generateId';
import { err } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Quote } from '../../../domain/quote/Quote';
import type { Loaded } from '../../../application/ports/versioning';
import type { QuoteInput } from '../../../application/commands/quote/QuoteServices';
import { persistenceError } from '../../../application/errors';
import { useRenovationProjectContext } from '../RenovationProjectContext';
import { useLiveRead } from '../../composables/live-read';
import { useDialogStore } from '../../dialogs/dialog-store';
import NamedCatalogueForm from '../../catalogue/NamedCatalogueForm.vue';
import QuoteForm from './QuoteForm.vue';
import QuoteComparisonTable from './QuoteComparisonTable.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
const props = defineProps<{ projectId: string }>();
const context = useRenovationProjectContext(), dialogs = useDialogStore(), services = context.quotes;
const read = useLiveRead(services ? { read: () => services.read(props.projectId as ProjectId), onChanged: services.onChanged } : undefined);
const writing = ref(false), saved = ref(false);
const blocked = computed(() => !!context.readOnly || read.paused.value || writing.value);
const originRoom = computed(() => context.origin?.roomId ? read.data.value?.work.rooms.find(room => room.id === context.origin?.roomId)?.name ?? tr('quote.unresolved', { id: context.origin.roomId }) : '');
const today = ref('');
function updateDate(): void { const date = new Date(); today.value = [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
updateDate();
const timer = setInterval(updateDate, 60_000);
let alive = true;
function canLeave(): Promise<boolean> { return Promise.resolve(!writing.value && dialogs.current === null); }
if (context.session) context.session.canLeave = canLeave;
onBeforeUnmount(() => { alive = false; clearInterval(timer); if (context.session?.canLeave === canLeave) delete context.session.canLeave; });
async function save(input: QuoteInput) {
 if (!alive || blocked.value || !services) return err(persistenceError('quote.paused', 'Quote editing is paused.'));
 writing.value = true;
 try { const result = await services.save(input); if (alive && result.ok) { saved.value = true; await read.refresh(); } return result; }
 finally { writing.value = false; }
}
async function edit(original?: Loaded<Quote>): Promise<void> {
 if (blocked.value || dialogs.current || !read.data.value || original?.entity.status === 'received') return;
 const busy = ref(false);
 await dialogs.openDialog({ kind: 'form', title: tr('quote.edit'), component: markRaw(QuoteForm), busy,
  props: { read: read.data.value, choices: read.data, original, busy, paused: read.paused, retry: read.refresh, save } });
}
async function revise(offer: Loaded<Quote>): Promise<void> {
 if (blocked.value || dialogs.current || !read.data.value) return;
 const busy = ref(false);
 const original = { ...offer, entity: { ...offer.entity, id: createEntityId('quote'), status: 'draft' as const } };
 await dialogs.openDialog({ kind: 'form', title: tr('quote.revise'), component: markRaw(QuoteForm), busy,
  props: { read: read.data.value, choices: read.data, original, busy, paused: read.paused, retry: read.refresh, save: (input: QuoteInput) => save({ ...input, expected: 'absent' }) } });
}
async function supplier(): Promise<void> {
 if (blocked.value || dialogs.current || !services) return;
 const busy = ref(false);
 await dialogs.openDialog({ kind: 'form', title: tr('supplier.add'), component: markRaw(NamedCatalogueForm), busy,
  props: { kind: 'supplier', busy, create: services.suppliers.create } });
 if (alive) await read.refresh();
}
</script>
<template>
	<section
		class="rp-project-detail rp-project-quotes rp-project-downstream"
		:aria-label="tr('quote.comparison')"
	>
		<header class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="context.navigate(projectId)"
			>
				{{ tr('view.project.prices-back') }}
			</button><h2 class="rp-project-detail__name">
				{{ read.data.value?.work.project.name }} · {{ tr('quote.comparison') }}
			</h2><button
				v-if="context.origin"
				type="button"
				class="rp-project-detail__open-note"
				@click="context.openPlan(context.origin.planId, context.origin)"
			>
				{{ tr('schedule.return') }}
			</button>
		</header>
		<div class="rp-project-detail__body">
			<p>{{ tr('quote.comparison-policy') }}</p>
			<p v-if="context.origin?.roomId">
				{{ tr('quote.from-room', { name: originRoom }) }}
			</p>
			<p
				v-if="read.loading.value"
				role="status"
			>
				{{ tr('view.project.loading') }}
			</p>
			<p
				v-if="saved"
				role="status"
			>
				{{ tr(read.error.value ? 'save-state.saved-refresh-needed' : 'save-state.saved') }}
			</p>
			<p
				v-if="read.error.value"
				role="alert"
			>
				{{ trError(read.error.value) }}
			</p>
			<button
				v-if="read.error.value"
				type="button"
				class="rp-project-downstream__retry"
				@click="read.refresh"
			>
				{{ tr('view.project.resume-retry') }}
			</button>
			<p
				v-if="read.data.value && (read.data.value.unreadable || read.data.value.work.unreadablePlans || read.data.value.work.roomsIncomplete)"
				role="status"
			>
				{{ tr('quote.partial') }}
			</p>
			<div class="rp-project-work__controls">
				<button
					type="button"
					:aria-disabled="blocked"
					@click="supplier"
				>
					{{ tr('supplier.add') }}
				</button><button
					type="button"
					:aria-disabled="blocked"
					@click="edit()"
				>
					{{ tr('quote.add') }}
				</button>
			</div>
			<template v-if="read.data.value">
				<p v-if="!read.data.value.offers.length">
					{{ tr('quote.empty') }}
				</p><QuoteComparisonTable
					v-else
					:read="read.data.value"
					:today="today"
					:blocked="blocked"
					:origin="context.origin"
					@edit="edit"
					@revise="revise"
				/>
			</template>
		</div>
	</section>
</template>
