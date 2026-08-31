import { inject, onBeforeUnmount, provide, reactive, ref, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger } from '../../application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../application/commands/zone/reversible-create-zone-command';
import type { DispatchOutcome } from '../../application/commands/DispatchOutcome';
import { createInspector } from './inspector-wiring';
import type { AppError } from '../../core/errors/AppError';
import type { Logger } from '../../application/ports/Logger';
import type { Result } from '../../core/result/Result';
import type { EntityId } from '../../core/identity/EntityId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import { useEditorStore } from '../stores/EditorStore';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import type { InspectorDto, InspectorEdit } from './inspector/inspector-store';
import type { RequirementInspectorDTO } from '../../application/queries/GetRequirementsForZone';
import { CommandHistory } from './tools/command-history';
import { createEditorContext, type EditorContext } from './tools/editor-context';
import type { ToolId } from './tools/editor-tool';
import { ReversibleMoveZoneCommand } from './tools/reversible-move-zone-command';
import { RenderState } from './tools/render-state';
import { ToolManager } from './tools/tool-manager';
import { CalibrateTool } from './tools/calibrate-tool';
import { DrawPolygonTool } from './tools/draw-polygon-tool';
import { SelectTool } from './tools/select-tool';
import { withEditorStateRefresh } from './tools/with-editor-state-refresh';
import { useSaveStateStore } from './save-state/save-state-store';
import { withSaveStateTracking } from './save-state/with-save-state-tracking';
import { useDialogStore } from '../dialogs/dialog-store';
import KnownDistanceForm from './shell/KnownDistanceForm.vue';
import { SnapService } from './snapping/snap-service';
import { STAGE_PIXELS, screenToWorld, worldPerScreenPixel, worldToScreen } from './viewport/Viewport';
import { tr } from '../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import { reportDispatchFailure } from './report-failure';
import type { PlanEditorContext } from './PlanEditorContext';
import { deleteZoneWithReferences, type DeleteZoneFlowDeps } from './deleteZoneFlow';
import { makeCommitField } from './commitField';

/**
 * One Plan Editor leaf's live machinery (design slice 8): the history and its refresh
 * decorator, the tool manager with its concrete tools, and the stores those tools read.
 *
 * Built INSIDE the Vue tree — `PlanEditorRoot`'s setup — because half of it is Pinia
 * state, and a Pinia store may not be touched before its app's instance is active. It is
 * provided once under `EDITOR_RUNTIME` and injected by the three regions that need it;
 * everything here is per-leaf state (ADR-004), which is why this is not a module
 * singleton.
 */

/**
 * The snap service's configuration, and a plain statement of what it currently buys:
 * **nothing yet.** `SnapService.snapPoint` ranks the candidate vertices and edges it is
 * handed and never consults the grid, and both tools in this slice pass an EMPTY candidate
 * set — so `snapPoint` is provably the identity function today and these two numbers reach
 * no arithmetic. The service is wired at the seam it will be used from, which is worth
 * having; the grid it is configured with is not reachable until a caller supplies
 * candidates (the neighbouring zones' vertices and edges, plus `snapToGrid`, which has no
 * caller in `src/` at all).
 *
 * Said here because three comments in the tools used to describe grid snapping as
 * something that happens. The manual case had it right all along —
 * `docs/tests/cases/Zone Editing Walkthrough.md`: "SnapService is wired but this slice
 * hands it no candidate geometry, so nothing visibly snaps yet."
 */
const SNAP_GRID_MM = 100;
const SNAP_TOLERANCE_MM = 8;

/** Stateless (config-only), so one instance serves every leaf. */
const SNAP_SERVICE = new SnapService({
	gridSpacingMm: SNAP_GRID_MM,
	toleranceMm: SNAP_TOLERANCE_MM,
	angleStepRadians: Math.PI / 12,
});

export interface EditorRuntime {
	/** The decorated history every dispatch in this leaf funnels through. */
	readonly dispatcher: ReturnType<typeof withEditorStateRefresh>;
	readonly toolManager: ToolManager;
	/**
	 * The reactive proxy over this leaf's `RenderState` (SDD §19's transient visuals).
	 * Tools write plain fields; the InteractionLayer reads them reactively.
	 */
	readonly renderState: RenderState;
	/** The active tool id, `null` for camera mode; mirrors `ToolManager` reactively. */
	readonly activeToolId: Ref<ToolId | null>;
	readonly setTool: (id: ToolId | null) => void;
	readonly undo: () => Promise<void>;
	readonly redo: () => Promise<void>;
	readonly canUndo: Readonly<Ref<boolean>>;
	readonly canRedo: Readonly<Ref<boolean>>;
	readonly inspectorDto: Readonly<Ref<InspectorDto>>;
	/** The Requirements panel's rows for the selected zone (design slice 10). */
	readonly inspectorRequirements: Readonly<Ref<readonly RequirementInspectorDTO[]>>;
	/** Selection → DTO (SDD §59's first arrow), for the panel's watcher. */
	readonly hydrateInspector: (ids: readonly EntityId<string>[]) => Promise<void>;
	/** `zoneName` is the dialog's `entityLabel` — the user's own text, resolved by nothing. */
	readonly deleteZone: (zoneId: ZoneId, zoneName: string) => Promise<void>;
	/** Any panel edit — assign, override, reset — through the ONE dispatch path. Answers whether it landed. */
	readonly commitEdit: (edit: InspectorEdit) => Promise<boolean>;
	/**
	 * The two override fields' door into the same commit path (design slice 16): guards
	 * only the THROWN half (`commitField.ts`'s `makeCommitField`). A RESOLVED refusal is
	 * `useFieldCommit`'s own `notify` to route, not this function's to announce.
	 */
	readonly commitField: (edit: InspectorEdit) => Promise<DispatchResult>;
	/** The assign-asset picker's options: the vault's whole catalogue, narrowed by no project. */
	readonly assetOptions: Readonly<Ref<readonly { readonly id: string; readonly name: string }[]>>;
}


/** The concrete tools of this slice, registered against one shared context factory. */
function registerEditorTools(
	toolManager: ToolManager,
	context: PlanEditorContext,
	projectStore: ReturnType<typeof useProjectStore>,
	ledger: SessionWriteLedger,
	dialogs: ReturnType<typeof useDialogStore>,
): void {
	toolManager.register(
		new SelectTool({
			spatialObjects: () =>
				[...projectStore.zones.values()].map((zone) => ({ id: zone.id, points: zone.points })),
			// Body drags AND vertex drags produce the same command: a vertex drag is a
			// whole-geometry replacement in which one point differs, so there is one adapter
			// and only forward/inverse change.
			createMoveGesture: (zoneId, forward, inverse) =>
				new ReversibleMoveZoneCommand(context.commands.moveObject, ledger, zoneId, forward, inverse),
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
	toolManager.register(
		new DrawPolygonTool({
			createCommand: (input) =>
				new ReversibleCreateZoneCommand(
					context.commands.createZone,
					context.commands.deleteZone,
					context.commands.zones,
					ledger,
					input,
				),
			nextZoneName: () => `${tr('editor.zone.default-name')} ${projectStore.zones.size + 1}`,
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
	toolManager.register(
		new CalibrateTool({
			// The two dialogs this gesture may open, in the order it opens them. Both go
			// through the leaf's OWN store, so a calibration in one split pane cannot trap
			// the other — `DialogHost` is per view for exactly that reason.
			hasSpatialObjects: () => projectStore.zones.size > 0,
			confirmRecalibration: async () =>
				(await dialogs.openDialog({
					kind: 'confirm',
					title: tr('editor.calibrate.recalibrate.title'),
					message: tr('editor.calibrate.recalibrate.message'),
					danger: true,
				})) === 'confirm',
			supplyKnownDistance: async (measured) => {
				const result = await dialogs.openDialog({
					kind: 'form',
					title: tr('editor.calibrate.distance.title'),
					component: KnownDistanceForm,
					props: { measured },
				});
				// `null` is this seam's word for "dismissed", and the tool refuses a
				// non-number anyway — but narrowing HERE keeps the `unknown` the form
				// container deliberately carries from reaching the command's input.
				if (result === 'cancel' || typeof result.values !== 'number') return null;
				return result.values;
			},
			createCommand: () => context.commands.calibratePlan(),
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
}

type DispatchResult = Result<DispatchOutcome, AppError>;

/**
 * The last stop for an UNEXPECTED technical fault on a dispatch (SDD §65 reserves throws
 * for those; every expected failure is a `Result`). Resolves `null` when one happened, so
 * a caller can tell "the dispatch reported a refusal" from "the dispatch never got to
 * report anything".
 *
 * It exists because every dispatch in this leaf is ultimately bound to a click handler —
 * `@click="runtime.undo()"`, the Inspector's delete — and a Vue click handler discards the
 * promise it is handed. Without this, a fault surfaced as a console unhandled rejection
 * and the UI simply stopped responding to that button, which is the one failure mode worse
 * than an error message.
 */
async function reportFault(logger: Logger, operation: Promise<DispatchResult>): Promise<DispatchResult | null> {
	try {
		return await operation;
	} catch (cause) {
		// A technical fault escaping a dispatch. There is no `AppError` to translate here —
		// it never reached a guard, or it came from one of the raw repository PORTS this
		// interface still hands out — so `notifyFault` maps it into the same coded
		// `PersistenceError` a guarded service would have produced, LOGS the raw cause under
		// this door's event name, and prints the mapped copy. The exception's own message
		// never reaches the user, and the developer half is not lost with it: no guard ran
		// below this, so this is the only step in THIS path where both representations can be
		// produced together (SDD §66). This is one of TWO such doors in this file; the other is
		// `createDeleteZoneAction`'s catch, and both go through the same function so neither
		// can drift into printing the raw text or into notifying without logging.
		notifyFault(cause, logger, 'editor.dispatch.faulted');
		return null;
	}
}

/**
 * `reportFault`'s other half: an EXPECTED refusal that RESOLVES rather than throws
 * (SDD §65). `CommandHistory.undoNow`/`redoNow` deliberately leave a refused undo/redo ON
 * its stack rather than popping it, so without this the button stays enabled, does
 * nothing, and says nothing about why. A caller chains `notifyIfRefused(reportFault(op))`
 * to cover both halves — throw and resolved refusal — in one line.
 *
 * **Design slice 17 narrowed it, and the narrowing is the point.** Every dispatch reaching
 * here has already passed through `withSaveStateTracking`, which asks `affectsSaveState` and
 * flips the save indicator for anything that wrote or might have. Toasting it as well reported
 * ONE failure through TWO widgets that can drift apart — the toast dismisses and the indicator
 * does not, or the reverse — which is the reconciliation slice 11's own illustrative code left
 * open and this slice's Definition of Done forbids by name.
 *
 * So the origin is `autosave-write`, the table answers `save-state`, and this door stays shut
 * for it. The `saveState` sink is deliberately a NO-OP: the indicator is driven by the
 * DECORATOR one layer down, off the same `Result`, so there is nothing left for this site to
 * do — the policy's whole job here is to decide that no toast is owed. If indicator-flipping
 * ever moves out of `withSaveStateTracking`, this is the line that has to grow a body.
 *
 * A refusal the indicator does NOT report still reaches the user: `surfaceError` sends
 * anything the table routes elsewhere to `unrenderable`, which raises the notice.
 */
async function notifyIfRefused(operation: Promise<DispatchResult | null>): Promise<void> {
	const result = await operation;
	if (result === null || result.ok) return;
	reportDispatchFailure(result.error);
}

/**
 * The ONE dispatcher a leaf hands out — tools, toolbar and Inspector alike — wrapped so the
 * history-flag mirror hears about a tool gesture as well as a toolbar one. A dispatch that
 * bypasses this object silently breaks the reactive undo/redo flags and nothing errors.
 *
 * Two plain refs re-read from the history rather than an invalidation counter that two
 * computeds subscribed to with a `void revision.value` statement: that spelling put a line
 * with no visible effect above each `return`, and any tidy-up of it froze the Undo/Redo
 * buttons in whatever state they had at mount with nothing erroring.
 *
 * `finally`, not the resolved path: an unexpected technical fault can still leave the stacks
 * moved (SDD §65), and flags that stop tracking after one throw are wrong for the rest of
 * the leaf's life.
 */
function wrapDispatcher(
	history: CommandHistory,
	dispatcher: ReturnType<typeof withEditorStateRefresh>,
): {
	readonly dispatcher: EditorRuntime['dispatcher'];
	readonly canUndo: Ref<boolean>;
	readonly canRedo: Ref<boolean>;
} {
	const canUndo = ref(history.canUndo);
	const canRedo = ref(history.canRedo);
	async function stepping(operation: () => Promise<DispatchResult>): Promise<DispatchResult> {
		try {
			return await operation();
		} finally {
			canUndo.value = history.canUndo;
			canRedo.value = history.canRedo;
		}
	}
	return {
		dispatcher: {
			run: (command) => stepping(() => dispatcher.run(command)),
			undo: () => stepping(() => dispatcher.undo()),
			redo: () => stepping(() => dispatcher.redo()),
		},
		canUndo,
		canRedo,
	};
}

/**
 * The assign picker's options: the vault's asset catalogue changes only through this same
 * app (whose own dispatches refresh nothing about THIS list because the picker is a
 * catalogue view, not a figure), and a stale option that no longer resolves fails the
 * assignment command loudly rather than silently.
 *
 * **Read at mount AND on every `onCatalogueChanged`, which is not the same thing as "once
 * per leaf".** Design slice 19 replaced design slice 8's watch on the plan's project with a
 * single read — correct in itself, since the catalogue left the project and there is no
 * longer a `projectId` to wait for — and judged that unchanged behaviour. It was not: the
 * watch had a second effect nobody had named, which is that it re-fired when the store
 * re-hydrated. `PlanEditorView.sync()` mounts on the RESTORED VIEW STATE rather than on a
 * resolved plan, and Obsidian restores its leaves before `onLayoutReady`, so on the
 * ordinary restart path this read lands against a still-empty project index and answers
 * an empty catalogue — leaving the picker empty for the life of that leaf.
 *
 * The recovery was first bought by borrowing `onPlanChanged`, which carries
 * `ProjectIndexRebuilt` and therefore worked, and which also carries five events that say
 * nothing about the catalogue — so a zone gesture re-read every asset note in the vault.
 * `createAssetCatalogueChangeSource` is the narrowing: the rebuild that fixes the restored
 * leaf, the three asset commands, and an index entry change filtered to `renovation-asset`
 * for a note added by hand or arriving through sync. The picker now hears what it is
 * about and nothing else.
 *
 * **COALESCED, because hearing the right events is not the same as hearing few of them.**
 * A library migration renames every catalogue note one at a time and `VaultChangeAdapter`
 * announces each rename, so moving N assets delivers N events — and an unconditional read
 * per event is N vault-wide scans in every open editor, for a change of paths. Never more
 * than one read is in flight; a burst arriving during one collapses into exactly one more
 * after it. That the reads cannot OVERLAP is the second property, and it is what removes
 * the stale-overwrite race this repository has already recorded twice (`ProjectStore.hydrate`
 * and `InspectorStore` both carry a request ticket for it): an older scan cannot finish
 * after a newer one and put a deleted asset back, because there is never an older scan
 * still running. Both halves were reported in review against the commit that introduced
 * the first — `onPlanChanged` did not carry the entry event, so the old wiring could not
 * see a migration at all.
 *
 * The trailing read is a REQUEST rather than a queue: ten events during one scan buy one
 * more scan, not ten. What that gives up is knowing which event the final read answers,
 * which nothing here needs — the read is a full catalogue snapshot either way.
 */
function createAssetOptionsLoader(
	context: PlanEditorContext,
	assetOptionsRef: Ref<readonly { readonly id: string; readonly name: string }[]>,
): () => void {
	let running = false;
	let requestedAgain = false;
	const run = async (): Promise<void> => {
		running = true;
		try {
			do {
				requestedAgain = false;
				const options = await context.queries.listAssets();
				if (options.ok) assetOptionsRef.value = options.value;
			} while (requestedAgain);
		} finally {
			running = false;
		}
	};
	return (): void => {
		if (running) {
			requestedAgain = true;
			return;
		}
		void run();
	};
}

/**
 * The Inspector's Delete action, and the flow's four collaborators bound to this leaf:
 * slice 10's two queries, slice 15's two dialog kinds, and the Inspector's own commit path.
 *
 * Every string the dialogs receive is resolved before it reaches them, because nothing
 * under `presentation/dialogs/` resolves a key on its own behalf: the reassign title with
 * `tr` here, the zone's own name from the caller, and the reference rows in
 * `deleteZoneFlow` — which is where the groups those labels depend on actually are.
 *
 * Both failure halves of SDD §65 are handled here rather than in `commitEdit`, and that is
 * the reason this action does not go through it: a refusal the flow ACTS on
 * (`reference.referents-exist`, `reference.set-changed`) must not also be notified on its
 * way past, or a delete that succeeds on the second round still shows the user an error
 * from the first.
 */
function createDeleteZoneAction(
	context: PlanEditorContext,
	dialogs: ReturnType<typeof useDialogStore>,
	inspector: { commit(edit: InspectorEdit): Promise<Result<DispatchOutcome, AppError>> },
	selection: ReturnType<typeof useSelectionStore>,
): (zoneId: ZoneId, zoneName: string) => Promise<void> {
	const deps: DeleteZoneFlowDeps = {
		listReferents: (zoneId) => context.queries.listRequirementsReferencing(zoneId),
		listReassignmentTargets: (zoneId) => context.queries.listReassignmentTargets(zoneId),
		// The rows arrive built. `deleteZoneFlow` maps the query's per-project groups onto them,
		// because which label a row takes depends on the ambiguity `ListRequirementsReferencing`
		// resolved — building them here would derive that rule a second time, and this door
		// cannot see the groups at all.
		askResolution: (entityLabel, references) =>
			dialogs.openDialog({ kind: 'delete-reference', entityLabel, references }),
		askReassignTarget: (title, candidates) =>
			dialogs.openDialog({ kind: 'entity-picker', title, candidates }),
		dispatch: (edit) => inspector.commit(edit),
		copy: {
			reassignTitle: tr('editor.inspector.delete-zone.reassign-title'),
		},
	};

	return async (zoneId, zoneName) => {
		let outcome;
		try {
			outcome = await deleteZoneWithReferences(deps, zoneId, zoneName);
		} catch (cause) {
			// The last stop for a THROWN fault, exactly as `reportFault` is for a plain
			// dispatch: this is bound to a click handler that discards its promise. Mapped
			// and LOGGED rather than printed, for the reason `notifyFault` gives — its own
			// event name, so a log line says which of the two doors this came through.
			notifyFault(cause, context.commands.logger, 'editor.deleteZone.faulted');
			return;
		}
		if (outcome.kind === 'failed') {
			// The DECISION half of this flow already happened — `deleteZoneWithReferences` opened
			// slice 15's modal and the user answered it. What lands here is the residue: the
			// command refused after that answer, which is an explicit operation like any other,
			// not a second decision to put in front of them.
			notifyOperationFailure(outcome.error);
			return;
		}
		if (outcome.kind === 'cancelled') return;
		// The delete empties the panel's subject; selection follows only when the deleted
		// zone is the one selected.
		if (selection.selectedIds.length === 1 && String(selection.selectedIds[0]) === zoneId) {
			selection.clear();
		}
	};
}

function buildRuntime(context: PlanEditorContext): EditorRuntime {
	const editor = useEditorStore();
	const projectStore = useProjectStore();
	const selection = useSelectionStore();
	const dialogs = useDialogStore();

	const history = new CommandHistory();
	const ledger = new SessionWriteLedger();

	// The cycle between the dispatcher (which must refresh the Inspector) and the
	// Inspector store (which must dispatch through it) is broken with one mutable
	// binding: until the store exists below, refresh has nothing to re-read, so a no-op
	// is honest.
	const inspectorRef: { current: { refresh(): Promise<void> } | null } = { current: null };
	const dispatcher = withEditorStateRefresh(history, {
		projectStore,
		inspectorStore: {
			refresh: () => inspectorRef.current?.refresh() ?? Promise.resolve(),
		},
		queries: context.queries,
		planId: context.planId,
	});

	// Outside the refresh decorator, so `saved` never appears while the canvas still shows the
	// pre-command state; inside `wrapDispatcher`, which is the one object a leaf hands out.
	const tracked = withSaveStateTracking(dispatcher, useSaveStateStore());

	const { dispatcher: wrappedDispatcher, canUndo, canRedo } = wrapDispatcher(history, tracked);

	const inspector = createInspector(context, wrappedDispatcher, ledger);
	inspectorRef.current = inspector;

	// The viewport adapter closes over the live camera ref — the same binding
	// `editor-context.ts` describes for the composition root's side of this seam.
	const viewportAdapter: EditorContext['viewport'] = {
		worldToScreen: (point) => worldToScreen(point, editor.viewport, STAGE_PIXELS),
		screenToWorld: (point) => screenToWorld(point, editor.viewport, STAGE_PIXELS),
		worldPerScreenPixel: () => worldPerScreenPixel(editor.viewport, STAGE_PIXELS),
		// Camera mutation is UNIMPLEMENTED, not merely unused: `EditorContext` declares
		// these two as the path a `PanTool` moves the camera through, and no such tool
		// exists (slice 5's camera is the canvas's own, outside the tool framework). The
		// primitives are all in `EditorStore` — `beginPan`/`continuePan`/`endPan`/`zoomAt`
		// — so the tool that needs them binds them here in one edit; until then a caller
		// would get silence, which is why this says so rather than looking finished.
		setPan: () => undefined,
		setZoom: () => undefined,
	};

	// A `reactive()` proxy over slice 6's plain class: the tools write through the same
	// fields their tests set, and the InteractionLayer reads them reactively.
	const renderState = reactive(new RenderState());

	/**
	 * The plan a tool is working on, re-read on every activation.
	 *
	 * `calibration` comes from the hydrated `PlanDto` and is `null` only while the plan
	 * genuinely is uncalibrated. It used to be a hard-coded `null` beside a comment calling
	 * it a placeholder, which is a different thing from what `EditorContext` declares to
	 * every tool: the first tool to believe it would have reported lengths at the
	 * uncalibrated scale of 1 on a calibrated plan.
	 *
	 * The id carries the one unavoidable cast in this file. Obsidian persists a plan id in
	 * its per-leaf view state as an opaque string, so `PlanEditorContext.planId` is a
	 * `string` and nothing at runtime can verify a phantom brand. Narrowing it here — at the
	 * single point that value enters the tool framework — is what keeps every tool's own
	 * signature honestly branded. (`as never` was the previous spelling and is strictly
	 * worse: `never` is assignable to anything, so a project id would have passed too.)
	 *
	 * **This was collapsed onto one line for the `max-lines` budget and no longer needs to be.**
	 * The file sat at EXACTLY its 400-line cap (`max-lines`, `skipBlankLines` and
	 * `skipComments`) after slice 13's save-state wiring, and this literal gave three lines
	 * back — under a note predicting that the next change adding a line of CODE would trip the
	 * rule and that the answer would then be an extraction rather than a second collapsed
	 * literal. That is exactly what happened: the review pass giving every dispatch a
	 * `DispatchOutcome` to report pushed the file to 411, and `./inspector-wiring.ts` is the
	 * extraction. So the literal is back in its natural shape, which is the point of taking
	 * the extraction rather than shaving another line.
	 */
	const activePlan = (): EditorContext['activePlan'] => ({
		id: context.planId as PlanId,
		calibration: projectStore.plan?.calibration ?? null,
	});

	// A FRESH context per activation, assembled through the same one assembler — which is
	// the guarantee `ToolManager`'s header states its factory exists for, and which a
	// single object built once and handed back forever could not give. Everything but
	// `activePlan` is stable by construction (the viewport adapter and the render state
	// close over live refs), so re-assembling it is cheap.
	const toolManager = new ToolManager(() =>
		createEditorContext({
			bindViewport: () => viewportAdapter,
			selection,
			snapService: SNAP_SERVICE,
			commandDispatcher: wrappedDispatcher,
			writeLedger: ledger,
			renderState,
			activePlan: activePlan(),
		}),
	);
	registerEditorTools(toolManager, context, projectStore, ledger, dialogs);

	// The reactive mirror of `ToolManager`'s non-reactive pointer, held in the store rather
	// than in a second `ref` beside it. There were three copies of the active tool id — the
	// manager's own, a local ref the toolbar read, and this store slot nothing read — and
	// `setTool` hand-synced all three, which is two chances to drift where the drift is
	// invisible. The manager stays framework-pure (no Vue), so ONE mirror at this seam is
	// what a Vue consumer reads.
	const { activeToolId } = storeToRefs(editor);

	const setTool = (id: ToolId | null): void => {
		if (id === null) {
			toolManager.clearActiveTool();
		} else {
			toolManager.setActiveTool(id);
		}
		activeToolId.value = id;
	};

	// Both halves of SDD §65 — `reportFault`'s throw and `notifyIfRefused`'s resolved
	// refusal — bound straight to toolbar clicks. `ReversibleCalibratePlanCommand.undo()`
	// refuses with a revision conflict whenever anything else has touched the plan's
	// sidecar since (every zone create, move and delete does), and this is what makes THAT
	// refusal say something rather than nothing.
	async function undo(): Promise<void> {
		await notifyIfRefused(reportFault(context.commands.logger, wrappedDispatcher.undo()));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportFault(context.commands.logger, wrappedDispatcher.redo()));
	}

	// `commitField.ts` carries the guard's own doc; this is just the one line that binds it
	// to this leaf's logger and its `inspector.commit`.
	const commitField = makeCommitField(context.commands.logger, (edit) => inspector.commit(edit));

	/**
	 * The Inspector's one commit path. A refusal the panel can attach to an input is rendered
	 * there by the row that owns it; everything else arrives here, because the Inspector has no
	 * banner region. The notice door NARROWS here — it does not close.
	 *
	 * **The origin is `explicit-operation`, not `form-field-commit`, and that is a claim about
	 * WHICH edits reach this function.** The two override controls route their own refusals
	 * through `useFieldCommit`'s `notify`; what is left for this path is the assign and the
	 * reset — clicks, with no single input a message could be attached to. Declaring a field
	 * origin here would name a field that does not exist and send the failure to an inline
	 * renderer with nowhere to put it.
	 *
	 * The older comment said "which errors may reach a field at all is slice 17's decision
	 * table, not this function's". That is still true, and this line is the answer it was
	 * waiting for.
	 */
	async function commitEdit(edit: InspectorEdit): Promise<boolean> {
		const result = await commitField(edit);
		// **A FAULT keeps its sentence; a REFUSAL goes wherever the indicator did not.** SDD §65
		// draws that line: `commitField` maps a THROW into a coded `PersistenceError`, and the
		// sentence that error resolves to is the only account of it the user will ever get —
		// routing it to a badge reading "Save error" would trade their one explanation for
		// consistency. A refusal is the opposite case: the command considered the request and
		// declined it, and if that refusal affected the write the indicator is already saying so.
		if (!result.ok) reportDispatchFailure(result.error);
		return result.ok;
	}

	const deleteZone = createDeleteZoneAction(context, dialogs, inspector, selection);

	// The assign picker's options, hydrated at mount and re-read on the catalogue's OWN
	// subscription rather than on the plan's. The disposal matters for the reason it does at
	// `PlanEditorRoot`'s `hydrate`: Obsidian reuses a view, so a listener outliving its Vue
	// tree writes into a retired one.
	const assetOptionsRef = ref<readonly { readonly id: string; readonly name: string }[]>([]);
	const reloadAssetOptions = createAssetOptionsLoader(context, assetOptionsRef);
	reloadAssetOptions();
	onBeforeUnmount(context.onCatalogueChanged(reloadAssetOptions));

	return {
		dispatcher: wrappedDispatcher,
		toolManager,
		renderState,
		activeToolId,
		setTool,
		undo,
		redo,
		canUndo,
		canRedo,
		inspectorDto: storeToRefs(inspector).dto,
		inspectorRequirements: storeToRefs(inspector).requirements,
		assetOptions: assetOptionsRef,
		hydrateInspector: (ids) => inspector.hydrateFrom(ids),
		deleteZone,
		commitEdit,
		commitField,
	};
}

const EDITOR_RUNTIME: InjectionKey<EditorRuntime> = Symbol('renovation-planner:editor-runtime');

export function provideEditorRuntime(context: PlanEditorContext): EditorRuntime {
	const runtime = buildRuntime(context);
	provide(EDITOR_RUNTIME, runtime);
	return runtime;
}

export function useEditorRuntime(): EditorRuntime {
	const runtime = inject(EDITOR_RUNTIME);
	if (runtime === undefined) {
		throw new Error('The plan editor was mounted without an EditorRuntime.');
	}
	return runtime;
}
