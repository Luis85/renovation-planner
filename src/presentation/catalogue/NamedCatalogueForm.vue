<script setup lang="ts">
import { onBeforeUnmount, ref, type Ref } from 'vue';
import { createEntityId } from '../../core/identity/generateId';
import type { AppError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { NamedCatalogueCreate } from '../../application/commands/catalogue/NamedCatalogueServices';
import { persistenceError } from '../../application/errors';
import { useDialogFormBusy } from '../composables/use-dialog-form-busy';
import { nativeSubmitKey } from '../editor/forms/nativeSubmitKey';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
const props = defineProps<{ kind: 'trade' | 'supplier'; busy: Ref<boolean>; create: (input: NamedCatalogueCreate) => Promise<Result<unknown, AppError>> }>();
const emit = defineEmits<{ submit: [] }>();
const id = createEntityId(props.kind), name = ref(''), saving = ref(false), error = ref<AppError | null>(null);
useDialogFormBusy(saving, props.busy);
let alive = true;
onBeforeUnmount(() => { alive = false; });
async function submit(): Promise<void> {
 if (!alive || saving.value) return;
 saving.value = true;
 try {
  const result = await props.create({ id, name: name.value });
  if (!alive) return;
  if (result.ok) emit('submit'); else error.value = result.error;
 } catch (cause) { if (alive) error.value = persistenceError('catalogue.create-failed', 'The catalogue record could not be saved.', cause); }
 finally { saving.value = false; }
}
</script>
<template>
	<form
		class="rp-dialog-form"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<p>{{ tr(kind === 'trade' ? 'trade.category-hint' : 'supplier.party-hint') }}</p>
		<label>{{ tr('catalogue.name') }}<input
			v-model="name"
			name="name"
			:readonly="saving"
			required
		></label>
		<p
			v-if="error"
			role="alert"
		>
			{{ trError(error) }}
		</p>
		<button
			type="submit"
			:aria-disabled="saving"
		>
			{{ tr('catalogue.create') }}
		</button>
	</form>
</template>
