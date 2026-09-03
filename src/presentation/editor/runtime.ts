import { inject, onBeforeUnmount, provide, reactive, ref, watch, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger } from '../../application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../application/commands/zone/reversible-create-zone-command';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import { createInspector } from './inspector-wiring';
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
import { createToolSwitch } from './tools/tool-switch';
import { CalibrateTool } from './tools/calibrate-tool';
import { DrawPolygonTool } from './tools/draw-polygon-tool';
import { SelectTool } from './tools/select-tool';
import { withEditorStateRefresh } from './tools/with-editor-state-refresh';
import { wrapDispatcher } from './tools/wrap-dispatcher';
import { useSaveStateStore } from './save-state/save-state-store';
import { singleFlight } from '../composables/single-flight';
import { withSaveStateTracking } from './save-state/with-save-state-tracking';
import { useDialogStore } from '../dialogs/dialog-store';
import { knownDistanceSupplier } from './shell/knownDistance';
import { EDITOR_SNAP_SERVICE } from './snapping/editorSnapping';
import { editorViewportAdapter } from './viewport/editorViewportAdapter';
import { boundsOfZones } from './viewport/zoneExtent';
import { tr } from '../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import { mapDispatchFaults, notifyIfRefused, reportDispatchFailure, reportDispatchFault } from './report-failure';
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
 * The log event name this leaf's click-bound dispatches fault under. Named here rather than
 * spelled at the two call sites, because a log line saying which DOOR faulted is only useful
 * while the two doors agree on what to call themselves.
 */
const DISPATCH_FAULT_EVENT = 'editor.dispatch.faulted';

export interface EditorRuntime {
	/** The decorated history every dispatch in this leaf funnels through. */
	readonly dispatcher: ReturnType<typeof withEditorStateRefresh>;
	readonly toolManager: ToolManager;
	/**
	 * Same as `setTool('select')`, named for the two callers that mean it — the first-ready
	 * watch below and a finished polygon's completion.
	 */
	readonly returnToSelect: () => void;
	/**
	 * Task 18's Cancel button. NOT `routeEscape` (R7, 2026-09-04): Cancel LEAVES the active
	 * creation task in one gesture — discard any draft, return to Select — where Escape steps
	 * back through the nearest interaction instead. See `createCancelActiveTask` below.
	 */
	readonly cancelActiveTask: () => void;
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
	/**
	 * Design slice 12's list-framing seam: selects `id` and fits the camera to its bounds
	 * through `EditorStore.fitTo`. A degenerate extent (nothing to frame) or an unmeasured
	 * stage leaves the camera exactly where it was — the selection still lands, because a
	 * user picking a row from a list wants it highlighted whether or not the camera can also
	 * move to it.
	 */
	readonly selectAndFrame: (id: string) => void;
}


/**
 * What the concrete tools of this leaf are built from.
 *
 * A bundle rather than a sixth positional parameter: adding `planId` took the argument list
 * past `max-params`, and five positional arguments of which three are stores was already at
 * that budget for a reason. `planId` is passed rather than re-derived from `context.planId`,
 * so the one cast that turns Obsidian's opaque per-leaf string into a branded id stays a
 * single site — see `subject` below, which is built from the same value.
 */
interface EditorToolDeps {
	readonly context: PlanEditorContext;
	readonly planId: PlanId;
	readonly projectStore: ReturnType<typeof useProjectStore>;
	readonly ledger: SessionWriteLedger;
	readonly dialogs: ReturnType<typeof useDialogStore>;
	/**
	 * The draw-polygon tool's `onCompleted`: creation is temporary (design spec §7.3), so a
	 * closed polygon hands control straight back to Select rather than staying armed for a
	 * vertex the user did not mean.
	 */
	readonly returnToSelect: () => void;
}

/** The concrete tools of this slice, registered against one shared context factory. */
function registerEditorTools(toolManager: ToolManager, deps: EditorToolDeps): void {
	const { context, planId, projectStore, ledger, dialogs, returnToSelect } = deps;
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
			id: 'draw-polygon',
			// What a closed polygon MEANS in the Plan Editor: a new Zone on this plan. The tool
			// itself names none of it — see `PolygonCompletion`, which the designer supplies a
			// footprint version of. The zone's default name is counted from what the editor has
			// hydrated, until a creation form asks instead.
			completion: {
				commandFor: (geometry) => {
					const command = new ReversibleCreateZoneCommand(
						context.commands.createZone,
						context.commands.deleteZone,
						context.commands.zones,
						ledger,
						{
							planId,
							name: `${tr('editor.zone.default-name')} ${projectStore.zones.size + 1}`,
							zoneType: 'Room',
							geometry,
						},
					);
					// An adapter rather than the command itself: `createdZoneId` is the
					// application layer's own word for this and is named by its tests and by
					// design slice 8's document, so the translation into the tool's
					// subject-agnostic `createdId` happens here, where the Zone is already known.
					return {
						execute: () => command.execute(),
						undo: () => command.undo(),
						get createdId() {
							return command.createdZoneId;
						},
					};
				},
			},
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
			onCompleted: returnToSelect,
		}),
	);
	toolManager.register(
		new CalibrateTool({
			// The two dialogs this gesture may open, in the order it opens them. Both go
			// through the leaf's OWN store, so a calibration in one split pane cannot trap
			// the other — `DialogHost` is per view for exactly that reason.
			hasGeometryToRescale: () => projectStore.zones.size > 0,
			confirmRecalibration: async () =>
				(await dialogs.openDialog({
					kind: 'confirm',
					title: tr('editor.calibrate.recalibrate.title'),
					message: tr('editor.calibrate.recalibrate.message'),
					danger: true,
				})) === 'confirm',
			supplyKnownDistance: knownDistanceSupplier(dialogs),
			// The PLAN is bound here, in the one place this leaf's branded id already lives.
			// `CalibrateTool` serves two subjects since design slice B6 and can produce neither
			// brand — `EditorContext.subject.id` is a bare `EntityId<string>` for exactly that
			// reason — so it hands back the measurement and the caller that knows which plan
			// this is builds the input.
			createCommand: (measurement) => {
				const command = context.commands.calibratePlan();
				return {
					execute: () => command.execute({ planId, ...measurement }),
					undo: () => command.undo(),
				};
			},
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
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
 * **COALESCED, because hearing the right events is not the same as hearing few of them.** A
 * library migration renames every catalogue note one at a time and `VaultChangeAdapter`
 * announces each rename, so moving N assets delivers N events — and an unconditional read per
 * event is N vault-wide scans in every open editor, for a change of paths. `singleFlight`
 * (`presentation/composables/single-flight.ts`) is what makes that affordable, and its own
 * header carries the mechanism and the reason it sits beside a request ticket rather than
 * instead of one. Both halves were reported in review against the commit that introduced the
 * first — `onPlanChanged` did not carry the entry event, so the old wiring could not see a
 * migration at all.
 *
 * It MOVED out of this file when the project pane's price section became its second caller: one
 * function with two callers cannot drift the way two hand-spelled copies can.
 */

/**
 * Is the requirement this event names one the Inspector is currently DRAWING?
 *
 * **It FAILS OPEN on an empty snapshot, and that is the whole of the function.** An
 * id-membership test over an empty set admits nothing, and the rows are legitimately empty in
 * two states that are not "this zone has no requirements": while the first read for a
 * selection is still in flight (`hydrateFrom` clears them and then awaits two queries), and
 * after a transient rows-query failure on a first hydrate, where there is nothing to preserve
 * and `[]` is incomplete rather than empty. No flag tells those apart from a genuinely empty
 * zone, and a filter exists to SKIP work — so the safe direction under uncertainty is to do
 * the work. Without this arm a figure event landing in the hydration window is dropped, the
 * read settles with the old provenance, and the stale row stands for the life of the
 * selection: this increment turning a self-healing fault into a permanent one.
 *
 * The cost is bounded and is named rather than waved past: a selected zone that genuinely has
 * no requirements re-reads once per recalculation event anywhere in the vault — one query
 * against a zone with no rows, and the price of not tracking completeness in a second flag
 * that could itself go stale.
 */
function drawsRequirement(
	rows: readonly { readonly requirementId: string }[],
	requirementId: string,
): boolean {
	return rows.length === 0 || rows.some((row) => row.requirementId === requirementId);
}

function createAssetOptionsLoader(
	context: PlanEditorContext,
	assetOptionsRef: Ref<readonly { readonly id: string; readonly name: string }[]>,
): () => void {
	return singleFlight(async () => {
		const options = await context.queries.listAssets();
		if (options.ok) assetOptionsRef.value = options.value;
	});
}

/**
 * The three doors this leaf re-reads on, and the two loaders behind them.
 *
 * Extracted from `buildRuntime` because that function's `max-lines-per-function` budget is 100
 * and wiring the second and third doors took it to 101 — the same budget that pushed
 * `commitField` and then `inspector-wiring.ts` out of this file. A coherent seam rather than a
 * convenient one: everything here is "something outside this leaf changed, read it again".
 */
function subscribeToChangedFigures(
	context: PlanEditorContext,
	// The store's shape rather than its type: naming it would mean naming `createInspector`'s
	// return, and these two members are the whole of what this function needs.
	inspector: {
		readonly requirements: readonly { readonly requirementId: string }[];
		refresh(): Promise<void>;
	},
	assetOptionsRef: Ref<readonly { readonly id: string; readonly name: string }[]>,
): void {
	const reloadAssetOptions = createAssetOptionsLoader(context, assetOptionsRef);
	reloadAssetOptions();

	/**
	 * The Inspector's rows, re-read on every input the unit-cost block draws — the library
	 * price, this project's own price, and the provenance the figures were derived from.
	 *
	 * THREE doors and one loader. `unitCost` has three inputs and two of the events fire
	 * BEFORE the figure they move: `EventBus.publish` delivers to every handler without
	 * ordering them, so re-reading on the price or the catalogue event races the recalculation
	 * cascade rather than following it, and the block would settle showing the new price beside
	 * the OLD provenance with nothing to correct it. `onRequirementFiguresChanged` is the door
	 * that means "this requirement's STORED figures moved", which is what closes that.
	 *
	 * `singleFlight` is what makes hearing all three affordable: the ticket inside
	 * `InspectorStore` orders reads and was never a rate limit — both its queries run to
	 * completion before it consults the ticket — so a project-wide cascade of ten requirements
	 * would otherwise buy ten pairs of vault reads and nine discarded answers. Here a burst
	 * during one read buys exactly one more. The two mechanisms stay because neither does the
	 * other's job: the ticket cannot stop a read starting, and the loader cannot order reads it
	 * did not issue (a fresh mount, a navigation).
	 */
	const reloadInspector = singleFlight(() => inspector.refresh());
	onBeforeUnmount(
		context.onCatalogueChanged(() => {
			reloadAssetOptions();
			reloadInspector();
		}),
	);
	onBeforeUnmount(context.onProjectPricesChanged(reloadInspector));
	onBeforeUnmount(
		context.onRequirementFiguresChanged((requirementId) => {
			if (drawsRequirement(inspector.requirements, requirementId)) reloadInspector();
		}),
	);
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
	inspector: { commit(edit: InspectorEdit): Promise<DispatchResult> },
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

/**
 * Design slice 12's list-framing seam (spec §6.5), pulled out of `buildRuntime` for its line
 * budget rather than for a shared caller: select `id`, then fit the camera to it if there is
 * anything to fit it into. The selection lands regardless — a row in a list naming an id this
 * leaf has never hydrated (stale by construction, since the list and this leaf's own `zones`
 * come from two different reads) is still worth marking as the user's intent, and the camera
 * simply has nothing to move to.
 */
function selectAndFrameOn(
	projectStore: ReturnType<typeof useProjectStore>,
	selection: ReturnType<typeof useSelectionStore>,
	editor: ReturnType<typeof useEditorStore>,
	id: string,
): void {
	selection.select([id as EntityId<string>]);
	const zone = projectStore.zones.get(id);
	if (zone === undefined) return;
	const bounds = boundsOfZones([zone]);
	if (bounds === null) return; // nothing to frame: the selection stands, the camera stays
	editor.fitTo(bounds, editor.stageSize);
}

/**
 * A selected id the vault no longer holds is RETIRED, never rebound by name or position (spec
 * §6.5). Watched on the zones map, which every successful hydrate replaces wholesale
 * (`ProjectStore.hydrate` assigns a fresh `Map`), so this fires exactly when a hydrate lands —
 * never merely because the map's CONTENTS changed, since Vue's `watch` compares the reference
 * and a mutated map would be the same reference twice.
 *
 * **The HOVER is retired here too, and that is the same rule rather than a second one.** §6.5's
 * subject is an identity the vault no longer holds, and Select names one through two predictive
 * channels: the outline the `InteractionLayer` draws, and the cursor `EditorSurface` computes.
 * The outline withdrew on its own — it looks the hovered id up in the hydrated map and draws
 * nothing when it is absent — while the cursor read only "is the id non-null", so after a
 * hovered room was deleted the two channels contradicted each other until some later pointer
 * move happened to overwrite the stale id. Clearing the id here is what makes the cursor's
 * withdrawal a fact rather than a race, and the KIND goes with it because the two are one fact
 * in two fields (see `RenderState.hoveredTargetKind`).
 */
function registerSelectionRetirement(
	projectStore: ReturnType<typeof useProjectStore>,
	selection: ReturnType<typeof useSelectionStore>,
	renderState: RenderState,
): void {
	watch(
		() => projectStore.zones,
		(zones) => {
			const survivors = selection.selectedIds.filter((id) => zones.has(String(id)));
			if (survivors.length !== selection.selectedIds.length) selection.select(survivors);
			if (renderState.hoveredObjectId !== null && !zones.has(renderState.hoveredObjectId)) {
				renderState.hoveredObjectId = null;
				renderState.hoveredTargetKind = null;
			}
		},
	);
}

/**
 * Task 18's Cancel button. NOT `routeEscape` (R7, 2026-09-04): Escape steps back through the
 * nearest interaction — a draft first, then the tool, then the selection — while Cancel means
 * LEAVE THIS TASK, which is what the PBI's criterion 7 and its main flow step 6 say a
 * cancellation does. So it discards whatever the tool holds and returns to Select in one gesture,
 * and it never touches the selection, which no cancellation of a creation task is about.
 * Under Select (or with no tool) there is no task to leave, and it does nothing.
 *
 * `cancelGesture()` runs BEFORE `setTool('select')`, deliberately unlike `routeEscape`'s
 * no-draft arm (R2), which relies on `setTool`'s own outgoing-tool `deactivate()` and calls no
 * `cancelGesture()` at all (see `escapeRouting.ts`'s "Do not 'restore' the `cancelGesture()`
 * call" note). Cancel states the discard explicitly because it is user intent independent of
 * the tool-switch contract, so a tool whose `deactivate` stops cancelling does not silently
 * change what Cancel means.
 */
function createCancelActiveTask(
	toolManager: ToolManager,
	activeToolId: Ref<ToolId | null>,
	setTool: (id: ToolId | null) => void,
): () => void {
	return (): void => {
		const tool = activeToolId.value;
		if (tool === null || tool === 'select') return;
		toolManager.cancelGesture();
		setTool('select');
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

	// The SAME object every tool dispatches through, with its `run` mapped so it cannot reject:
	// a tool launches its dispatch detached, so a rejection here reached nobody at all. Required
	// by `EditorContextDeps.commandDispatcher`'s type rather than remembered — see
	// `mapDispatchFaults`. `undo`/`redo` below deliberately take the plain object instead, since
	// `reportDispatchFault` is their own door and notifies at it.
	const toolDispatcher = mapDispatchFaults(wrappedDispatcher, context.commands.logger, DISPATCH_FAULT_EVENT);

	const inspector = createInspector(context, wrappedDispatcher, ledger);
	inspectorRef.current = inspector;

	// The camera as a tool sees it — `viewport/editorViewportAdapter.ts`, shared with the asset
	// designer's runtime rather than spelled twice. It closes over this leaf's live camera ref.
	const viewportAdapter = editorViewportAdapter(editor);

	// A `reactive()` proxy over slice 6's plain class: the tools write through the same
	// fields their tests set, and the InteractionLayer reads them reactively.
	const renderState = reactive(new RenderState());

	/**
	 * The one unavoidable cast in this file. Obsidian persists a plan id in its per-leaf view
	 * state as an opaque string, so `PlanEditorContext.planId` is a `string` and nothing at
	 * runtime can verify a phantom brand. Narrowing it here — at the single point that value
	 * enters the tool framework — is what keeps every tool's own signature honestly branded.
	 * (`as never` was the previous spelling and is strictly worse: `never` is assignable to
	 * anything, so a project id would have passed too.)
	 *
	 * ONE site, read by both consumers: `subject` below widens it back to the
	 * `EntityId<string>` every tool sees, and `CalibrateTool` takes it branded through its own
	 * deps because `CalibratePlanInput` needs a `PlanId` and a brand cannot be narrowed back.
	 * A second cast would be a second answer to which plan this leaf is showing.
	 */
	const planId = context.planId as PlanId;

	/**
	 * What the tools are working on, re-read on every activation.
	 *
	 * `calibration` comes from the hydrated `PlanDto` and is `null` only while the plan
	 * genuinely is uncalibrated. It used to be a hard-coded `null` beside a comment calling
	 * it a placeholder, which is a different thing from what `EditorContext` declares to
	 * every tool: the first tool to believe it would have reported lengths at the
	 * uncalibrated scale of 1 on a calibrated plan.
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
	const subject = (): EditorContext['subject'] => ({
		id: planId,
		calibration: projectStore.plan?.calibration ?? null,
	});

	// A FRESH context per activation, assembled through the same one assembler — which is
	// the guarantee `ToolManager`'s header states its factory exists for, and which a
	// single object built once and handed back forever could not give. Everything but
	// `subject` is stable by construction (the viewport adapter and the render state
	// close over live refs), so re-assembling it is cheap.
	const toolManager = new ToolManager(() =>
		createEditorContext({
			bindViewport: () => viewportAdapter,
			selection,
			snapService: EDITOR_SNAP_SERVICE,
			commandDispatcher: toolDispatcher,
			writeLedger: ledger,
			renderState,
			subject: subject(),
		}),
	);
	// The reactive mirror of `ToolManager`'s non-reactive pointer, held in the store rather
	// than in a second `ref` beside it. There were three copies of the active tool id — the
	// manager's own, a local ref the toolbar read, and this store slot nothing read — and
	// `setTool` hand-synced all three, which is two chances to drift where the drift is
	// invisible. The manager stays framework-pure (no Vue), so ONE mirror at this seam is
	// what a Vue consumer reads.
	//
	// Hoisted above `registerEditorTools` (rather than left where the toolbar's own dispatch
	// used it) so `returnToSelect` exists in time to be threaded into the draw-polygon tool's
	// `onCompleted` below — `toolManager` is already built at this point, which is all
	// `createToolSwitch` needs.
	const { activeToolId } = storeToRefs(editor);
	const setTool = createToolSwitch(toolManager, activeToolId);
	const returnToSelect = (): void => setTool('select');
	const cancelActiveTask = createCancelActiveTask(toolManager, activeToolId, setTool);

	registerEditorTools(toolManager, { context, planId, projectStore, ledger, dialogs, returnToSelect });

	// Select is the safe default (design spec M01), armed whenever `projectStore.status`
	// BECOMES `'ready'` — and a `previous !== 'ready'` guard would be dead code here, not a
	// narrowing: Vue's `watch` calls its callback only on a genuine change (`hasChanged`), and
	// `ProjectStore.hydrate` sets `status.value = 'loading'` before every read except one
	// already `'ready'` — so the ONLY way this callback runs with `status === 'ready'` is a
	// transition INTO it from something else, which is exactly the fresh-scene case Select
	// belongs to. A post-command or `onPlanChanged` refresh that finds the plan still `'ready'`
	// never reassigns the ref to the same value, so the watcher never wakes for it and never
	// re-arms Select over a tool the user chose — no comparison against `previous` required.
	// Watched on the status rather than on `hydrate`'s own promise, because the root owns the
	// call to `hydrate` and a second caller (`onPlanChanged`) already exists.
	watch(
		() => projectStore.status,
		(status) => {
			if (status === 'ready') setTool('select');
		},
	);

	const selectAndFrame = (id: string): void => selectAndFrameOn(projectStore, selection, editor, id);
	registerSelectionRetirement(projectStore, selection, renderState);

	// Both halves of SDD §65 — `reportFault`'s throw and `notifyIfRefused`'s resolved
	// refusal — bound straight to the context bar's Undo/Redo clicks.
	// `ReversibleCalibratePlanCommand.undo()`
	// refuses with a revision conflict whenever anything else has touched the plan's
	// sidecar since (every zone create, move and delete does), and this is what makes THAT
	// refusal say something rather than nothing.
	async function undo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.commands.logger, DISPATCH_FAULT_EVENT, wrappedDispatcher.undo()));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.commands.logger, DISPATCH_FAULT_EVENT, wrappedDispatcher.redo()));
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

	// The assign picker's options and the Inspector's rows, hydrated at mount and re-read on the
	// three doors that carry what they draw — the catalogue's, the price's and the recalculation
	// cascade's, rather than on the plan's. Every disposal matters for the reason it does at
	// `PlanEditorRoot`'s `hydrate`: Obsidian reuses a view, so a listener outliving its Vue tree
	// writes into a retired one.
	const assetOptionsRef = ref<readonly { readonly id: string; readonly name: string }[]>([]);
	subscribeToChangedFigures(context, inspector, assetOptionsRef);

	return {
		dispatcher: wrappedDispatcher,
		toolManager,
		renderState,
		activeToolId,
		setTool,
		returnToSelect,
		cancelActiveTask,
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
		selectAndFrame,
	};
}

/**
 * Exported ONLY so a test can reach a mounted leaf's runtime the way `PLAN_EDITOR_CONTEXT`
 * already lets one supply a `PlanEditorContext` — `provide()` sets this on `PlanEditorRoot`'s
 * OWN component instance, so `wrapper.vm.$.provides[EDITOR_RUNTIME]` reads it back without
 * needing a descendant that calls `useEditorRuntime()` itself. Nothing in `src/` outside this
 * file imports the symbol for any other reason.
 */
export const EDITOR_RUNTIME: InjectionKey<EditorRuntime> = Symbol('renovation-planner:editor-runtime');

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
