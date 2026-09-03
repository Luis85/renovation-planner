<script setup lang="ts">
/**
 * Costs, Documents, Photos and Notes (component library §8's `LinkedContentList`) — minus
 * Materials, which is design slice 10's Requirements panel already: it has a query and a
 * control of its own, so it is a SUPPORTED section rather than one this list carries
 * (`INSPECTOR_SECTIONS`'s own docblock states the same exclusion). Every row is UNAVAILABLE
 * in this increment and is rendered as text with a reason — never a `<button>` or `<a>` that
 * does nothing. A Feature that supplies one of these removes it from `INSPECTOR_SECTIONS`'
 * unavailable list and gives its row a real control here.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { InspectorSection } from '../../read-models/roomOverview';

const ROWS: readonly { readonly section: InspectorSection; readonly labelKey: StringKey }[] = [
	{ section: 'costs', labelKey: 'editor.inspector.linked.costs' },
	{ section: 'documents', labelKey: 'editor.inspector.linked.documents' },
	{ section: 'photos', labelKey: 'editor.inspector.linked.photos' },
	{ section: 'notes', labelKey: 'editor.inspector.linked.notes' },
];
defineProps<{ unavailable: readonly InspectorSection[] }>();
</script>

<template>
	<ul class="rp-linked-content">
		<li
			v-for="row in ROWS"
			:key="row.section"
			class="rp-linked-content__row"
			:class="{ 'rp-linked-content__row--unavailable': unavailable.includes(row.section) }"
		>
			<span class="rp-linked-content__label">{{ tr(row.labelKey) }}</span>
			<span
				v-if="unavailable.includes(row.section)"
				class="rp-linked-content__state"
			>{{ tr('editor.inspector.unavailable') }}</span>
		</li>
	</ul>
</template>
