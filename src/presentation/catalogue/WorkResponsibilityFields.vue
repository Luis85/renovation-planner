<script setup lang="ts">
import { computed } from 'vue';
import { useTradeCatalogue } from './tradeCatalogue';
import { restoreInoperativeChoice } from '../editor/forms/inoperativeControl';
import type { EditableRenovationDraft } from '../editor/renovation/renovationDraft';
import { tr } from '../i18n/strings';
const work = defineModel<EditableRenovationDraft['work']>({ required: true });
const props = defineProps<{ frozen: boolean }>();
const catalogue = useTradeCatalogue();
const selected = computed(() => work.value.responsibility === 'trade' ? 'trade:' + work.value.tradeId : work.value.responsibility);
const missing = computed(() => work.value.responsibility === 'trade' && !catalogue.entries.value.some(item => item.id === work.value.tradeId));
function change(event: Event): void {
 const control = event.target as HTMLSelectElement, value = control.value;
 if (props.frozen) { control.value = selected.value; return; }
 if (value.startsWith('trade:')) {
  const id = value.slice(6);
  if (!catalogue.available.value || !catalogue.entries.value.some(item => item.id === id)) { control.value = selected.value; return; }
  work.value = { ...work.value, responsibility: 'trade', tradeId: id };
 } else if (value === 'unassigned' || value === 'diy') {
  const next: EditableRenovationDraft['work'] = { ...work.value, responsibility: value }; delete next.tradeId; work.value = next;
 }
}
</script>
<template>
	<label>{{ tr('renovation.responsibility') }}
		<select
			name="responsibility"
			:value="selected"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, selected)"
			@change="change"
		>
			<option value="unassigned">{{ tr('renovation.unassigned') }}</option><option value="diy">{{ tr('renovation.diy') }}</option>
			<option
				v-if="missing"
				:value="selected"
				disabled
			>{{ tr('trade.unresolved', { id: work.tradeId ?? '' }) }}</option>
			<option
				v-for="trade in catalogue.entries.value"
				:key="trade.id"
				:value="'trade:' + trade.id"
				:disabled="!catalogue.available.value"
			>{{ tr('trade.choice', { name: trade.name }) }}</option>
		</select>
	</label>
	<p
		v-if="!catalogue.available.value"
		role="status"
	>
		{{ tr('trade.unavailable') }}
	</p>
	<p
		v-else-if="catalogue.partial.value"
		role="status"
	>
		{{ tr('trade.partial') }}
	</p>
	<p v-else-if="catalogue.entries.value.length === 0">
		{{ tr('trade.empty') }}
	</p>
	<button
		v-if="catalogue.status.value === 'failed'"
		type="button"
		@click="catalogue.refresh"
	>
		{{ tr('editor.warning.retry') }}
	</button>
</template>
