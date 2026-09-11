import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import { NO_HIERARCHY, type PlanHierarchyDto } from '../read-models/planHierarchy';

/**
 * One Plan Editor leaf's plan hierarchy (ADR-0028), rebuildable from `queries.hierarchy` like
 * every store here. A slower earlier read never lands over a later one.
 */
export const usePlanHierarchyStore = defineStore('plan-hierarchy', () => {
	const hierarchy = ref<PlanHierarchyDto>(NO_HIERARCHY);
	let latest = 0;

	async function load(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		if (queries.hierarchy === undefined) return;
		const request = ++latest;
		const found = await queries.hierarchy(planId);
		// ponytail: a failed hierarchy read keeps the last answer silently — the breadcrumb and guide
		// are additive, and the plan's own read already reports a vault fault. Surface it if a user
		// ever reports a missing crumb with no other error on screen.
		if (request === latest && found.ok) hierarchy.value = found.value;
	}

	return { hierarchy, load };
});
