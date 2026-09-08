<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import { createEntityId } from '../../../core/identity/generateId';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { AppError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import type { Loaded, Expected } from '../../../application/ports/versioning';
import type { Quote } from '../../../domain/quote/Quote';
import type { QuoteComparisonRead, QuoteInput } from '../../../application/commands/quote/QuoteServices';
import { persistenceError } from '../../../application/errors';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { nativeSubmitKey } from '../../editor/forms/nativeSubmitKey';
import { restoreInoperativeChoice } from '../../editor/forms/inoperativeControl';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { newQuoteItem, quoteDraft, quoteInput } from './quoteDraft';
import QuoteItemFields from './QuoteItemFields.vue';
const props = defineProps<{ read: QuoteComparisonRead; choices: Readonly<Ref<QuoteComparisonRead | null>>; original?: Loaded<Quote>; busy: Ref<boolean>; paused: Readonly<Ref<boolean>>; retry: () => Promise<void>; save: (input: QuoteInput) => Promise<Result<Loaded<Quote>, AppError>> }>();
const emit = defineEmits<{ submit: [] }>();
const draft = ref(quoteDraft(props.read.work.project.id, props.read.work.project.currency, props.original?.entity));
let expected: Expected = props.original?.version ?? 'absent';
const saving = ref(false), reviewed = ref(false), conflict = ref(false), error = ref<AppError | null>(null);
useDialogFormBusy(saving, props.busy);
const frozen = computed(() => saving.value || conflict.value);
const applyBlocked = computed(() => frozen.value || props.paused.value);
const choices = computed(() => props.choices.value ?? props.read);
let alive = true;
onBeforeUnmount(() => { alive = false; });
function add(): void { if (!frozen.value) { draft.value.items.push(newQuoteItem(props.read.work.project.currency)); reviewed.value = false; } }
function remove(index: number): void { if (!frozen.value) { draft.value.items.splice(index, 1); reviewed.value = false; } }
async function submit(): Promise<void> {
 if (applyBlocked.value) return;
 const value = quoteInput(draft.value);
 if (!value.ok) { error.value = value.error; return; }
 if (!reviewed.value) { reviewed.value = true; error.value = null; return; }
 saving.value = true;
 try {
  const result = await props.save({ quote: value.value, expected });
  if (!alive) return;
  if (result.ok) emit('submit'); else { error.value = result.error; conflict.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'quote.immutable'; }
 } catch (cause) { if (alive) error.value = persistenceError('quote.save-failed', 'The quote could not be saved.', cause); }
 finally { saving.value = false; }
}
function keepAsRevision(): void {
 if (saving.value || !conflict.value) return;
 draft.value.id = createEntityId('quote'); draft.value.status = 'draft'; expected = 'absent'; conflict.value = false; reviewed.value = false; error.value = null;
}
function changed(): void { if (!frozen.value) reviewed.value = false; }
</script>
<template>
	<form
		class="rp-dialog-form rp-quote-form"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
		@input="changed"
		@change="changed"
	>
		<p>{{ tr('quote.explicit') }}</p>
		<p
			v-if="paused.value"
			role="status"
		>
			{{ tr('quote.paused') }}
		</p>
		<button
			v-if="paused.value"
			type="button"
			:aria-disabled="saving"
			@click="!saving && retry()"
		>
			{{ tr('view.project.resume-retry') }}
		</button>
		<p
			v-if="error"
			role="alert"
		>
			{{ trError(error) }}
		</p>
		<template v-if="conflict">
			<p>{{ tr('quote.conflict') }}</p><button
				type="button"
				:aria-disabled="saving"
				@click="keepAsRevision"
			>
				{{ tr('quote.keep-revision') }}
			</button>
		</template>
		<label>{{ tr('quote.title') }}<input
			v-model="draft.title"
			name="title"
			:readonly="frozen"
			required
		></label>
		<label>{{ tr('quote.supplier') }}<select
			v-model="draft.supplierId"
			name="supplier"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.supplierId)"
		>
			<option value="">{{ tr('quote.choose-supplier') }}</option><option
				v-for="supplier in choices.suppliers"
				:key="supplier.id"
				:value="supplier.id"
			>{{ supplier.name }}</option>
			<option
				v-if="draft.supplierId && !choices.suppliers.some(item => item.id === draft.supplierId)"
				:value="draft.supplierId"
				disabled
			>{{ tr('quote.unresolved', { id: draft.supplierId }) }}</option>
		</select></label>
		<label>{{ tr('quote.issued') }}<input
			v-model="draft.issuedOn"
			name="issued"
			:readonly="frozen"
			placeholder="YYYY-MM-DD"
			required
		></label>
		<label>{{ tr('quote.valid-until') }}<input
			v-model="draft.validUntil"
			name="valid-until"
			:readonly="frozen"
			placeholder="YYYY-MM-DD"
		></label>
		<label>{{ tr('quote.status') }}<select
			v-model="draft.status"
			name="quote-status"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.status)"
		><option value="draft">{{ tr('quote.draft') }}</option><option value="received">{{ tr('quote.received') }}</option></select></label>
		<p v-if="draft.status === 'received'">
			{{ tr('quote.immutable') }}
		</p>
		<fieldset
			v-for="(item, index) in draft.items"
			:key="item.id"
		>
			<legend>{{ tr('quote.item') }} {{ index + 1 }}</legend>
			<QuoteItemFields
				v-model="draft.items[index]"
				:read="choices"
				:frozen="frozen"
			/>
			<button
				type="button"
				:aria-disabled="frozen"
				@click="remove(index)"
			>
				{{ tr('quote.remove-item') }}
			</button>
		</fieldset>
		<button
			type="button"
			:aria-disabled="frozen"
			@click="add"
		>
			{{ tr('quote.add-item') }}
		</button>
		<p
			v-if="reviewed"
			role="status"
		>
			{{ tr('quote.confirm') }}
		</p>
		<button
			type="submit"
			:aria-disabled="applyBlocked"
		>
			{{ tr(reviewed ? 'renovation.apply' : 'renovation.preview') }}
		</button>
	</form>
</template>
