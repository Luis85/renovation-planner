import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import { NO_HIERARCHY, type PlanHierarchyDto } from '../read-models/planHierarchy';

/**
 * One Plan Editor leaf's plan hierarchy (ADR-0028), rebuildable from `queries.hierarchy` like
 * every store here. A slower earlier read never lands over a later one. A failed read keeps the
 * last answer — the breadcrumb and guide are additive — and sets `failed`, so the Property tree
 * can say so instead of letting a detail plan pass for a parentless one.
 *
 * `writing` is `usePlanReorder`'s in-flight flag, held HERE because that composable has one
 * instance per caller — the tree, its row menu and the Floor inspector — and one leaf's reorder
 * writes must not overlap whichever instance started them: a held Alt+↑ auto-repeats before the
 * re-read lands, and a second sequence computed from the stale tree hits the version check.
 */
export const usePlanHierarchyStore = defineStore('plan-hierarchy', () => {
	const hierarchy = ref<PlanHierarchyDto>(NO_HIERARCHY);
	const failed = ref(false);
	const writing = ref(false);
	let latest = 0;

	async function load(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		if (queries.hierarchy === undefined) return;
		const request = ++latest;
		const found = await queries.hierarchy(planId);
		if (request !== latest) return;
		failed.value = !found.ok;
		if (found.ok) hierarchy.value = found.value;
	}

	return { hierarchy, failed, writing, load };
});
