import { inject, onBeforeUnmount, provide, reactive, ref, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger, type WriteLedger } from '../../application/editor/WriteLedger';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetShape } from '../../domain/asset/AssetShape';
import { captureAwaitsScale } from '../../domain/asset/captureAwaitsScale';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import type { SetAssetBackgroundInput } from '../../application/commands/asset/SetAssetBackground';
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import { boundsOfZones } from '../editor/viewport/zoneExtent';
import { useEditorStore } from '../stores/EditorStore';
import { useSelectionStore } from '../editor/selection/selection-store';
import { CommandHistory } from '../editor/tools/command-history';
import { createEditorContext } from '../editor/tools/editor-context';
import type { ToolId } from '../editor/tools/editor-tool';
import { RenderState } from '../editor/tools/render-state';
import { ToolManager } from '../editor/tools/tool-manager';
import { createToolSwitch } from '../editor/tools/tool-switch';
import { createEditorSnapService } from '../editor/snapping/editorSnapping';
import { editorViewportAdapter } from '../editor/viewport/editorViewportAdapter';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { knownDistanceSupplier } from '../editor/shell/knownDistance';
import { registerDesignerTools, type DesignerToolDeps } from './tools/registerDesignerTools';
import type { DesignerSelectToolDeps } from './tools/designer-select-tool';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { designerCandidateSupply } from './grid/designerGrid';
import { createEditShape, createWriteChain, type EditShape } from './selection/editShape';
import { createPartView, type PartView } from './parts/partView';
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
	readonly setBackground: (document: DocumentRef) => Promise<void>;
	/**
	 * AD12-R2's gesture: take the reference away again, through the very command that replaces
	 * one — `SetAssetBackgroundInput`'s `path: null` arm — so the calibration clear, the
	 * compensation and the undo entry are the ones that already exist rather than a second set.
	 * `setBackground`'s shape and for its reason: a click-bound dispatch with no field to show a
	 * refusal under, so it swallows its own `Result`.
	 *
	 * It is safe on an asset that has no reference — `sameBackground(null, null)` answers
	 * `no-write` — and no control calls it there anyway: `DesignerReferenceStatus` draws the
	 * button only while `design.background !== null`, which is the predicate rule rather than a
	 * `:disabled`.
	 */
	readonly removeBackground: () => Promise<void>;
	/**
	 * How opaque this leaf draws the reference, `1` fully (AD12-R1's genuine gap: fading a sheet
	 * to trace over it).
	 *
	 * **A leaf-local VIEW preference, written nowhere** — `PartView`'s shape exactly. It reaches
	 * no command, no note, no sidecar and no undo entry, it is not remembered per device beside
	 * `gridVisible` and `snappingEnabled`, and it does not survive a reopened leaf: an editing aid
	 * is not output (C10), and AD01 §2's standing rule is that presentation holds the ephemeral
	 * state and the vault holds the documents.
	 *
	 * A `Ref` and not a getter for `multiSelectionMode`'s reason: `DesignerViewMenu` binds it with
	 * `v-model`.
	 *
	 * **LOCK is not here and is not deferred.** Every designer layer is built by
	 * `designerLayerConfig` with `listening: false` and no tool moves the background, so the
	 * property a lock names already holds and a control for it would be a switch with an
	 * unreachable off position (AD12-R1).
	 */
	readonly backgroundOpacity: Ref<number>;
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
	 * The preset dialog's gesture (asset designer symbols spec, Decision 7): one whole-shape write,
	 * one history entry. Swallows its `Result` through `notifyIfRefused`/`reportDispatchFault` for
	 * the reason `setFootprintFromDimensions` gives — a click-bound dispatch with no field to show a
	 * refusal under.
	 */
	readonly applyShape: (shape: AssetShape) => Promise<void>;
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
	 * fields, and `DesignerGestureLayer` reads them reactively to draw the gesture in progress.
	 */
	readonly renderState: RenderState;
	/** The active tool id, `null` for camera mode; mirrors `ToolManager` reactively. */
	readonly activeToolId: Ref<ToolId | null>;
	readonly setTool: (id: ToolId | null) => void;
	/**
	 * One whole-shape edit of the design this leaf holds, queued on the leaf's one write chain behind
	 * every gesture's write and read-back, and dispatched as ONE `SetAssetShape` conditional on the
	 * version its step reads — or not at all when the edit refuses, has nothing to do, or nothing is
	 * drawn (`selection/editShape.ts`). RESOLVES, like `commitHeight`, so a field can place a refusal
	 * beside itself; a key binding hands the result to `notifyIfRefused`.
	 */
	readonly editShape: EditShape;
	/**
	 * The sticky "select multiple" mode (AD08), per leaf, on the runtime rather than in the store
	 * for `PlanEditorRuntime.multiSelectionMode`'s reason: it is EPHEMERAL UI about how the next
	 * press behaves, not a fact about the design, and a panel reflow must not clear it.
	 *
	 * A `Ref` and not a getter, because the control binds to it with `v-model` — the Plan Editor's
	 * `PropertyLayerPanel` binds its own the same way.
	 */
	readonly multiSelectionMode: Ref<boolean>;
	/**
	 * The Parts panel's leaf-local view preferences (AD09): which graphics are hidden, which are
	 * locked, which group rows are collapsed.
	 *
	 * Here beside `multiSelectionMode` and for its reason: EPHEMERAL UI about how this leaf is being
	 * worked, never a fact about the design. It is read by the canvas (which graphics to draw) and by
	 * the Select tool (which press may start a drag), so it belongs to the leaf rather than to the
	 * panel that writes it — a panel-local set would leave both of those reading nothing.
	 */
	readonly partView: PartView;
}

/**
 * The log event name this leaf's click-bound dispatches fault under, named once so a log line
 * saying which door faulted stays true while both doors agree what to call themselves.
 */
const DISPATCH_FAULT_EVENT = 'designer.dispatch.faulted';

/**
 * The box around the whole design — the footprint and, when there is one, the clearance, since a
 * clearance reaches outside its outline and a fit that cropped it would hide the thing being
 * fitted. Arcs count: `boundsOfZones` hands each `CurvedPolygon` to `boundingBoxOf`, which reads
 * arc extrema (`layers.test.ts` holds that for a curved table's outer arc).
 *
 * ONE definition for its two callers, `DesignerCanvas.framedBounds` (`Shift+1`) and `applyShape`
 * below, so the fit after a preset cannot drift from the shortcut's.
 */
export function designFrame(shape: AssetShape): BoundingBox | null {
	return boundsOfZones([shape.footprint, ...(shape.clearance === null ? [] : [shape.clearance])]);
}

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
			return (
				shape !== null &&
				(shape.footprintPending || shape.clearancePending || shape.anchorPending || shape.details.some((detail) => detail.pending))
			);
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

/**
 * The Select tool's deps (symbols spec, Decision 10), built here rather than inline for
 * `calibrationDeps`' reason: `buildRuntime` sits at its 100-line budget. Every member reads the store
 * PER CALL, and the write is the reversible adapter conditional on the version the gesture read.
 */
function selectToolDeps(
	store: ReturnType<typeof useAssetDesignStore>,
	edits: ReversibleAssetDesignCommands,
	assetId: AssetId,
	chain: Pick<ReturnType<typeof createWriteChain>, 'writing' | 'settled'>,
	/**
	 * The leaf's EPHEMERAL UI, as one argument rather than two: the sticky select-multiple mode and
	 * the Parts panel's hidden and locked sets. Bundled because `selectToolDeps` sits at its
	 * five-parameter budget and because the two belong together — neither is a fact about the design,
	 * both are per-leaf, and both are read per press.
	 */
	ui: { readonly multiSelectionMode: Ref<boolean>; readonly partView: PartView },
): DesignerSelectToolDeps {
	return {
		design: () => {
			const design = store.design;
			return design?.shape ? { shape: design.shape, geometryVersion: design.geometryVersion } : null;
		},
		selection: () => store.selection,
		/**
		 * The WHOLE selection, beside the primary rather than instead of it (AD08). Two readers need
		 * the difference: a plain press inside a multi-part set must KEEP the set rather than collapse
		 * it to what was pressed, and an interrupted sweep must put back what its own press cleared —
		 * neither question can be answered from the primary alone.
		 *
		 * The tool holds no copy of it, which is C05's requirement rather than a preference: one list
		 * and a derived primary, never two that can disagree. `store.selected` is that list, and this
		 * reads it live on every ask.
		 */
		selected: () => store.selected,
		mode: () => store.mode,
		select: (next) => store.select(next),
		extend: (next) => store.extend(next),
		multiSelectionMode: () => ui.multiSelectionMode.value,
		locked: () => ui.partView.locked.value,
		hidden: () => ui.partView.hidden.value,
		setPreview: (shape) => store.setPreview(shape),
		createCommand: (shape, expected) => edits.setShape({ assetId, shape, expected }),
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		writing: chain.writing,
		settled: chain.settled,
	};
}

/**
 * This leaf's ONE write chain (symbols spec, Amendment 2) and the two doors onto it, built here for
 * `calibrationDeps`' reason: `buildRuntime` sits at its 100-line budget.
 *
 * - `toolDispatcher` is the tools' door, handed to every `EditorContext`: the leaf's dispatcher QUEUED on
 *   the chain, then mapped so `run` RESOLVES a coded refusal instead of rejecting. A tool dispatches
 *   detached, so an unmapped rejection was an unhandled one and the gesture said nothing;
 *   `EditorContextDeps` requires the mapped form, which is what stops this surface — or a third — from
 *   composing a context without it.
 * - `editShape` queues a step of its own that reads the design when it runs, and writes through a
 *   SECOND mapping of the same dispatcher that is NOT queued: a step dispatching through the queued door
 *   would wait behind itself for ever.
 *
 * `withStateRefresh`'s own queue is not the chain, measured rather than assumed: a step that finds
 * nothing to do would have to answer from inside a command's `execute`, and `CommandHistory` pushes an
 * undo entry for any ok result, `no-write` included; and the Select tool's hold needs to ask whether a
 * write is queued, which that decorator — shared with the plan editor — does not say.
 */
function designWrites(
	dispatcher: RefreshedHistory,
	logger: AssetDesignerContext['logger'],
	store: ReturnType<typeof useAssetDesignStore>,
	setShape: DesignerSelectToolDeps['createCommand'],
) {
	const chain = createWriteChain();
	const unqueued = mapDispatchFaults(dispatcher, logger, DISPATCH_FAULT_EVENT);
	return {
		chain,
		toolDispatcher: mapDispatchFaults({ run: (command) => chain.enqueue(() => dispatcher.run(command)) }, logger, DISPATCH_FAULT_EVENT),
		editShape: createEditShape(chain.enqueue, () => store.design, (shape, expected) => unqueued.run(setShape(shape, expected))),
	};
}

/**
 * Whether a drawn detail awaits a scale, built here for `calibrationDeps`' reason. It reads
 * `store.design` PER CALL, and is asked only after `selectTool.design()` answered a design, so
 * `store.design` is set by then.
 */
function detailDeps(store: ReturnType<typeof useAssetDesignStore>): Pick<DesignerToolDeps, 'detailPending'> {
	return {
		detailPending: (shape) => {
			const { calibration, background } = store.design as AssetDesignDto;
			return captureAwaitsScale(calibration !== null, background !== null, shape);
		},
	};
}

/**
 * This leaf's write machinery in one call: its TWO ledgers, the reversible adapters over them, the
 * serial chain and its two doors, and the sticky select-multiple mode.
 *
 * Extracted for `buildRuntime`'s 100-line budget, which AD08's mode pushed it over — and the five
 * belong together anyway: every one of them is per-LEAF state, which is exactly what may not be
 * shared between two designer leaves editing two assets.
 */
function writingFor(
	context: AssetDesignerContext,
	store: ReturnType<typeof useAssetDesignStore>,
	dispatcher: RefreshedHistory,
	assetId: AssetId,
): ReturnType<typeof designWrites> & {
	readonly edits: ReversibleAssetDesignCommands;
	readonly geometryLedger: WriteLedger;
	readonly multiSelectionMode: Ref<boolean>;
	readonly partView: PartView;
} {
	// TWO ledgers, because an asset is two resources under one id — `ReversibleAssetDesignDeps`
	// states the whole argument, and one ledger has the note's revision presented to the sidecar.
	const noteLedger = new SessionWriteLedger();
	const geometryLedger = new SessionWriteLedger();
	const edits: ReversibleAssetDesignCommands = context.commands.designEdits({ noteLedger, geometryLedger });
	return {
		edits,
		geometryLedger,
		multiSelectionMode: ref(false),
		partView: createPartView(),
		...designWrites(dispatcher, context.logger, store, (shape, expected) => edits.setShape({ assetId, shape, expected })),
	};
}

/**
 * The leaf's dispatcher, decorated in the order the two decorators require.
 *
 * `withSaveStateTracking` sits OUTSIDE the refresh decorator, so `Saved` never appears while the
 * canvas still shows the pre-command state, and INSIDE `wrapDispatcher`, which is the one object a
 * leaf hands out. Extracted for `buildRuntime`'s 100-line budget; the order is the behaviour and is
 * why the three lines stay together rather than being inlined at the call.
 */
function dispatchingFor(history: CommandHistory, refresh: () => Promise<void>): ReturnType<typeof wrapDispatcher> {
	return wrapDispatcher(history, withSaveStateTracking(withStateRefresh(history, refresh), useSaveStateStore()));
}

/**
 * The stores and camera adapters this leaf's tools see.
 *
 * Resolved during SETUP and closed over, never inside the context factory: a Pinia store may not be
 * touched without an active instance, and that factory runs from a toolbar click long after `setup`
 * has returned. The camera adapter is the SAME function the Plan Editor's runtime binds
 * (`editor/viewport/editorViewportAdapter.ts`) rather than a second copy of five identical members,
 * and the snap service reads this leaf's own Snap choice at every call — the grid reaches it only
 * while this leaf's grid is SHOWN (snapping spec §2.4).
 *
 * Extracted for `buildRuntime`'s 100-line budget.
 */
function leafStores(): {
	readonly editor: ReturnType<typeof useEditorStore>;
	readonly selection: ReturnType<typeof useSelectionStore>;
	readonly workspace: ReturnType<typeof useWorkspaceStore>;
	readonly viewportAdapter: ReturnType<typeof editorViewportAdapter>;
	readonly snapService: ReturnType<typeof createEditorSnapService>;
} {
	const editor = useEditorStore();
	return {
		editor,
		selection: useSelectionStore(),
		workspace: useWorkspaceStore(),
		viewportAdapter: editorViewportAdapter(editor),
		snapService: createEditorSnapService(() => editor.snappingEnabled),
	};
}

/**
 * This leaf's two READ doors, extracted for `buildRuntime`'s 100-line budget.
 *
 * `indexScanCompleted` is read PER CALL and never captured. It starts false in every
 * session and turns true once, when `onLayoutReady` has run the vault scan — so a runtime
 * that snapshotted it at mount would hold `false` for the life of a restored leaf and go on
 * declining to believe an authoritative miss forever.
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
function readingFor(
	context: AssetDesignerContext,
	store: ReturnType<typeof useAssetDesignStore>,
): { readonly hydrate: () => Promise<void>; readonly refresh: () => Promise<void> } {
	const read = (keepPreviousOnFailure: boolean): Promise<void> =>
		store.hydrate(context.queries, context.assetId, {
			indexScanCompleted: context.indexScanCompleted(),
			keepPreviousOnFailure,
		});
	return { hydrate: () => read(false), refresh: () => read(true) };
}

function buildRuntime(context: AssetDesignerContext): DesignerRuntime {
	const store = useAssetDesignStore();
	const history = new CommandHistory();
	const { hydrate, refresh } = readingFor(context, store);
	const { dispatcher, canUndo, canRedo } = dispatchingFor(history, refresh);

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

	const { editor, selection, workspace, viewportAdapter, snapService } = leafStores();

	const renderState = reactive(new RenderState());
	// A view preference and nothing else — see `DesignerRuntime.backgroundOpacity`. Here rather
	// than in `writingFor` because it writes nothing.
	const backgroundOpacity = ref(1);
	/**
	 * TWO ledgers, because an asset is two resources under one id — see `DesignWriteLedgers`.
	 * Only the geometry one is reachable from this surface's tools, every one of which writes the
	 * sidecar; the note ledger exists because the adapters take both and Task B8's height field
	 * writes through the other.
	 */
	const { edits, chain, toolDispatcher, editShape, geometryLedger, multiSelectionMode, partView } = writingFor(context, store, dispatcher, assetId);
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
			snapService,
			// The footprint's and every detail's vertices, edges and alignments and the anchor, minus the
			// part being dragged (snapping spec §2.2), and the grid while it is shown. `designerCandidateSupply`
			// lives beside `designerGrid` (spec §4.3) — the closure it replaces pushed this function over its
			// own line budget.
			snapCandidates: designerCandidateSupply(() => store.design?.shape ?? null, () => workspace.gridVisible, () => viewportAdapter.worldPerScreenPixel()),
			commandDispatcher: toolDispatcher,
			writeLedger: geometryLedger,
			renderState,
			subject: { id: assetId, calibration: store.design?.calibration ?? null },
			// The Plan Editor's trust path (design spec §2.2) has no counterpart here: this surface
			// has no `ProjectStore`, and no tool it registers asks — only the Plan Editor's
			// `SelectTool` reads `context.writesBlocked()`, which `designerRefresh.test.ts`'s
			// 'answers false for writesBlocked' pins through the real context this builds.
			//
			// **A re-read here CAN go stale**, and this comment claimed otherwise until W18-C:
			// `assetDesignStore.stale` is set on a keep-on-failure re-read and is drawn by
			// `AssetDesignerRoot` — as a strip, and since W18-C as the save state's own
			// `Saved · refresh needed` qualifier. What is true is only the sentence below it:
			// nothing on this surface blocks a write on that account. Whether it SHOULD is a
			// behaviour question W18-C reported rather than answered.
			writesBlocked: () => false,
		}),
	);
	/**
	 * The reactive mirror of `ToolManager`'s non-reactive pointer, held in `EditorStore` rather
	 * than in a second ref beside it — the seam `DesignerCanvas` already reads and hands to
	 * `EditorSurface`. The manager stays framework-pure (no Vue), so ONE mirror at this seam is
	 * what a Vue consumer reads, and `setTool` is the one writer of both.
	 *
	 * Hoisted above `registerDesignerTools` so `setTool` exists in time to be threaded into every
	 * creating tool's `onCompleted` below — `toolManager` is already built at this point, which is
	 * all `createToolSwitch` needs.
	 */
	const { activeToolId } = storeToRefs(editor);
	const setTool = createToolSwitch(toolManager, activeToolId);

	registerDesignerTools(toolManager, {
		assetId,
		edits,
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		// A completed trace or drawn detail returns to Select, which this surface registers since Decision 10.
		returnToSelect: () => setTool('select'),
		selectTool: selectToolDeps(store, edits, assetId, chain, { multiSelectionMode, partView }),
		...calibrationDeps(useDialogStore(), store),
		...detailDeps(store),
	});

	// Both halves of SDD §65 — a THROWN fault and a RESOLVED refusal — bound straight to
	// toolbar clicks, which discard the promise they are handed.
	//
	// **Every one of them is QUEUED on the leaf's chain** (AD03), which they were not until this
	// task: undo, redo, Choose a drawing, Start from preset and the replace-with-a-rectangle half
	// of Set dimensions each dispatched straight past it. Nothing was ever overwritten — a gesture
	// made while one of them was still awaiting its read-back held the OLD version and was refused
	// as a conflict — but a refusal of the user's own next press is a worse answer than making it
	// wait, and undo could start before the write it was about had settled. Queued, the five
	// compose with every gesture instead of racing them.
	//
	// `chain.enqueue` and not `toolDispatcher`: `toolDispatcher` maps `run` alone, and undo/redo
	// are their own door on the dispatcher. None of the five is ever called from inside a queued
	// step, so none of them can wait behind itself — the deadlock `editShape` avoids by writing
	// through the UNQUEUED mapping.
	async function undo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, chain.enqueue(() => dispatcher.undo())));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, chain.enqueue(() => dispatcher.redo())));
	}
	// ONE dispatch for BOTH background gestures, because they differ only in the input: `path`
	// naming a document points the designer at it, `path: null` takes it away (AD12-R2). Two copies
	// of the enqueue-report-notify chain would be two places to change when the routing does — and
	// `buildRuntime`'s 100-line budget is the gate that said so, measured at 108 with the copy.
	async function dispatchBackground(input: SetAssetBackgroundInput): Promise<void> {
		await notifyIfRefused(
			reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, chain.enqueue(() => dispatcher.run(edits.setBackground(input)))),
		);
	}
	// `document` and not `ref`: this module imports Vue's own `ref` since AD08's selection mode, and
	// `no-shadow` fails the build on the collision — the same rename `onEmptyStateAction` made in
	// `AssetDesignerRoot.vue` when the background status arrived there.
	const setBackground = (document: DocumentRef): Promise<void> =>
		dispatchBackground({ assetId, path: document.path, kind: document.kind, page: document.page });
	const removeBackground = (): Promise<void> => dispatchBackground({ assetId, path: null });
	async function setFootprintFromDimensions(width: number, depth: number): Promise<void> {
		await notifyIfRefused(
			reportDispatchFault(
				context.logger,
				DISPATCH_FAULT_EVENT,
				chain.enqueue(() => dispatcher.run(edits.setFootprintFromDimensions({ assetId, width, depth }))),
			),
		);
	}
	async function applyShape(shape: AssetShape): Promise<void> {
		const result = await reportDispatchFault(
			context.logger,
			DISPATCH_FAULT_EVENT,
			chain.enqueue(() => dispatcher.run(edits.setShape({ assetId, shape }))),
		);
		await notifyIfRefused(Promise.resolve(result));
		// A preset is centred on the origin at whatever size was typed, so it can land wholly outside
		// the view it was applied from. A WRITTEN shape is framed as `Shift+1` frames it — the same
		// `fitTo` the plan editor's `selectAndFrame` takes. An OPENED asset is framed once by `DesignerCanvas`.
		const bounds = designFrame(shape);
		if (result?.ok === true && bounds !== null) editor.fitTo(bounds, editor.stageSize);
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
		removeBackground,
		backgroundOpacity,
		setFootprintFromDimensions,
		applyShape,
		commitHeight,
		hydrate,
		toolManager,
		renderState,
		activeToolId,
		setTool,
		editShape,
		multiSelectionMode,
		partView,
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
