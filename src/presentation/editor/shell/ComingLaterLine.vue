<script setup lang="ts">
/**
 * The Coming later line — text, never a control. A Feature that supplies one of these sections
 * removes it from `INSPECTOR_SECTIONS`' unavailable list and gives it a real row elsewhere.
 */
import { computed } from 'vue';
import { currentLanguage } from '../../i18n/strings';
import { comingLaterSentence } from './comingLater';
import type { InspectorSection } from '../../read-models/roomOverview';

const props = defineProps<{ sections: readonly InspectorSection[] }>();
const sentence = computed(() => comingLaterSentence(currentLanguage(), props.sections));
</script>

<template>
	<p
		v-if="sentence !== ''"
		class="rp-coming-later"
	>
		{{ sentence }}
	</p>
</template>
