<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRenovationProjectContext } from './RenovationProjectContext';
import { useDialogStore } from '../dialogs/dialog-store';
import { notifyFault, notifyWarning } from '../notices/notify';
import { tr } from '../i18n/strings';
const props = defineProps<{ id: string; blocked: boolean }>();
const context = useRenovationProjectContext(), dialogs = useDialogStore(), opening = ref(false);
let alive = true;
onBeforeUnmount(() => { alive = false; });
async function open(): Promise<void> {
 if (!alive || props.blocked || opening.value || dialogs.current || !context.openRecord) return;
 opening.value = true;
 try {
  const outcome = await context.openRecord(props.id);
  if (alive && outcome === 'missing') notifyWarning(tr('project.source-note-missing'));
 } catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'view.project.open-failed'); }
 finally { opening.value = false; }
}
</script>
<template>
	<button
		v-if="context.openRecord"
		type="button"
		class="rp-project-downstream__retry"
		data-rp-recovery-source
		:aria-disabled="blocked || opening"
		@click="open"
	>
		{{ tr('editor.warning.open-source-note') }}
	</button>
</template>
