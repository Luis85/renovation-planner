import { inject, onBeforeUnmount, provide, reactive, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger } from '../../application/editor/WriteLedger';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { AssetId } from '../../domain/asset/AssetId';
import { useEditorStore } from '../stores/EditorStore';
import { useSelectionStore } from '../editor/selection/selection-store';
import { CommandHistory } from '../editor/tools/command-history';
import { createEditorContext } from '../editor/tools/editor-context';
import type { ToolId } from '../editor/tools/editor-tool';
import { RenderState } from '../editor/tools/render-state';
import { ToolManager } from '../editor/tools/tool-manager';
import { createToolSwitch } from '../editor/tools/tool-switch';
import { EDITOR_SNAP_SERVICE } from '../editor/snapping/editorSnapping';
import { editorViewportAdapter } from '../editor/viewport/editorViewportAdapter';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { knownDistanceSupplier } from '../editor/shell/knownDistance';
import { registerDesignerTools, type DesignerToolDeps } from './tools/registerDesignerTools';
import { withStateRefresh, type RefreshedHistory } from '../editor/tools/with-state-refresh';
import { wrapDispatcher } from '../editor/tools/wrap-dispatcher';
import { useSaveStateStore } from '../editor/save-state/save-state-store';
import { withSaveStateTracking } from '../editor/save-state/with-save-state-tracking';
import {
	mapDispatchFaults,
	notifyIfRefused,
	reportDispatchFailure,
	reportDispatchFault,
} from '../editor/report-failure';
import { notifyOperationFailure } from '../notices/notify';
import { useAssetDesignStore } from './stores/assetDesignStore';
import type { AssetDesignerContext } from './AssetDesignerContext';
import type { ReversibleAssetDesignCommands } from '../../application/editor/asset/ReversibleAssetDesignCommands';
import type { DocumentRef } from './ports';

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
 * copied — `withStateRefresh`, `wrapDispatcher` and `report-failure.ts`'s three last-stop doors
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
	 * Task B7's gesture: dispatch a picked reference through the reversible adapter, the same
	 * `undo`/`redo` shape every other click-bound gesture here takes. The empty state's action
	 * is its only caller — `AssetDesignerRoot.vue` awaits `context.picker.pick()` first, and a
	 * cancelled pick (`null`) never reaches this at all.
	 */
	readonly setBackground: (ref: DocumentRef) => Promise<void>;
	/**
	 * Task B8's gesture, the same shape as `setBackground` above and for the same reason: a
	 * click-bound dispatch with no field to show a refusal under, so it swallows the `Result`
	 * itself through `notifyIfRefused`/`reportDispatchFault` rather than handing it back. TWO
	 * callers — `AssetDesignerRoot`'s empty-state action for `noShape`, and
	 * `DesignerInspector`'s own "Edit dimensions" gesture — both reached only once the
	 * `asset-dimensions` dialog has resolved a real rectangle, never for a cancelled pick.
	 */
	readonly setFootprintFromDimensions: (width: number, depth: number) => Promise<void>;
	/**
	 * Task B8's height field, dispatched through `toolDispatcher` rather than through
	 * `setBackground`'s pattern: `useFieldCommit` needs the raw `Result` to route a refusal
	 * under the field it is about, so this RESOLVES rather than swallowing — the same reason
	 * every tool gesture below takes `toolDispatcher` instead of the bare `dispatcher`.
	 */
	readonly commitHeight: (height: number | null) => Promise<DispatchResult>;
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
	/**
	 * This leaf's tool framework (design slice B5). Held HERE rather than inside
	 * `DesignerCanvas`, which is where Task B4 built it while nothing registered a tool: the
	 * toolbar mounts in the shell's own region and is not the canvas's child, so a manager
	 * local to the canvas is a manager no control can reach.
	 */
	readonly toolManager: ToolManager;
	/**
	 * The reactive proxy over `RenderState` (SDD §19's transient visuals). Tools write plain
	 * fields; a layer reading them reactively is what would DRAW them — and this canvas has no
	 * such layer yet, which `registerDesignerTools` records where the tools are.
	 */
	readonly renderState: RenderState;
	/** The active tool id, `null` for camera mode; mirrors `ToolManager` reactively. */
	readonly activeToolId: Ref<ToolId | null>;
	readonly setTool: (id: ToolId | null) => void;
}

/**
 * The log event name this leaf's click-bound dispatches fault under, named once so a log line
 * saying which door faulted stays true while both doors agree what to call themselves.
 */
const DISPATCH_FAULT_EVENT = 'designer.dispatch.faulted';

/**
 * The three dependencies `CalibrateTool` needs that no other designer tool does (Task B6),
 * built here rather than inline so `buildRuntime` stays under its 100-line function budget and
 * so the two dialogs this gesture may open sit together in the order it opens them.
 *
 * Both go through THIS leaf's own `DialogStore`, so a calibration in one split pane cannot trap
 * the other — `DialogHost` is per view for exactly that reason.
 *
 * **`hasGeometryToRescale` asks about the PENDING flags and not about whether a shape exists**,
 * which is where this surface's answer differs from the Plan Editor's. A plan's calibration
 * rescales every coordinate it owns, so "are there zones" is the whole question there. An
 * asset's converts exactly the coordinate groups captured before a scale existed and leaves
 * every measured one alone, so an asset with a footprint and nothing pending has nothing to
 * lose and is never asked. It reads `store.design` PER CALL: a designer leaf traces, calibrates
 * and re-traces without remounting, so a snapshot taken here would answer about the asset as it
 * was at mount for the rest of the leaf's life.
 */
function calibrationDeps(
	dialogs: ReturnType<typeof useDialogStore>,
	store: ReturnType<typeof useAssetDesignStore>,
): Pick<DesignerToolDeps, 'supplyKnownDistance' | 'hasGeometryToRescale' | 'confirmRecalibration'> {
	return {
		hasGeometryToRescale: () => {
			const shape = store.design?.shape ?? null;
			return shape !== null && (shape.footprintPending || shape.clearancePending || shape.anchorPending);
		},
		confirmRecalibration: async () =>
			(await dialogs.openDialog({
				kind: 'confirm',
				title: tr('designer.calibrate.recalibrate.title'),
				message: tr('designer.calibrate.recalibrate.message'),
				danger: true,
			})) === 'confirm',
		supplyKnownDistance: knownDistanceSupplier(dialogs),
	};
}

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

	// The tools' own door: the same dispatcher, with `run` mapped so it RESOLVES a coded refusal
	// instead of rejecting. A tool dispatches detached, so an unmapped rejection was an unhandled
	// one and the gesture said nothing. `EditorContextDeps` requires the mapped form, which is
	// what stops this surface — or a third — from composing a context without it.
	const toolDispatcher = mapDispatchFaults(dispatcher, context.logger, DISPATCH_FAULT_EVENT);

	/**
	 * The ONE cast in this file, and the shape `presentation/editor/runtime.ts` already draws
	 * for a plan. Obsidian persists an asset id in its per-leaf view state as an opaque string,
	 * so `AssetDesignerContext.assetId` is a `string` and nothing at runtime can verify a
	 * phantom brand. Narrowing it HERE, at the single point that value enters the tool
	 * framework, is what keeps every command input below honestly branded — and it is read by
	 * both consumers, `subject` widening it back to the `EntityId<string>` every tool sees and
	 * the tools' own deps taking it branded, so the two cannot disagree about which asset this
	 * leaf is designing.
	 */
	const assetId = context.assetId as AssetId;

	// Both stores are resolved during SETUP and closed over, never inside the context factory
	// below: a Pinia store may not be touched without an active instance, and that factory runs
	// from a toolbar click long after `setup` has returned.
	const editor = useEditorStore();
	const selection = useSelectionStore();

	// The camera as a tool sees it — the SAME function the Plan Editor's runtime binds
	// (`editor/viewport/editorViewportAdapter.ts`), not a second copy of five identical
	// members. It closes over this leaf's live camera ref.
	const viewportAdapter = editorViewportAdapter(editor);

	const renderState = reactive(new RenderState());
	/**
	 * TWO ledgers, because an asset is two resources under one id — see `DesignWriteLedgers`.
	 * Only the geometry one is reachable from this slice's tools, all four of which write the
	 * sidecar; the note ledger exists because the adapters take both and Task B8's height field
	 * writes through the other.
	 */
	const noteLedger = new SessionWriteLedger();
	const geometryLedger = new SessionWriteLedger();
	const edits: ReversibleAssetDesignCommands = context.commands.designEdits({ noteLedger, geometryLedger });

	/**
	 * A FRESH context per activation, through the same assembler the Plan Editor uses — which
	 * is the guarantee `ToolManager`'s header states its factory exists for, and which one
	 * object built once could not give. `subject.calibration` is the live one: an asset's
	 * background is calibrated by the `calibrate` tool this very function registers, and a tool
	 * that had captured `null` at mount would report placeholder-scale lengths on a calibrated
	 * asset for the rest of the leaf's life — including the calibration tool's own next gesture,
	 * which derives its correction against the calibration it finds there.
	 *
	 * `writeLedger` is the GEOMETRY one, and the asymmetry is worth naming: `EditorContext`
	 * declares a single ledger because a Plan is a single resource, and every tool this surface
	 * registers that writes anything writes the sidecar. Nothing reads it through the context —
	 * every adapter takes both ledgers directly — so a tool that reached for it would get the
	 * right one, which is the only reason there is a defensible answer at all.
	 */
	const toolManager = new ToolManager(() =>
		createEditorContext({
			bindViewport: () => viewportAdapter,
			selection,
			snapService: EDITOR_SNAP_SERVICE,
			commandDispatcher: toolDispatcher,
			writeLedger: geometryLedger,
			renderState,
			subject: { id: assetId, calibration: store.design?.calibration ?? null },
		}),
	);
	/**
	 * The reactive mirror of `ToolManager`'s non-reactive pointer, held in `EditorStore` rather
	 * than in a second ref beside it — the seam `DesignerCanvas` already reads and hands to
	 * `EditorSurface`. The manager stays framework-pure (no Vue), so ONE mirror at this seam is
	 * what a Vue consumer reads, and `setTool` is the one writer of both.
	 *
	 * Hoisted above `registerDesignerTools` (Task 10) so `returnToCamera` exists in time to be
	 * threaded into the two trace tools' `onCompleted` below — `toolManager` is already built
	 * at this point, which is all `createToolSwitch` needs.
	 */
	const { activeToolId } = storeToRefs(editor);
	const setTool = createToolSwitch(toolManager, activeToolId);
	// This surface registers no `select` tool (see `DESIGNER_TOOL_LABELS`'s own note), so a
	// completed trace returns to camera mode — `setTool(null)` — rather than to a tool that
	// does not exist.
	const returnToCamera = (): void => setTool(null);

	registerDesignerTools(toolManager, {
		assetId,
		edits,
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		returnToCamera,
		...calibrationDeps(useDialogStore(), store),
	});

	// Both halves of SDD §65 — a THROWN fault and a RESOLVED refusal — bound straight to
	// toolbar clicks, which discard the promise they are handed.
	async function undo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, dispatcher.undo()));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, dispatcher.redo()));
	}
	async function setBackground(ref: DocumentRef): Promise<void> {
		await notifyIfRefused(
			reportDispatchFault(
				context.logger,
				DISPATCH_FAULT_EVENT,
				dispatcher.run(edits.setBackground({ assetId, path: ref.path, kind: ref.kind, page: ref.page })),
			),
		);
	}
	async function setFootprintFromDimensions(width: number, depth: number): Promise<void> {
		await notifyIfRefused(
			reportDispatchFault(
				context.logger,
				DISPATCH_FAULT_EVENT,
				dispatcher.run(edits.setFootprintFromDimensions({ assetId, width, depth })),
			),
		);
	}
	function commitHeight(height: number | null): Promise<DispatchResult> {
		return toolDispatcher.run(edits.setHeight({ assetId, height }));
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

	return {
		dispatcher,
		canUndo,
		canRedo,
		undo,
		redo,
		setBackground,
		setFootprintFromDimensions,
		commitHeight,
		hydrate,
		toolManager,
		renderState,
		activeToolId,
		setTool,
	};
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
