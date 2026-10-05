import { computed, onBeforeUnmount, useId, type Ref } from 'vue';
import { createLatestRead } from '../composables/latest-read';
import { createPlanningRefresh } from './planning/planningRefresh';
import { useRenovationSession } from './renovation/renovationSession';
import { useProjectStore } from '../stores/ProjectStore';
import { CommandHistory } from './tools/command-history';
import { createProjectionRefresh } from './tools/with-editor-state-refresh';
import { withStateRefresh, type RefreshedHistory } from './tools/with-state-refresh';
import { withStaleGate } from './tools/with-stale-gate';
import { withIncidentGate } from './tools/with-incident-gate';
import { wrapDispatcher } from './tools/wrap-dispatcher';
import { useSaveStateStore } from './save-state/save-state-store';
import { withSaveStateTracking } from './save-state/with-save-state-tracking';
import type { PlanEditorContext } from './PlanEditorContext';

/**
 * Every leaf's ONE dispatcher (design slice 8), widened by the trust path (design spec §2.2,
 * §2.3, §2.9).
 *
 * It was pulled out of `buildRuntime` for that function's `max-lines-per-function` budget —
 * the same budget that has already pushed `createRoomCreationAction`, `selectAndFrameOn` and
 * `subscribeToChangedFigures` out of it — and out of `runtime.ts` into this module for the
 * FILE's `max-lines` cap, which the incident gate's own wiring took one line past 400. Neither
 * move was for a shared caller: `runtime.ts`'s `buildRuntime` is still the only call site.
 *
 * The chain: `CommandHistory` → `withStateRefresh` (the named `refreshProjection`, §2.3) →
 * `withSaveStateTracking` → the stale gate (§2.2, AFTER the tracker so a refusal opens no
 * saving batch) → `wrapDispatcher` (BEFORE which the gate sits, so the undo/redo flags still
 * refresh). `writesBlocked` is the one computed both this leaf's shell and
 * `EditorContext.writesBlocked` read; `pausedReasonId` is one `useId()` per leaf (§2.9) — legal
 * here because this runs synchronously from `buildRuntime`, itself the first statement of
 * `provideEditorRuntime`, itself called from `PlanEditorRoot`'s `setup()`. FOUR hops, named
 * rather than compressed to three, with no `await` between any of those calls and this one.
 *
 * `inspectorRef` travels back out because its `current` is not assigned until AFTER the
 * Inspector store exists, which needs `wrappedDispatcher` to be built first — the same
 * mutable-cell break `buildRuntime` used before this extraction.
 */
export function buildDispatcherChain(
	context: PlanEditorContext,
): {
	readonly planning: ReturnType<typeof createPlanningRefresh>;
	readonly wrappedDispatcher: RefreshedHistory;
	readonly canUndo: Ref<boolean>;
	readonly canRedo: Ref<boolean>;
	readonly refreshProjection: () => Promise<void>;
	readonly writesBlocked: Readonly<Ref<boolean>>;
	readonly pausedReasonId: string;
	readonly inspectorRef: { current: { refresh(): Promise<void>; invalidate(): void } | null };
} {
	const projectStore = useProjectStore(), session = useRenovationSession();
	const history = new CommandHistory();
	const inspectorRef: { current: { refresh(): Promise<void>; invalidate(): void } | null } = { current: null };
	const planning = createPlanningRefresh(context);
	const refreshSpatial = createProjectionRefresh({
		projectStore,
		// The cell breaks construction order and is retired on disposal. A late hydration
		// must not start another Inspector query after the editor has closed.
		// A superseded hydration leaves refreshing set for its queued replacement. Its
		// Inspector query must wait for that replacement's scene instead of reading now.
		inspectorStore: { refresh: async () => { if (!projectStore.refreshing) await inspectorRef.current?.refresh(); } },
		queries: context.queries,
		planId: context.planId,
	});
	const spatialReads = createLatestRead(refreshSpatial, () => {});
	let active = true;
	const refreshProjection = async (): Promise<void> => {
		if (!active) return;
		projectStore.invalidateHydration(); inspectorRef.current?.invalidate();
		await Promise.all([spatialReads.refresh(), planning.refresh()]);
	};
	onBeforeUnmount(() => { active = false; inspectorRef.current?.invalidate(); inspectorRef.current = null; spatialReads.dispose(); projectStore.cancelHydration(); });
	const dispatcher = withStateRefresh(history, refreshProjection);
	const save = useSaveStateStore();
	const tracked = withSaveStateTracking(dispatcher, save);
	const unsafeHistory = (): boolean => planning.failed.value || save.unrecoveredWrite;
	/**
	 * **`status !== 'ready'` is the first term because a refusal does not survive a remount
	 * and cannot be re-derived after one** (BP-03 / F2, lifecycle contract rule 3). A settings
	 * change is `unmount(); sync()` with a fresh `createPinia()`, so an active stale read-back
	 * is destroyed with its store; `handleFailedRead` then sets `stale` only while
	 * `status === 'ready'`, and a fresh store starts `'idle'` — so the SAME refusing read
	 * routes to `fail()` instead and the refusal is gone. Both terminal states are safe
	 * (an error screen, or a legitimately current canvas); the exposure measured was the
	 * TRANSIT, one whole vault read wide, in which `writesBlocked` was false and a dispatch
	 * into it executed.
	 *
	 * Blocking on `'idle'` alone does not close it: `hydrate` sets `status = 'loading'` on
	 * its first line, so `'idle'` lasts one synchronous tick and `'loading'` lasts the read.
	 *
	 * **It costs ordinary editing nothing, by construction rather than by luck.** `hydrate`
	 * leaves `status` at `'ready'` for a re-hydration (`if (status.value !== 'ready')`), so
	 * the post-command refresh and the `onPlanChanged` refresh never pass through a non-ready
	 * status. The states this adds are the first load, a load after a failure, `missing` and
	 * `failed` — none of which draws a canvas, and that one clause rests on one citation:
	 * `PlanEditorRoot.vue` gates the canvas on `status === 'ready'`. `editorArrival.ts` is
	 * evidence for something else and is cited here as that — the predicate is IDIOMATIC
	 * rather than new, since its own refusal already reads
	 * `project.status !== 'ready' || runtime.writesBlocked.value`. A consequence of this
	 * change worth knowing there: that first operand is now wholly subsumed by its second.
	 *
	 * **What this predicate does NOT do is keep the paused SENTENCE honest.** The hidden
	 * `editor.paused.reason` names a failed re-read after the last change, which is false in
	 * every state this term adds, so `PlanEditorRoot.vue` renders that sentence on the
	 * narrower `stale || planning.failed || unrecoveredWrite` instead of on this computed.
	 * Blocked and blocked-for-a-stated-cause are two questions now; see that template's own
	 * comment for what holds the `aria-describedby` references honest across the split.
	 */
	const writesBlocked = computed(() => projectStore.status !== 'ready' || projectStore.stale || unsafeHistory());
	const gated = withIncidentGate(withStaleGate(tracked, () => writesBlocked.value || session.perspective === 'review', unsafeHistory));
	const historyState = wrapDispatcher(history, gated);
	const wrappedDispatcher = historyState.dispatcher;
	const canUndo = computed(() => !unsafeHistory() && historyState.canUndo.value);
	const canRedo = computed(() => !unsafeHistory() && historyState.canRedo.value);
	const pausedReasonId = useId();
	return { planning, wrappedDispatcher, canUndo, canRedo, refreshProjection, writesBlocked, pausedReasonId, inspectorRef };
}
