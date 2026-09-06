<script setup lang="ts">
import { computed } from 'vue';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from './renovationSession';
import { renovationSummary } from './renovationSummary';
import { tr } from '../../i18n/strings';

const props = defineProps<{ roomId: string; targetId?: string; continuationOnly?: boolean }>();
const project = useProjectStore(), runtime = useEditorRuntime(), session = useRenovationSession();
const summary = computed(() => renovationSummary(project.plan?.renovation ?? EMPTY_RENOVATION, props.roomId, props.targetId));
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
			<div>
				<h4>{{ tr('renovation.summary.existing') }}</h4>
				<p>{{ summary.existing.slice(0, 3).map(item => item.existing!.description).join(', ') || tr('renovation.summary.unrecorded') }}</p>
			</div>
			<div>
				<h4>{{ tr('renovation.summary.work') }}</h4>
				<p>{{ summary.work.slice(0, 3).map(item => item.title).join(', ') || tr('renovation.summary.unrecorded') }}</p>
			</div>
			<div>
				<h4>{{ tr('renovation.summary.planned') }}</h4>
				<p>{{ summary.planned.slice(0, 3).map(item => `${tr(`renovation.change.${item.planned!.change}`)}: ${item.planned!.description || item.existing?.description}`).join(', ') || tr('renovation.summary.unrecorded') }}</p>
			</div>
		</div>
		<p>{{ tr('renovation.summary.change-count', { count: String(summary.changes) }) }} · {{ tr('renovation.summary.progress', { done: String(summary.complete), total: String(summary.work.length) }) }}</p>
		<p
			v-if="summary.findings.length"
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
		{{ tr('renovation.summary.continue', { section: tr(`renovation.${summary.nextMode}`) }) }}
	</button>
</template>
