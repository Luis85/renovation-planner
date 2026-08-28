<script setup lang="ts">
/**
 * §60's third status-bar region: "is this Plan's data safely written?".
 *
 * Text rather than an icon or a bare colour, per SDD §85 — the same "status not colour-only"
 * rule slice 5 applies to a zone's status. No props: it reads THIS Plan Editor's own store
 * from its own Pinia instance, so two open editors indicate independently.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { SAVE_STATE_KEYS } from './save-state';
import { useSaveStateStore } from './save-state-store';

const { state } = storeToRefs(useSaveStateStore());

const label = computed(() => tr(SAVE_STATE_KEYS[state.value]));
</script>

<template>
	<span
		class="rp-save-state-label"
		:class="`rp-save-state-${state}`"
	>{{ label }}</span>
</template>
