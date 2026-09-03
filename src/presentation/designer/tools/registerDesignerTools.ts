import type { AppError } from '../../../core/errors/AppError';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ReversibleAssetDesignCommands } from '../../../application/editor/asset/ReversibleAssetDesignCommands';
import type { StringKey } from '../../i18n/locales/en';
import { CalibrateTool, type KnownDistanceSupplier } from '../../editor/tools/calibrate-tool';
import { DrawPolygonTool } from '../../editor/tools/draw-polygon-tool';
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
 * **What these tools publish to `RenderState` is drawn by `DesignerGestureLayer`** — the sketch
 * and the tape both — through the same `gestureGeometry.ts` the plan editor's interaction layer
 * uses. It was not for a whole increment, and the close target a trace has to hit was invisible.
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
 * have to get right twice. What it does NOT share is a label key — the Plan Editor's own
 * calibrate label lives in its own table (Task 13 retired its toolbar; Task 14 gives the gesture
 * a new door there) and says "Calibrate" about a plan's background, while this table is what the
 * designer's own toolbar builds its buttons from.
 */

/**
 * FIVE tools and no Select. The designer shipped a `SelectTool` over an empty candidate set
 * with a move factory that threw, under a docblock saying Task B8 would give the surface a
 * selection; B8 shipped an inspector that reads the design and no selection, and the button
 * stayed — a live control that did nothing but stop a primary-button pan, which slice 14's
 * amendment refuses. Selection returns with the first thing on this canvas that can be
 * selected and moved, and it returns with its candidates and its gesture together.
 */
export const DESIGNER_TOOL_LABELS = {
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
	/**
	 * Where a completed trace hands control back to (Task 10). This surface registers no
	 * `select` tool — see this file's own FIVE-tools note above `DESIGNER_TOOL_LABELS` — so
	 * `runtime.ts` binds this to camera mode (`setTool(null)`) rather than to Select.
	 */
	readonly returnToCamera: () => void;
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
	const { assetId, edits, returnToCamera } = deps;
	/**
	 * TOTAL over `DesignerToolId`, which is what makes the toolbar's table and this function
	 * one fact rather than two. Registered by iterating the record's own values, so there is no
	 * second list of "the ones to register".
	 */
	const tools: Readonly<Record<DesignerToolId, EditorTool>> = {
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
			// The designer registers no `select` tool (see the FIVE-tools note above), so a
			// completed trace returns to camera mode rather than to a tool that does not exist.
			onCompleted: returnToCamera,
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
			// Same reason as `trace-footprint` above: no Select tool here, so completing a
			// clearance trace hands control back to camera mode.
			onCompleted: returnToCamera,
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
