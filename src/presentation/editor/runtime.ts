import { computed, inject, provide, reactive, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { SessionWriteLedger } from '../../application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../application/commands/zone/reversible-delete-zone-command';
import type { EntityId } from '../../core/identity/EntityId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import { useEditorStore } from '../stores/EditorStore';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import {
	createInspectorStoreDefinition,
	type InspectorDto,
} from './inspector/inspector-store';
import { CommandHistory } from './tools/command-history';
import { createEditorContext, type EditorContext } from './tools/editor-context';
import type { ToolId } from './tools/editor-tool';
import { ReversibleMoveZoneCommand, type ReversibleMoveZoneVertexCommand } from './tools/reversible-move-zone-command';
import { RenderState } from './tools/render-state';
import { ToolManager } from './tools/tool-manager';
import { DrawPolygonTool } from './tools/draw-polygon-tool';
import { SelectTool } from './tools/select-tool';
import { withEditorStateRefresh } from './tools/with-editor-state-refresh';
import { SnapService } from './snapping/snap-service';
import { STAGE_PIXELS, screenToWorld, worldToScreen } from './viewport/Viewport';
import { tr } from '../i18n/strings';
import { notify } from '../notices/notify';
import type { EditorContext as VueEditorContext } from './EditorContext';

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

/** Grid snapping defaults until settings grow editor knobs: a 10 cm grid. */
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
	readonly canUndo: ComputedRef<boolean>;
	readonly canRedo: ComputedRef<boolean>;
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
	context: VueEditorContext,
	dispatcher: Pick<EditorRuntime['dispatcher'], 'run'>,
	ledger: SessionWriteLedger,
) {
	return createInspectorStoreDefinition({
		query: { execute: ({ zoneId }) => context.commands.zoneInspector.execute({ zoneId }) },
		dispatcher,
		// Edit → Command (SDD §59's last arrow). The delete is routed here — the Inspector's
		// ONE dispatch path — so its refresh and history entry are the shared ones.
		toCommand: (edit) => {
			if (
				edit['kind'] === 'delete' &&
				typeof edit['zoneId'] === 'string'
			) {
				return new ReversibleDeleteZoneCommand(
					context.commands.deleteZone,
					context.commands.zones,
					ledger,
					{ zoneId: edit['zoneId'] as ZoneId },
				);
			}
			throw new Error('No Inspector edit is mapped to a command yet.');
		},
	})();
}

/** The two concrete tools of this slice, registered against one shared context factory. */
function registerEditorTools(
	toolManager: ToolManager,
	context: VueEditorContext,
	projectStore: ReturnType<typeof useProjectStore>,
	ledger: SessionWriteLedger,
): void {
	toolManager.register(
		new SelectTool({
			spatialObjects: () =>
				[...projectStore.zones.values()].map((zone) => ({ id: zone.id, points: zone.points })),
			// Body drags AND vertex drags produce the same whole-geometry-replacement gesture
			// (see the alias's own doc comment); only forward/inverse differ.
			createMoveGesture: (zoneId, forward, inverse): ReversibleMoveZoneVertexCommand =>
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

function buildRuntime(context: VueEditorContext): EditorRuntime {
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
	// history-flag mirror below hears about tool gestures as well as toolbar ones.
	const historyRevision = ref(0);
	function track<T>(result: T): T {
		historyRevision.value += 1;
		return result;
	}
	const wrappedDispatcher: EditorRuntime['dispatcher'] = {
		run: async (command) => track(await dispatcher.run(command)),
		undo: async () => track(await dispatcher.undo()),
		redo: async () => track(await dispatcher.redo()),
	};

	const inspector = createInspector(context, wrappedDispatcher, ledger);
	inspectorRef.current = inspector;

	// The viewport adapter closes over the live camera ref — the same binding
	// `editor-context.ts` describes for the composition root's side of this seam.
	const viewportAdapter = {
		worldToScreen: (point: Parameters<typeof worldToScreen>[0]) =>
			worldToScreen(point, editor.viewport, STAGE_PIXELS),
		screenToWorld: (point: Parameters<typeof screenToWorld>[0]) =>
			screenToWorld(point, editor.viewport, STAGE_PIXELS),
		setPan: () => undefined,
		setZoom: () => undefined,
	};

	// A `reactive()` proxy over slice 6's plain class: the tools write through the same
	// fields their tests set, and the InteractionLayer reads them reactively.
	const renderState = reactive(new RenderState());

	const toolContext: EditorContext = createEditorContext({
		bindViewport: () => viewportAdapter,
		selection,
		snapService: SNAP_SERVICE,
		commandDispatcher: wrappedDispatcher,
		writeLedger: ledger,
		renderState,
		// `calibration: null` is a declared placeholder, not a lie about the plan: nothing
		// in slice 8 reads it, and the calibrated value arrives when a consumer needs it —
		// re-read from the plan's sidecar entry at activation, not cached here.
		activePlan: { id: context.planId as never, calibration: null },
	});

	const toolManager = new ToolManager(() => toolContext);
	registerEditorTools(toolManager, context, projectStore, ledger);

	// Reactive mirror of ToolManager's non-reactive pointer. The toolbar reads this; the
	// manager stays framework-pure (no Vue), so the mirror lives here at the seam.
	const activeToolId = ref<ToolId | null>(null);

	const setTool = (id: ToolId | null): void => {
		if (id === null) {
			toolManager.clearActiveTool();
		} else {
			toolManager.setActiveTool(id);
		}
		activeToolId.value = id;
		editor.activeToolId = id;
	};

	async function undo(): Promise<void> {
		await wrappedDispatcher.undo();
	}
	async function redo(): Promise<void> {
		await wrappedDispatcher.redo();
	}
	const canUndo = computed(() => {
		void historyRevision.value;
		return history.canUndo;
	});
	const canRedo = computed(() => {
		void historyRevision.value;
		return history.canRedo;
	});

	async function deleteZone(zoneId: ZoneId): Promise<void> {
		// Through the Inspector's own commit path (SDD §59), not a second dispatch seam.
		const result = await inspector.commit({ kind: 'delete', zoneId });
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

export function provideEditorRuntime(context: VueEditorContext): EditorRuntime {
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
