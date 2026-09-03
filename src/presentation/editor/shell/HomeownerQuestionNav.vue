<script setup lang="ts">
/**
 * What's here / What will change / What needs doing (component library §8), in canonical
 * order. Every row is UNAVAILABLE in this increment and is rendered as text with a reason —
 * never a `<button>` or `<a>` that does nothing. A Feature that supplies a section removes it
 * from `INSPECTOR_SECTIONS`' unavailable list and gives its row a real control here.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { InspectorSection } from '../../read-models/roomOverview';

const ROWS: readonly { readonly section: InspectorSection; readonly labelKey: StringKey }[] = [
	{ section: 'existing', labelKey: 'editor.inspector.question.existing' },
	{ section: 'planned', labelKey: 'editor.inspector.question.planned' },
	{ section: 'work', labelKey: 'editor.inspector.question.work' },
];
defineProps<{ unavailable: readonly InspectorSection[] }>();
</script>

<template>
	<ul class="rp-question-nav">
		<li
			v-for="row in ROWS"
			:key="row.section"
			class="rp-question-nav__row"
			:class="{ 'rp-question-nav__row--unavailable': unavailable.includes(row.section) }"
		>
			<span class="rp-question-nav__label">{{ tr(row.labelKey) }}</span>
			<span
				v-if="unavailable.includes(row.section)"
				class="rp-question-nav__state"
			>{{ tr('editor.inspector.unavailable') }}</span>
		</li>
	</ul>
</template>
