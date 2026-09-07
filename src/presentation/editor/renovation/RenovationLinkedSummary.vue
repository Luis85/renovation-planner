<script setup lang="ts">
import { formatPlanningMoney } from '../../i18n/planningFormat';
import { computed } from 'vue';
import { usePlanningContext } from '../planning/planningContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
import { renovationCostSummary } from './renovationCostSummary';
import { inRenovationScope } from './renovationSummary';
import HostIcon from '../../components/HostIcon.vue';
import { EDITOR_MODE_ICONS } from '../editorIcons';

const props = defineProps<{ roomId?: string; targetId?: string }>();
const planning = usePlanningContext(), project = useProjectStore();
const costs = computed(() => planning.baseline.value ? renovationCostSummary(planning.baseline.value, props.roomId, props.targetId) : null);
const incomplete = computed(() => planning.loading.value || planning.failed.value || project.stale || project.unreadableZones > 0);
const unavailable = computed(() => incomplete.value || !costs.value?.totals);
const links = computed(() => {
	const baseline = planning.baseline.value, roomId = props.roomId;
	if (!baseline || !roomId) return [];
	const materials = baseline.materials.filter(({ entity }) => inRenovationScope({ roomId: entity.origin.zoneId, targetId: entity.source?.targetId ?? entity.origin.zoneId }, roomId, props.targetId));
	const evidence = baseline.plan.entity.renovation?.depth?.evidence.filter(item => inRenovationScope(item, roomId, props.targetId)) ?? [];
	return [
		{ mode: 'materials', count: materials.length }, { mode: 'costs', count: costs.value?.count ?? 0 },
		{ mode: 'documents', count: evidence.filter(item => item.type === 'document').length },
		{ mode: 'photos', count: evidence.filter(item => item.type === 'photo').length },
		{ mode: 'notes', count: evidence.filter(item => item.type === 'note').length },
	] as const;
});
</script>
<template>
	<section class="rp-renovation-linked-summary">
		<h4 v-if="roomId">
			{{ tr('renovation.summary.linked') }}
		</h4>
		<nav
			v-if="roomId"
			:aria-label="tr('renovation.summary.linked')"
			class="rp-linked-counts"
		>
			<button
				v-for="link in links"
				:key="link.mode"
				class="rp-linked-counts__button"
				type="button"
				:data-rp-linked="link.mode"
				@click="planning.runtime.renovation.focus(roomId, link.mode)"
			>
				<HostIcon :name="EDITOR_MODE_ICONS[link.mode]" /><span class="rp-linked-counts__label">{{ tr(`renovation.${link.mode}`) }}</span><span>{{ incomplete ? tr('editor.selection.unknown') : link.count }}</span><HostIcon name="chevron-right" />
			</button>
		</nav>
		<h4>{{ tr('renovation.summary.estimate') }}</h4>
		<p
			v-if="planning.loading.value"
			role="status"
		>
			{{ tr('renovation.summary.loading') }}
		</p>
		<p
			v-else-if="unavailable"
			role="status"
		>
			{{ tr('renovation.summary.unavailable') }}
		</p>
		<p
			v-else
			data-rp-stat="renovation-cost"
			class="rp-renovation-estimate"
		>
			{{ formatPlanningMoney(costs!.totals!.planned) }}
		</p>
	</section>
</template>
