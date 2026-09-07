import { computed, inject, provide, type InjectionKey } from 'vue';
import { EMPTY_RENOVATION, reviewRenovation } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useFloorSummary } from '../shell/useFloorSummary';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { recordNavigationContext } from './recordNavigationContext';
import { renovationSummary } from './renovationSummary';
import { tr } from '../../i18n/strings';
import type { PlanningFinding } from '../planning/planningProjection';

export type ReviewPlanningFinding = PlanningFinding & { readonly roomLabel: string; readonly sourceLabel: string };

const KEY: InjectionKey<ReturnType<typeof provideReviewPresentation>> = Symbol('review-presentation');

/** One leaf-owned presentation of existing rules; Room rows and markers share these exact refs. */
export function provideReviewPresentation(context: PlanEditorContext, runtime: EditorRuntime) {
	const project = useProjectStore(), floor = useFloorSummary(), planning = runtime.planning;
	const value = computed(() => project.plan?.renovation ?? EMPTY_RENOVATION);
	const labels = computed(() => new Map([
		...value.value.subjects.map(item => [item.id, item.planned?.description || item.existing?.description || item.id] as const),
		...value.value.work.map(item => [item.id, item.title] as const),
		...value.value.decisions.map(item => [item.id, item.question] as const),
	]));
	const findings = computed(() => reviewRenovation(value.value).map(item => {
		const sourceLabel = labels.value.get(item.recordId) || item.recordId;
		return { ...item, roomLabel: project.zones.get(item.roomId)?.name ?? item.roomId, sourceLabel,
			detailLabel: [...new Set([sourceLabel, ...item.causes])].join(' — ') };
	}));
	const depth = computed<ReviewPlanningFinding[]>(() => planning.findings.value.map(item => ({ ...item,
		roomLabel: project.zones.get(item.roomId)?.name ?? item.roomId, sourceLabel: item.description || item.id,
	})));
	const available = computed(() => !runtime.writesBlocked.value && !planning.loading.value && !planning.failed.value
		&& (!context.commands.planning || !!planning.baseline.value));
	const clear = computed(() => available.value && !findings.value.length && !depth.value.length);
	const records = computed(() => ({ renovation: value.value, materials: planning.baseline.value?.materials ?? [] }));
	const rows = computed(() => {
		const complete = available.value && !project.stale && project.unreadableZones === 0;
		const all = [...findings.value, ...depth.value];
		let number = 0;
		return (floor.value?.rooms ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(room => {
			const count = all.filter(item => {
				const id = 'recordId' in item ? item.recordId : item.id;
				const source = recordNavigationContext(records.value, id, room.id, null);
				return (source?.roomId ?? item.roomId) === room.id;
			}).length;
			return { ...room, count, changes: renovationSummary(value.value, room.id).changes,
				markerNumber: complete && count > 0 ? ++number : null,
				status: !complete ? tr('renovation.review.unavailable') : count ? tr('renovation.summary.open', { count: String(count) }) : tr('renovation.review.no-room-findings'),
				icon: !complete ? 'clipboard-list' : count ? 'triangle-alert' : 'circle-check' };
		});
	});
	const presentation = { floor, findings, depth, available, clear, rows };
	provide(KEY, presentation);
	return presentation;
}

export function useReviewPresentation(): ReturnType<typeof provideReviewPresentation> {
	const value = inject(KEY);
	if (!value) throw new Error('Review presentation is missing');
	return value;
}
