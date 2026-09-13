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
 *
 * `settled` is the other half of that guarantee. Latest-wins means a `load` can be SUPERSEDED —
 * another leaf's event starting a read after `write()`'s own re-read has — and then `write()`'s
 * `await load` returns with the older tree still on screen; `writing` would clear, and the next
 * accepted Alt+↑ would compute from a tree older than the write it follows. So `write()` holds
 * the flag on `settled()` — no read in flight at all — rather than on its own request.
 */
export const usePlanHierarchyStore = defineStore('plan-hierarchy', () => {
	const hierarchy = ref<PlanHierarchyDto>(NO_HIERARCHY);
	const failed = ref(false);
	const writing = ref(false);
	let latest = 0;
	/** The newest read still in flight — what `settled` waits on, superseded or not. */
	let inFlight: Promise<void> | null = null;

	/** Lands `request`'s answer unless a newer request has been made since — latest wins. */
	async function land(answer: ReturnType<NonNullable<PlanEditorQueryServices['hierarchy']>>, request: number): Promise<void> {
		const found = await answer;
		if (request !== latest) return;
		failed.value = !found.ok;
		if (found.ok) hierarchy.value = found.value;
	}

	async function load(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		if (queries.hierarchy === undefined) return;
		const request = ++latest;
		const read = land(queries.hierarchy(planId), request);
		inFlight = read;
		try {
			await read;
		} finally {
			if (inFlight === read) inFlight = null;
		}
	}

	/**
	 * Resolves once no read is in flight, including one started after the caller's own — and
	 * resolves, never rejects: a read that throws belongs to whoever started it (`PlanEditorRoot`'s
	 * `loadHierarchy` catches and reports its own), and re-throwing it here handed the same fault a
	 * second time to `usePlanReorder.write()`'s caller, which is a `void reorder.moveUp(…)` on a
	 * key press — an unhandled rejection — and skipped `PlanKindSelect`'s reset on the way.
	 */
	async function settled(): Promise<void> {
		for (let pending = inFlight; pending !== null; pending = inFlight) await pending.catch(() => undefined);
	}

	return { hierarchy, failed, writing, load, settled };
});
