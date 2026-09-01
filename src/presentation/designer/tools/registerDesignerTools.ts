import type { AppError } from '../../../core/errors/AppError';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ReversibleAssetDesignCommands } from '../../../application/editor/asset/ReversibleAssetDesignCommands';
import type { StringKey } from '../../i18n/locales/en';
import { CalibrateTool, type KnownDistanceSupplier } from '../../editor/tools/calibrate-tool';
import { DrawPolygonTool } from '../../editor/tools/draw-polygon-tool';
import { SelectTool } from '../../editor/tools/select-tool';
import type { EditorTool } from '../../editor/tools/editor-tool';
import type { ToolManager } from '../../editor/tools/tool-manager';
import { SetAnchorTool } from './set-anchor-tool';
import { SetFacingTool } from './set-facing-tool';

/**
 * The asset designer's tools, and the ONE table that says which they are (design slice B5).
 *
 * **This is where slice 7 would repeat itself and does not.** `CalibrateTool` was written,
 * proven by its own tests and absent from the registration list; it was unreachable for two
 * whole slices with all four gates green, because nothing was wrong with the code, and it took
 * a human opening the toolbar. The remedy here is not a test that copies a list — a copied
 * list is the thing that went wrong — but a TYPE: `DESIGNER_TOOL_LABELS` names the designer's
 * tools once, `DesignerToolId` is derived from its keys, and `registerDesignerTools` builds a
 * record that is TOTAL over that union and registers every value of it. So:
 *
 * - a tool the toolbar offers with no implementation is a build error (a missing key in a
 *   total record);
 * - a tool implemented and not registered is impossible, because the loop registers the whole
 *   record rather than a list somebody wrote out;
 * - and a tool implemented, registered and offered under a MISMATCHED id is what the type
 *   cannot see — `EditorTool.id` is the wide `ToolId` — so `designerToolbar.test.ts` clicks
 *   every button in the mounted designer and asserts that leaf's manager reports that tool
 *   active. `ToolManager.setActiveTool` throws for an id nothing registered, which is what
 *   makes that a real check rather than a count of buttons.
 *
 * **What no gate here can show: the gesture while it is being made.** Design slice B4 gave the
 * designer four world-space layers and no transient one, so `RenderState.polygonSketch` and
 * `RenderState.measurement` — which these tools publish exactly as their Plan Editor
 * counterparts do — are drawn by nothing on this canvas. A traced footprint appears when it is
 * committed and the facing arrow when it is written; the rubber band in between is invisible.
 * That is an increment-level gap (no task in this plan builds a designer interaction layer)
 * rather than a defect in a tool, and it is written here because this is the file that decides
 * these tools exist at all.
 */

/**
 * Every designer tool, with the label its toolbar button carries.
 *
 * A record rather than an array because its KEYS are the union below, and `StringKey` keeps
 * each value type-checked: a label the string table does not declare fails `npm run build`,
 * exactly as a `tr(...)` call in a template does.
 *
 * Camera mode is deliberately absent. It is "no active tool" (`ToolManager.clearActiveTool`),
 * a toolbar STATE and never an `EditorTool`, for the reason `EditorSurface.vue` states — the
 * camera is ephemeral UI (SDD §15) and is never a command. An entry here is a tool this
 * function then has to construct, and camera mode is not one.
 *
 * `calibrate` shares the Plan Editor's `CalibrateTool` rather than a designer copy of it (Task
 * B6): that tool's two-click gesture, its generation counter, its buffered second point and its
 * `abandonGesture` asymmetry are two hundred lines of subtle state a second implementation would
 * have to get right twice. What it does NOT share is a label key — `editor.toolbar.calibrate`
 * says "Calibrate" about a plan's background, and this table is what the designer's own toolbar
 * builds its buttons from.
 */
export const DESIGNER_TOOL_LABELS = {
	select: 'editor.toolbar.select',
	'trace-footprint': 'designer.toolbar.trace-footprint',
	'trace-clearance': 'designer.toolbar.trace-clearance',
	'set-anchor': 'designer.toolbar.set-anchor',
	'set-facing': 'designer.toolbar.set-facing',
	calibrate: 'designer.toolbar.calibrate',
} as const satisfies Readonly<Record<string, StringKey>>;

/**
 * The ids this surface registers, derived from the table above so the two cannot disagree.
 *
 * NOT exported: its only consumer is the record type in `registerDesignerTools` below, and an
 * export with no consumer is an `unused-exports` finding — `npm run analyze` reported exactly
 * that on its first draft. A caller that needs it can derive it the same way this line does,
 * from the exported table.
 */
type DesignerToolId = keyof typeof DESIGNER_TOOL_LABELS;

/**
 * What the designer's tools are built from.
 *
 * `edits` is the reversible adapter set, minted per leaf over that leaf's own two write
 * ledgers — every gesture here goes through it rather than through a plain command, because
 * the toolbar advertises undo and redo and a plain command has no inverse for them to reach.
 * `assetId` is passed rather than re-derived, so the ONE cast that turns Obsidian's opaque
 * per-leaf string into a branded id stays a single site.
 */
export interface DesignerToolDeps {
	readonly assetId: AssetId;
	readonly edits: ReversibleAssetDesignCommands;
	/**
	 * A DISPATCHED failure — one the dispatcher answered with, rather than one a tool refused
	 * for itself.
	 *
	 * It used to read "one a command ran and returned", which stopped being the whole story when
	 * `mapDispatchFaults` was put in front of `EditorContext.commandDispatcher.run`: a vault
	 * fault below the boundary now arrives here as a resolved failed `Result` too, carrying the
	 * technical-fault stamp. That is deliberate and it is what `reportDispatchFailure` — what
	 * this is bound to — asks about FIRST, so a fault keeps its own sentence instead of a "Save
	 * error" badge with no cause.
	 */
	readonly reportRejected: (error: AppError) => void;
	/** A refusal a tool made ITSELF, before any command was built. Slice 17's split. */
	readonly reportInvalidInput: (error: AppError) => void;
	/**
	 * What asks the user for the real-world distance once two points are picked — bound to the
	 * leaf's own `DialogHost` by `runtime.ts`, exactly as the Plan Editor binds it. `null` is
	 * this seam's word for "dismissed".
	 */
	readonly supplyKnownDistance: KnownDistanceSupplier;
	/**
	 * Whether a calibration would MOVE anything this asset already holds — which on this
	 * surface is "does any coordinate group still await a scale", not "is there geometry". A
	 * calibration converts exactly the groups whose pending flag is set and leaves every
	 * measured one alone, so an asset with nothing pending has nothing to be warned about.
	 */
	readonly hasGeometryToRescale: () => boolean;
	/** Asks the user to accept that rescale; `true` proceeds. Never called when the above is false. */
	readonly confirmRecalibration: () => Promise<boolean>;
}

/**
 * The designer's `SelectTool`, and the honest account of what it does here.
 *
 * It hit-tests an EMPTY candidate list, because nothing on this canvas is selectable yet: the
 * footprint, the clearance and the anchor are drawn on `listening: false` layers and there is
 * no inspector for a selection to fill until Task B8. So a click in Select mode clears the
 * selection and nothing else.
 *
 * That is not the live-control-that-does-nothing this repository refuses, and the distinction
 * is worth stating because it looks like one. Select mode differs OBSERVABLY from camera mode:
 * with no tool active a primary drag pans the view, and with this tool active it does not. The
 * button therefore switches between two real behaviours today, and grows a third — hit-testing
 * — when there is something to hit.
 *
 * `createMoveGesture` THROWS rather than returning a no-op command, on
 * `planEditorRig.calibratePlan`'s reasoning: it is unreachable (a move gesture can only start
 * on a hit, and nothing can be hit), and whoever first makes it reachable needs this sentence
 * rather than a silent success. Its signature takes a `ZoneId`, which is the shape of the
 * remaining work: moving an asset's outline is a `SetAssetFootprint` over translated points,
 * not a zone move, so this seam is what changes when Task B8 gives the designer a selection.
 *
 * It is a NAMED export rather than an inline arrow, and for the reason the module this task
 * deleted was written with: `ToolManager`'s own context factory was a named export whose throw
 * `layers.test.ts` asserted, because "the only way to know this refuses rather than silently
 * handing out a hollow one is to ask it". An unreachable inline arrow is a function no test can
 * ask anything of — and, on this repository's coverage floors, one nothing can cover either.
 */
export function noSelectableObjectsYet(): never {
	throw new Error(
		'The asset designer has nothing selectable to move: SelectTool is registered with an empty '
			+ 'candidate set until Task B8 gives this surface a selection. Give it real candidates and a '
			+ 'footprint-move gesture together, not one without the other.',
	);
}

function designerSelectTool(deps: DesignerToolDeps): SelectTool {
	return new SelectTool({
		spatialObjects: () => [],
		createMoveGesture: noSelectableObjectsYet,
		reportRejected: deps.reportRejected,
		reportInvalidInput: deps.reportInvalidInput,
	});
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
	const { assetId, edits } = deps;
	/**
	 * TOTAL over `DesignerToolId`, which is what makes the toolbar's table and this function
	 * one fact rather than two. Registered by iterating the record's own values, so there is no
	 * second list of "the ones to register".
	 */
	const tools: Readonly<Record<DesignerToolId, EditorTool>> = {
		select: designerSelectTool(deps),
		// `createdId` is `null` for both traces, which is the second of the two states
		// `PolygonCommand.createdId` declares and the one that interface predicted: tracing an
		// Asset's outline REPLACES a field of the asset already open, so there is no new entity
		// to select and the tool leaves the selection exactly as the user had it.
		'trace-footprint': new DrawPolygonTool({
			id: 'trace-footprint',
			completion: {
				commandFor: (geometry) => {
					const edit = edits.setFootprint({ assetId, points: geometry.points });
					return { execute: () => edit.execute(), undo: () => edit.undo(), createdId: null };
				},
			},
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
		}),
		'trace-clearance': new DrawPolygonTool({
			id: 'trace-clearance',
			completion: {
				commandFor: (geometry) => {
					const edit = edits.setClearance({ assetId, points: geometry.points });
					return { execute: () => edit.execute(), undo: () => edit.undo(), createdId: null };
				},
			},
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
		}),
		'set-anchor': new SetAnchorTool({
			createCommand: (anchor) => edits.setAnchor({ assetId, anchor }),
			reportRejected: deps.reportRejected,
		}),
		'set-facing': new SetFacingTool({
			createCommand: (facing) => edits.setFacing({ assetId, facing }),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
		}),
		// The Plan Editor's own tool, over this leaf's asset. The ASSET is bound here, in the
		// one place its branded id already lives — `CalibrateTool` hands back the measurement
		// and never a subject, because `EditorContext.subject.id` is a bare `EntityId<string>`
		// so that one tool framework can serve a Plan and an Asset.
		calibrate: new CalibrateTool({
			supplyKnownDistance: deps.supplyKnownDistance,
			hasGeometryToRescale: deps.hasGeometryToRescale,
			confirmRecalibration: deps.confirmRecalibration,
			createCommand: (measurement) => edits.calibrate({ assetId, ...measurement }),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
		}),
	};
	for (const tool of Object.values(tools)) manager.register(tool);
}
