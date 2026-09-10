<script setup lang="ts">
import { orderEvidenceByDate } from './evidenceOrder';
import SharedRecordContexts from '../renovation/SharedRecordContexts.vue';
import { useRenovationContextLabel } from '../renovation/renovationContextLabel';
import { inRenovationScope } from '../renovation/renovationSummary';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import EvidencePreview from './EvidencePreview.vue';
import EvidenceGallery from './EvidenceGallery.vue';
import { recordChoices } from './recordChoices';
import { computed, onBeforeUnmount, ref } from 'vue';
import { usePlanningContext } from './planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { EMPTY_DEPTH, EVIDENCE_PHASES, type Evidence } from '../../../domain/renovation/PlanningDepth';
import { tr } from '../../i18n/strings';
const props = defineProps<{ baseline: PlanningBaseline }>();
const contextLabel = useRenovationContextLabel();
const planning = usePlanningContext(), session = useRenovationSession(), error = ref('');
let alive = true; onBeforeUnmount(() => { alive = false; });
const choices = computed(() => recordChoices(props.baseline, session.roomId));
const type = computed(() => session.mode === 'photos' ? 'photo' : session.mode === 'notes' ? 'note' : 'document');
const rows = computed(() => orderEvidenceByDate((props.baseline.plan.entity.renovation?.depth?.evidence ?? []).filter(item => inRenovationScope(item, session.roomId, session.targetId) && item.type === type.value && (!session.evidencePhase || item.phase === session.evidencePhase))));
function isSelected(item: Evidence): boolean {
	return !!session.focusedId && (session.focusedId === item.id || session.focusedId === item.recordId);
}
async function open(path: string, subpath: string): Promise<void> { const result = await planning.files?.open(path, subpath); if (alive && result && !result.ok) error.value = tr('planning.file-failed'); }
function relatedLabel(id: string): string { return choices.value.find(record => record.id === id)?.label || id; }
function relationLinks(item: Evidence): { id: string; label: string }[] {
 const links = [];
 if (item.workId && item.workId !== item.recordId) links.push({ id: item.workId, label: tr('renovation.work') + ': ' + relatedLabel(item.workId) });
 if (item.recordId) links.push({ id: item.recordId, label: tr('planning.linked-record') + ': ' + relatedLabel(item.recordId) });
 return links;
}
function related(id: string): void {
 const baseline = props.baseline;
 const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
 const subjectMode = renovation.subjects.some(item => item.id === id && !item.planned) ? 'existing' : 'planned';
 const mode = baseline.materials.some(item => item.entity.id === id) ? 'materials' : renovation.depth?.costs.some(item => item.id === id) ? 'costs' : renovation.work.some(item => item.id === id) ? 'work' : subjectMode;
 planning.runtime.renovation.focus(session.roomId, mode, id);
}
function unlink(id: string): void {
	const shared = props.baseline.plan.entity.renovation?.depth?.evidence.find(item => item.id === id)?.links;
	void planning.runtime.renovation.change(read => { const renovation = read.plan.entity.renovation ?? EMPTY_RENOVATION; const depth = renovation.depth ?? EMPTY_DEPTH;
		return { renovation: { ...renovation, depth: { ...depth, evidence: depth.evidence.filter(item => item.id !== id) } }, intended: read.geometry.document.intended };
	}, tr('planning.unlink-policy') + (shared?.length ? ` ${tr('renovation.shared.delete-impact', { names: shared.map(item => contextLabel(item)).join(', ') })}` : ''));
}
</script>
<template>
	<div
		class="rp-evidence-filters"
		role="group"
		:aria-label="tr('planning.phase')"
	>
		<button
			type="button"
			data-rp-evidence-phase=""
			:aria-pressed="session.evidencePhase === ''"
			@click="session.evidencePhase = ''"
		>
			{{ tr('planning.all-phases') }}
		</button>
		<button
			v-for="phase in EVIDENCE_PHASES"
			:key="phase"
			type="button"
			:data-rp-evidence-phase="phase"
			:aria-pressed="session.evidencePhase === phase"
			@click="session.evidencePhase = phase"
		>
			{{ tr(`planning.${phase}`) }}
		</button>
	</div>
	<p v-if="!rows.length">
		{{ tr('renovation.empty') }}
	</p>
	<EvidenceGallery
		v-if="type === 'photo'"
		:rows="rows"
		:is-selected="isSelected"
	/>
	<ol class="rp-renovation-list">
		<li
			v-for="(item, index) in rows"
			v-show="type !== 'photo' || isSelected(item)"
			:key="item.id"
			:data-rp-record="item.id"
			:class="{ 'is-selected': isSelected(item) }"
		>
			<button
				type="button"
				class="rp-record-title"
				:aria-current="isSelected(item) ? 'true' : undefined"
				@click="planning.runtime.renovation.focus(item.roomId, session.mode, item.id)"
			>
				{{ index + 1 }}. {{ item.description }}
				<span v-if="isSelected(item)"> · {{ tr('planning.selected') }}</span>
			</button>
			<SharedRecordContexts :item="item" />
			<EvidencePreview
				:item="item"
				:files="planning.files"
				:plan-id="planning.context.planId"
				:revision="planning.evidenceRevision.value"
				:metadata-only="type === 'photo'"
			/>
			<div class="rp-planning-actions">
				<button
					type="button"
					@click="open(item.path, item.subpath)"
				>
					{{ tr('planning.open') }}
				</button><button
					type="button"
					:disabled="planning.blocked.value"
					@click="planning.edit('evidence', item.id)"
				>
					{{ tr('renovation.edit') }}
				</button><button
					type="button"
					:disabled="planning.blocked.value"
					@click="unlink(item.id)"
				>
					{{ tr('planning.unlink') }}
				</button>
			</div>
			<p
				v-for="link in relationLinks(item)"
				:key="link.id"
			>
				<button
					type="button"
					@click="related(link.id)"
				>
					{{ link.label }}
				</button>
			</p>
		</li>
	</ol>
	<button
		type="button"
		:disabled="planning.blocked.value"
		data-rp-new-evidence
		class="mod-cta"
		@click="planning.edit('evidence')"
	>
		{{ tr(`planning.add.${type}`) }}
	</button>
	<p
		v-if="error"
		role="alert"
	>
		{{ error }}
	</p>
</template>
