import { inject, onBeforeUnmount, provide, type InjectionKey, type Ref } from 'vue';
import { CommandHistory } from '../editor/tools/command-history';
import { withStateRefresh, type RefreshedHistory } from '../editor/tools/with-state-refresh';
import { wrapDispatcher } from '../editor/tools/wrap-dispatcher';
import { useSaveStateStore } from '../editor/save-state/save-state-store';
import { withSaveStateTracking } from '../editor/save-state/with-save-state-tracking';
import { notifyIfRefused, reportDispatchFault } from '../editor/report-failure';
import { useAssetDesignStore } from './stores/assetDesignStore';
import type { AssetDesignerContext } from './AssetDesignerContext';

/**
 * One asset designer leaf's live machinery (Task B3a): the undo history, the refresh that
 * puts a committed write on the canvas, and the one dispatcher everything in this leaf goes
 * through.
 *
 * Built INSIDE the Vue tree — `AssetDesignerRoot`'s setup — because half of it is Pinia state
 * and a Pinia store may not be touched before its app's instance is active. It is provided
 * once under `DESIGNER_RUNTIME` and injected by the regions that need it; everything here is
 * per-leaf state (ADR-0004), which is why this is not a module singleton.
 *
 * **Without this, every write in this increment is invisible until the leaf is reopened.**
 * A command writes the note or the sidecar and answers a `Result`; nothing re-reads, so the
 * canvas goes on drawing what it read at mount. `provideEditorRuntime` solves the same problem
 * for the plan editor, and the three mechanisms it solves it with are shared rather than
 * copied — `withStateRefresh`, `wrapDispatcher` and `report-failure.ts`'s two last-stop doors
 * are all in `presentation/editor/` and take their subject as a parameter.
 */
export interface DesignerRuntime {
	/** The decorated history every dispatch in this leaf funnels through. */
	readonly dispatcher: RefreshedHistory;
	/** Mirrors `CommandHistory` reactively; a dispatch that bypasses `dispatcher` freezes both. */
	readonly canUndo: Readonly<Ref<boolean>>;
	readonly canRedo: Readonly<Ref<boolean>>;
	readonly undo: () => Promise<void>;
	readonly redo: () => Promise<void>;
	/**
	 * Re-read this leaf's design from nothing, blanking it if the read fails. TWO callers — the
	 * mount and the failure state's retry — and the cross-leaf subscription is deliberately not
	 * one of them: it has content on screen to keep, so it takes `refresh` below instead.
	 *
	 * It said "three callers", the third being that subscription, and it was accurate about the
	 * routing and wrong about the split — see `refresh` below, which is where the subscription
	 * belongs and now goes. A comment naming its callers is a fact about the routing, so it is
	 * rewritten by the edit that moves one.
	 */
	readonly hydrate: () => Promise<void>;
}

/**
 * The log event name this leaf's click-bound dispatches fault under, named once so a log line
 * saying which door faulted stays true while both doors agree what to call themselves.
 */
const DISPATCH_FAULT_EVENT = 'designer.dispatch.faulted';

function buildRuntime(context: AssetDesignerContext): DesignerRuntime {
	const store = useAssetDesignStore();
	const history = new CommandHistory();

	/**
	 * `indexScanCompleted` is read PER CALL and never captured. It starts false in every
	 * session and turns true once, when `onLayoutReady` has run the vault scan — so a runtime
	 * that snapshotted it at mount would hold `false` for the life of a restored leaf and go on
	 * declining to believe an authoritative miss forever.
	 */
	const read = (keepPreviousOnFailure: boolean): Promise<void> =>
		store.hydrate(context.queries, context.assetId, {
			indexScanCompleted: context.indexScanCompleted(),
			keepPreviousOnFailure,
		});

	const hydrate = (): Promise<void> => read(false);

	/**
	 * The two doors are the SPLIT, named rather than spelled as a boolean at each call site:
	 * a refresh keeps what is on screen when its read fails, a hydration has nothing to keep.
	 * The same split `ProjectStore` draws, and the reason is that a refresh runs over content
	 * the vault already holds — blanking the canvas would replace "possibly stale" with
	 * definitely nothing.
	 *
	 * **`refresh` has TWO callers, and the second is why this is a named door.** The
	 * post-command read-back is the obvious one; the cross-leaf subscription below is the one
	 * that took `hydrate` and should not have. Whether WE made the write or a peer leaf did is
	 * not a difference the user's canvas can tell, so a transient failure re-reading after a
	 * peer's edit blanked a valid design and put the failure panel over it. A flag at each call
	 * site is a rule somebody has to remember at a third door; a named function is not.
	 *
	 * **What it cannot suppress**, in the two places `AssetDesignStore.hydrate` bounds it. A leaf
	 * with nothing on screen: the keep-previous arm is guarded on `status === 'ready'`, so the
	 * `ProjectIndexRebuilt` arm of `createAssetDesignChangeSource` — which reaches a leaf
	 * restored before the scan ran, and therefore not ready — falls through to `fail` exactly as
	 * it did before. And a read that ANSWERED rather than failed: an authoritative
	 * `asset.not-found` blanks, because the argument for keeping is "over data the vault has"
	 * and a deleted note is the case where it has none. That second bound was NARROWED by this
	 * change rather than merely inherited — `assetDesignerWiring.test.ts`'s design-change case
	 * is what found it, by using a deleted asset as its observable.
	 */
	const refresh = (): Promise<void> => read(true);

	const refreshed = withStateRefresh(history, refresh);

	// Outside the refresh decorator, so `Saved` never appears while the canvas still shows the
	// pre-command state; inside `wrapDispatcher`, which is the one object a leaf hands out.
	const tracked = withSaveStateTracking(refreshed, useSaveStateStore());

	const { dispatcher, canUndo, canRedo } = wrapDispatcher(history, tracked);

	// Both halves of SDD §65 — a THROWN fault and a RESOLVED refusal — bound straight to
	// toolbar clicks, which discard the promise they are handed.
	async function undo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, dispatcher.undo()));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, dispatcher.redo()));
	}

	/**
	 * A design change reaches every leaf showing that asset, and the index rebuild reaches a
	 * leaf restored before the scan ran — `createAssetDesignChangeSource` carries both and
	 * this view learns neither event's name.
	 *
	 * **DISPOSED from the Vue lifecycle, and that is not tidiness.** The bus is the composition
	 * root's and outlives every leaf; `EventBus.subscribe` removes a handler on `dispose` and
	 * by no other mechanism. An undisposed handler therefore keeps this leaf's whole Pinia
	 * store reachable from the root for the rest of the session and issues a design read
	 * from a dead leaf on every later design edit — one more per designer the user has ever
	 * opened. `PlanEditorRoot` disposes `onPlanChanged` the same way and for the same reason.
	 */
	onBeforeUnmount(
		context.onDesignChanged(() => {
			void refresh();
		}),
	);

	return { dispatcher, canUndo, canRedo, undo, redo, hydrate };
}

const DESIGNER_RUNTIME: InjectionKey<DesignerRuntime> = Symbol('renovation-planner:designer-runtime');

export function provideDesignerRuntime(context: AssetDesignerContext): DesignerRuntime {
	const runtime = buildRuntime(context);
	provide(DESIGNER_RUNTIME, runtime);
	return runtime;
}

export function useDesignerRuntime(): DesignerRuntime {
	const runtime = inject(DESIGNER_RUNTIME);
	if (runtime === undefined) {
		throw new Error('The asset designer was mounted without a DesignerRuntime.');
	}
	return runtime;
}
