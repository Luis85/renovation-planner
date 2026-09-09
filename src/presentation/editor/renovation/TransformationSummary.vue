<script setup lang="ts">
import { computed, toDisplayString } from 'vue';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { renovationSummary } from './renovationSummary';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import TransformationStage from './TransformationStage.vue';
import type { PlannedFacts, RenovationSubject } from '../../../domain/renovation/Renovation';

const joined = (parts: string[]): string => parts.join(', ') || tr('renovation.summary.unrecorded');
const change = (item: RenovationSubject & { planned: PlannedFacts }): string => tr(`renovation.change.${item.planned.change}`);

const props = defineProps<{ roomId: string; targetId?: string; continuationOnly?: boolean; compact?: boolean }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const summary = computed(() => renovationSummary(project.plan?.renovation ?? EMPTY_RENOVATION, props.roomId, props.targetId));
/**
 * The three stage blocks, with their asymmetries kept rather than smoothed: only work
 * carries a progress span, only work lists four entries while joining three, only planned
 * has no trailing arrow, and planned's joined fallback interpolates a missing description
 * where its list renders it as empty — the two spellings differ in the source and stay
 * different here.
 */
const stages = computed(() => {
	const value = summary.value;
	const list = (source: readonly unknown[], items: { id: string; text: string }[]): { id: string; text: string }[] | undefined => props.compact || !source.length ? undefined : items;
	return {
		existing: {
			label: tr('renovation.summary.existing'),
			arrow: true,
			items: list(value.existing, value.existing.slice(0, 3).map(item => ({ id: item.id, text: item.existing.description }))),
			text: joined(value.existing.slice(0, 3).map(item => item.existing.description)),
		},
		work: {
			label: tr('renovation.summary.work'),
			arrow: true,
			progress: props.compact ? tr('renovation.summary.compact-progress', { done: String(value.complete), total: String(value.work.length) }) : undefined,
			items: list(value.work, value.work.slice(0, 4).map(item => ({ id: item.id, text: item.title }))),
			text: joined(value.work.slice(0, 3).map(item => item.title)),
		},
		planned: {
			label: tr('renovation.summary.planned'),
			// `toDisplayString` rather than `?? ''`: this line moved out of a `{{ }}` interpolation,
			// which coerces nullish to '' by calling exactly this function. Spelling it as a
			// fallback would add a branch no valid subject reaches — `validSubject` refuses an
			// 'add' with an empty `planned.description` and lets only a 'remove' empty it, while a
			// 'remove' always carries an `existing` whose description is itself validated non-empty.
			items: list(value.planned, value.planned.slice(0, 3).map(item => ({ id: item.id, text: `${change(item)}: ${toDisplayString(item.planned.description || item.existing?.description)}` }))),
			text: joined(value.planned.slice(0, 3).map(item => `${change(item)}: ${item.planned.description || item.existing?.description}`)),
		},
	};
});
function continuePlanning(): void {
	const { next, nextMode } = summary.value;
	runtime.renovation.focus(props.roomId, nextMode, next?.recordId);
	if (next?.kind === 'decision') void runtime.renovation.edit('decision', props.roomId, next.recordId);
}
</script>
<template>
	<section
		v-if="!continuationOnly"
		class="rp-transformation-summary"
		:aria-label="tr('renovation.overview')"
	>
		<div class="rp-transformation-summary__stages">
			<TransformationStage v-bind="stages.existing" />
			<TransformationStage v-bind="stages.work" />
			<TransformationStage v-bind="stages.planned" />
		</div>
		<p v-if="!compact">
			{{ tr('renovation.summary.change-count', { count: String(summary.changes) }) }} · {{ tr('renovation.summary.progress', { done: String(summary.complete), total: String(summary.work.length) }) }}
		</p>
		<p
			v-if="summary.findings.length && !compact"
			class="rp-record-metadata"
		>
			{{ tr('renovation.summary.open', { count: String(summary.findings.length) }) }}
		</p>
	</section>
	<button
		v-if="continuationOnly"
		type="button"
		class="mod-cta"
		data-rp-action="continue-renovation"
		:disabled="session.perspective === 'review'"
		@click="continuePlanning()"
	>
		{{ tr('renovation.summary.continue', { section: tr(`renovation.${summary.nextMode}`) }) }}<HostIcon name="arrow-right" />
	</button>
</template>
