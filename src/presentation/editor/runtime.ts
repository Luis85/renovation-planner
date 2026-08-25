import { inject, provide, reactive, ref, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger } from '../../application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../application/commands/zone/reversible-delete-zone-command';
import type { AppError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { EntityId } from '../../core/identity/EntityId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import { useEditorStore } from '../stores/EditorStore';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import {
	createInspectorStoreDefinition,
	type InspectorDto,
	type InspectorEdit,
} from './inspector/inspector-store';
import { CommandHistory } from './tools/command-history';
import { createEditorContext, type EditorContext } from './tools/editor-context';
import type { ToolId } from './tools/editor-tool';
import { ReversibleMoveZoneCommand } from './tools/reversible-move-zone-command';
import { RenderState } from './tools/render-state';
import { ToolManager } from './tools/tool-manager';
import { DrawPolygonTool } from './tools/draw-polygon-tool';
import { SelectTool } from './tools/select-tool';
import { withEditorStateRefresh } from './tools/with-editor-state-refresh';
import { SnapService } from './snapping/snap-service';
import { STAGE_PIXELS, screenToWorld, worldPerScreenPixel, worldToScreen } from './viewport/Viewport';
import { tr } from '../i18n/strings';
import { notify } from '../notices/notify';
import type { PlanEditorContext } from './PlanEditorContext';

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
	/** Selection → DTO (SDD §59's first arrow), for the panel's watcher. */
	readonly hydrateInspector: (ids: readonly EntityId<string>[]) => Promise<void>;
	readonly deleteZone: (zoneId: ZoneId) => Promise<void>;
}

/**
 * The Inspector store, pointed at the query and at a dispatcher slot filled in later —
 * the store needs the dispatcher and the dispatcher needs the store, so the cycle is
 * broken with one indirection here rather than by reordering an impossible construction.
 */
function createInspector(
	context: PlanEditorContext,
	dispatcher: Pick<EditorRuntime['dispatcher'], 'run'>,
	ledger: SessionWriteLedger,
) {
	return createInspectorStoreDefinition({
		query: { execute: ({ zoneId }) => context.commands.zoneInspector.execute({ zoneId }) },
		dispatcher,
		// Edit → Command (SDD §59's last arrow). The delete is routed here — the Inspector's
		// ONE dispatch path — so its refresh and history entry are the shared ones.
		//
		// A `switch` over `InspectorEdit`'s discriminant and no fallback: the union has one
		// member, so the compiler already knows this is total, and the second member added
		// to it fails to build HERE rather than throwing out of a click handler at runtime,
		// which is what the previous shape-testing version did.
		toCommand: (edit: InspectorEdit) => {
			switch (edit.kind) {
				case 'delete':
					return new ReversibleDeleteZoneCommand(
						context.commands.deleteZone,
						context.commands.zones,
						ledger,
						{ zoneId: edit.zoneId },
					);
			}
		},
	})();
}

/** The two concrete tools of this slice, registered against one shared context factory. */
function registerEditorTools(
	toolManager: ToolManager,
	context: PlanEditorContext,
	projectStore: ReturnType<typeof useProjectStore>,
	ledger: SessionWriteLedger,
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
			reportRejected: (error) => notify(error.message),
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
			reportRejected: (error) => notify(error.message),
		}),
	);
}

type VoidResult = Result<void, AppError>;

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
async function reportFault(operation: Promise<VoidResult>): Promise<VoidResult | null> {
	try {
		return await operation;
	} catch (cause) {
		notify(cause instanceof Error ? cause.message : String(cause));
		return null;
	}
}

function buildRuntime(context: PlanEditorContext): EditorRuntime {
	const editor = useEditorStore();
	const projectStore = useProjectStore();
	const selection = useSelectionStore();

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

	// Every dispatch in the leaf — tools included — funnels through THIS object, so the
	// history-flag mirror hears about tool gestures as well as toolbar ones.
	//
	// Two plain refs re-read from the history rather than an invalidation counter that two
	// computeds subscribed to with a `void revision.value` statement: that spelling put a
	// line with no visible effect above each `return`, and any tidy-up of it froze the
	// Undo/Redo buttons in whatever state they had at mount with nothing erroring.
	//
	// `finally`, not the resolved path: an unexpected technical fault can still leave the
	// stacks moved (SDD §65), and flags that stop tracking after one throw are wrong for
	// the rest of the leaf's life.
	const canUndo = ref(history.canUndo);
	const canRedo = ref(history.canRedo);
	async function stepping(operation: () => Promise<VoidResult>): Promise<VoidResult> {
		try {
			return await operation();
		} finally {
			canUndo.value = history.canUndo;
			canRedo.value = history.canRedo;
		}
	}
	const wrappedDispatcher: EditorRuntime['dispatcher'] = {
		run: (command) => stepping(() => dispatcher.run(command)),
		undo: () => stepping(() => dispatcher.undo()),
		redo: () => stepping(() => dispatcher.redo()),
	};

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
	registerEditorTools(toolManager, context, projectStore, ledger);

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

	// `notify`, not a bare `void`: these two are bound straight to toolbar clicks, and
	// `CommandHistory` deliberately lets an unexpected technical fault reject rather than
	// resolve a `Result` (SDD §65). Without this the user's Undo press would produce an
	// unhandled promise rejection and no word of what happened — the same seam every
	// refused gesture in this leaf already reports through.
	async function undo(): Promise<void> {
		await reportFault(wrappedDispatcher.undo());
	}
	async function redo(): Promise<void> {
		await reportFault(wrappedDispatcher.redo());
	}

	async function deleteZone(zoneId: ZoneId): Promise<void> {
		// Through the Inspector's own commit path (SDD §59), not a second dispatch seam.
		const result = await reportFault(inspector.commit({ kind: 'delete', zoneId }));
		if (result === null) return;
		if (!result.ok) {
			// Same seam the tools use: a refused delete must not just do nothing.
			notify(result.error.message);
			return;
		}
		if (
			selection.selectedIds.length === 1 &&
			String(selection.selectedIds[0]) === zoneId
		) {
			selection.clear();
		}
	}

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
		hydrateInspector: (ids) => inspector.hydrateFrom(ids),
		deleteZone,
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
