<script setup lang="ts">
import PlanningReview from '../planning/PlanningReview.vue';
import { usePlanningContext } from '../planning/planningContext';
import { planningFindings } from '../planning/planningProjection';
import { computed, onBeforeUnmount, ref } from 'vue';
import { EMPTY_RENOVATION, reviewRenovation, type ReadinessFinding } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import type { PlanId } from '../../../domain/plan/PlanId';
import { persistenceError } from '../../../application/errors';
import { renovationMessage } from './renovationMessage';
const project = useProjectStore(), runtime = useEditorRuntime();
const context = usePlanEditorContext(), busy = ref(false), error = ref('');
const planning = usePlanningContext();
let alive = true;
onBeforeUnmount(() => { alive = false; });
const findings = computed(() => reviewRenovation(project.plan?.renovation ?? EMPTY_RENOVATION));
const clear = computed(() => !project.stale && !findings.value.length && (!context.commands.planning ||
 (!planning.loading.value && !planning.failed.value && !!planning.baseline.value && !planningFindings(planning.baseline.value, planning.files).length)));
function open(item: ReadinessFinding): void {
	runtime.renovation.focus(item.roomId, item.kind === 'blocked' || item.kind === 'missing-outcome' ? 'work' : 'planned', item.recordId);
	if (item.kind === 'decision') void runtime.renovation.edit('decision', item.roomId, item.recordId);
}
const plain = (text: string): string => text.replace(/[\r\n]/g, ' ').replace(/[\\[\]<>*_`]/g, '\\$&');
async function depthBody(): Promise<string | null> {
 if (!context.commands.planning) return '';
 const depth = await context.commands.planning.read(context.planId as PlanId);
 if (!depth.ok) { if (alive) error.value = tr('planning.read-failed'); return null; }
 const items = planningFindings(depth.value, context.commands.evidenceFiles);
 return '\n\n' + tr('planning.review-scope') + '\n' + items.map(item => `- ${tr(`planning.${item.kind}`)}: ${plain(item.description)} (${item.id})`).join('\n')
  + (!items.length && !findings.value.length ? '\n' + tr('renovation.no-findings') : '');
}
async function generate(): Promise<void> {
	if (busy.value || project.stale || !context.commands.reviewNote) return;
	busy.value = true;
	let body = [`# ${tr('renovation.review')} — ${plain(project.plan?.name ?? '')}`, '', tr(context.commands.planning ? 'planning.review-scope' : 'renovation.scope'), '',
		...findings.value.map(item => `- ${plain(project.zones.get(item.roomId)?.name ?? item.roomId)}: ${tr(`renovation.finding.${item.kind}`)} — ${item.causes.map(plain).join(', ')} (${item.recordId})`),
		...(findings.value.length || context.commands.planning ? [] : [tr('renovation.no-findings')]),
	].join('\n');
	try {
        const depth = await depthBody();
        if (depth === null) return;
        body += depth;
		if (!alive) return;
		const result = await context.commands.reviewNote(context.planId as PlanId, body);
		if (alive) error.value = result.ok ? '' : renovationMessage(result.error);
	} catch (cause) { if (alive) error.value = renovationMessage(persistenceError('review.write-failed', 'Review generation failed.', cause)); } finally { if (alive) busy.value = false; }
}
</script>
<template>
	<section class="rp-renovation-inspector">
		<h3>{{ tr('renovation.review') }}</h3>
		<p v-if="!context.commands.planning">
			{{ tr('renovation.scope') }}
		</p>
		<PlanningReview v-if="context.commands.planning" />
		<p v-if="clear">
			{{ tr('renovation.no-findings') }}
		</p>
		<ol class="rp-renovation-list">
			<li
				v-for="item in findings"
				:key="`${item.kind}:${item.recordId}`"
			>
				<button
					type="button"
					@click="open(item)"
				>
					{{ project.zones.get(item.roomId)?.name }} · {{ tr(`renovation.finding.${item.kind}`) }}
				</button>
				<p>{{ item.causes.join(', ') }}</p>
			</li>
		</ol>
		<button
			type="button"
			@click="runtime.renovation.perspective('renovate')"
		>
			{{ tr('renovation.back') }}
		</button>
		<button
			v-if="context.commands.reviewNote"
			type="button"
			:disabled="busy || project.stale"
			data-rp-action="review-note"
			@click="generate"
		>
			{{ tr('renovation.review-note') }}
		</button>
		<p
			v-if="error"
			role="alert"
		>
			{{ error }}
		</p>
	</section>
</template>
