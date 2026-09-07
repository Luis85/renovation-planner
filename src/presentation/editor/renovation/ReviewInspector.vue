<script setup lang="ts">
import PlanningReview from '../planning/PlanningReview.vue';
import { usePlanningContext } from '../planning/planningContext';
import { planningFindings } from '../planning/planningProjection';
import { computed, onBeforeUnmount, ref } from 'vue';
import { EMPTY_RENOVATION, reviewRenovation, type ReadinessFinding, type Renovation } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import type { PlanId } from '../../../domain/plan/PlanId';
import { persistenceError } from '../../../application/errors';
import { renovationMessage } from './renovationMessage';
const project = useProjectStore(), runtime = useEditorRuntime();
const context = usePlanEditorContext(), busy = ref(false), error = ref('');
let alive = true;
onBeforeUnmount(() => { alive = false; });
const findings = computed(() => reviewRenovation(project.plan?.renovation ?? EMPTY_RENOVATION));
const planning = usePlanningContext();
const depth = planning.findings;
// The all-clear is one claim over BOTH lists, and none at all until the planning read has
// settled: while it loads there is nothing to be clear about, and after it fails the refusal
// beside it would be contradicted. A plan without planning services needs no guard of its own —
// its context never reads, so `baseline` stays null and `loading`/`failed` stay false.
const clear = computed(() => !runtime.writesBlocked.value && !findings.value.length && !depth.value.length && !planning.loading.value && !planning.failed.value && (!context.commands.planning || !!planning.baseline.value));
function open(item: ReadinessFinding): void {
	runtime.renovation.focus(item.roomId, item.kind === 'blocked' || item.kind === 'missing-outcome' ? 'work' : 'planned', item.recordId);
	if (item.kind === 'decision') void runtime.renovation.edit('decision', item.roomId, item.recordId);
}
const plain = (text: string): string => text.replace(/[\r\n]/g, ' ').replace(/[\\[\]<>*_`]/g, '\\$&');
// A fresh read rather than the panel's baseline, so the note records what is on disk now.
function renovationLines(value: Renovation): string[] {
 return reviewRenovation(value).map(item => `- ${plain(project.zones.get(item.roomId)?.name ?? item.roomId)}: ${tr(`renovation.finding.${item.kind}`)} — ${item.causes.map(plain).join(', ')} (${item.recordId})`);
}
async function noteSnapshot(): Promise<{ name: string; lines: string[] } | null> {
 if (!context.commands.planning) return { name: project.plan?.name ?? '', lines: renovationLines(project.plan?.renovation ?? EMPTY_RENOVATION) };
 const read = await context.commands.planning.read(context.planId as PlanId);
 if (!read.ok) { if (alive) error.value = tr('planning.read-failed'); return null; }
 const lines = planningFindings(read.value, context.commands.evidenceFiles).map(item => `- ${tr(`planning.${item.kind}`)}: ${plain(item.description)} (${item.id})`);
 return { name: read.value.plan.entity.name, lines: [...renovationLines(read.value.plan.entity.renovation ?? EMPTY_RENOVATION), ...lines] };
}
async function generate(): Promise<void> {
	if (busy.value || runtime.writesBlocked.value || !context.commands.reviewNote) return;
	busy.value = true;
	try {
		const snapshot = await noteSnapshot();
		if (snapshot === null || !alive) return;
		const body = [`# ${tr('renovation.review')} — ${plain(snapshot.name)}`, '', tr(context.commands.planning ? 'planning.review-scope' : 'renovation.scope'), '', ...(snapshot.lines.length ? snapshot.lines : [tr('renovation.no-findings')])].join('\n');
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
		<PlanningReview
			v-if="context.commands.planning"
			:findings="depth"
		/>
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
			:disabled="busy || runtime.writesBlocked.value"
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
