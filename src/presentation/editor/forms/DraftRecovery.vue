<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { tr } from '../../i18n/strings';
import { useSaveStateStore } from '../save-state/save-state-store';
const props = defineProps<{ retry: () => Promise<void>; openSource: () => Promise<void> }>();
// **`leafUnrecoveredWrite` and never the `unrecoveredWrite` GATE**, at all four sites below.
// Every one of them is about a draft THIS leaf failed to confirm — the early return in
// `tryAgain`, the recovery state attribute, which of the two messages is shown, and whether the
// **Try again** button exists at all. The gate is wider: it is also true while the VAULT holds an
// open write incident (ADR-0034), which may have been raised on another plan, in another project
// or in an earlier session. Reading the gate here removed a READ retry from a user the ADR wants
// inspecting — "a gate that blocked reads would make the vault uninspectable at exactly the moment
// inspecting it is the only remedy on offer" — which is why ADR-0034 gates COMMANDS alone.
// `tests/presentation/editor/usability/i13-save-recovery.test.ts` drives both doors the vault fact
// arrives through (the store's seed, and the gate-refusal catch-up) plus the leaf-own control.
const save = useSaveStateStore();
const reading = ref(false);
const root = ref<HTMLElement | null>(null);
onBeforeUnmount(() => {
 // The host is a `<form>` for every point-entry host, but the item task form (2026-09-13 item modes
 // spec §A) renders this outside its `<form>` in rectangle mode, wearing `data-rp-form` instead
 // (`ElementTaskForm.vue`). `closest` returns the nearest ancestor, so a host still inside a `<form>`
 // is unaffected by widening this.
 if (root.value?.contains(document.activeElement)) root.value.closest('form, [data-rp-form]')?.querySelector<HTMLElement>('input, select, textarea')?.focus();
});
async function tryAgain(): Promise<void> {
 if (reading.value || save.leafUnrecoveredWrite) return;
 reading.value = true;
 try { await props.retry(); } finally { reading.value = false; }
}
</script>
<template>
	<section
		ref="root"
		class="rp-draft-recovery"
		aria-live="polite"
		aria-atomic="false"
		:data-rp-recovery-state="save.leafUnrecoveredWrite ? 'unconfirmed' : 'read-failed'"
	>
		<p>{{ tr(save.leafUnrecoveredWrite ? 'planning.recovery.unrecovered' : 'planning.recovery.draft') }}</p>
		<button
			v-if="!save.leafUnrecoveredWrite"
			type="button"
			:aria-disabled="reading"
			@click="tryAgain"
		>
			{{ tr('planning.retry') }}
		</button>
		<button
			type="button"
			@click="openSource"
		>
			{{ tr('editor.warning.open-source-note') }}
		</button>
	</section>
</template>
