<script setup lang="ts">
import { computed } from 'vue';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { renovationSummary } from './renovationSummary';
import { tr } from '../../i18n/strings';
import TransformationStage from './TransformationStage.vue';
import HostIcon from '../../components/HostIcon.vue';

const props = defineProps<{ roomId: string; targetId?: string; continuationOnly?: boolean; compact?: boolean }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const summary = computed(() => renovationSummary(project.plan?.renovation ?? EMPTY_RENOVATION, props.roomId, props.targetId));
function stages() { return [
	{ kind: 'existing' as const, items: summary.value.existing.slice(0, 3).map(item => ({ id: item.id, text: item.existing.description })) },
	{ kind: 'work' as const, items: summary.value.work.slice(0, 4).map(item => ({ id: item.id, text: item.title })) },
	{ kind: 'planned' as const, items: summary.value.planned.slice(0, 3).map(item => ({ id: item.id, change: tr(`renovation.change.${item.planned.change}`), text: item.planned.description || item.existing?.description })) },
]; }
function compactProgress(): string { return tr('renovation.summary.compact-progress', { done: String(summary.value.complete), total: String(summary.value.work.length) }); }
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
			<TransformationStage
				v-for="stage in stages()"
				:key="stage.kind"
				:kind="stage.kind"
				:items="stage.items"
				:compact="compact"
				:progress="compactProgress()"
			/>
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
