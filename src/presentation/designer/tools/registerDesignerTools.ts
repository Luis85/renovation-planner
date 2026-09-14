import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { createPolygon } from '../../../core/geometry/Polygon';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { addDetail, nextDetailId } from '../../../domain/asset/detailEdits';
import { requireShape } from '../../../application/commands/asset/updateAssetShape';
import type { ReversibleAssetDesignCommands } from '../../../application/editor/asset/ReversibleAssetDesignCommands';
import type { StringKey } from '../../i18n/locales/en';
import { CalibrateTool, type KnownDistanceSupplier } from '../../editor/tools/calibrate-tool';
import { DrawPolygonTool } from '../../editor/tools/draw-polygon-tool';
import type { EditorTool } from '../../editor/tools/editor-tool';
import type { ToolManager } from '../../editor/tools/tool-manager';
import type { UndoableCommand } from '../../editor/tools/undoable-command';
import { DesignerSelectTool, type DesignerSelectToolDeps } from './designer-select-tool';
import { circleOutline, DrawDetailTool, rectOutline, type DetailWrite } from './draw-detail-tool';
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
 * B6): a two-click gesture, a generation counter, a buffered second point and an
 * `abandonGesture` asymmetry a second implementation would have to get right twice. What it does
 * NOT share is a label key — the Plan Editor's own calibrate label lives in its own table and
 * says "Calibrate" about a plan's background, while this table is what the designer's own
 * toolbar builds its buttons from.
 *
 * Select is FIRST, and it is back on the condition this note used to set for it. The designer once
 * shipped a `SelectTool` over an empty candidate set with a move factory that threw — a live control
 * that did nothing but stop a primary-button pan, which slice 14's amendment refuses — and it was
 * withdrawn until selection could return "with its candidates and its gesture together". The symbols
 * spec's Decision 10 is that return: `hitDesign` is its candidates (footprint, clearance, details,
 * anchor, facing, in a stated order) and `DesignerSelectTool` its gesture.
 */
export const DESIGNER_TOOL_LABELS = {
	select: 'designer.toolbar.select',
	'trace-footprint': 'designer.toolbar.trace-footprint',
	'trace-clearance': 'designer.toolbar.trace-clearance',
	'draw-rect': 'designer.toolbar.draw-rect',
	'draw-circle': 'designer.toolbar.draw-circle',
	'trace-detail': 'designer.toolbar.trace-detail',
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
	 * Whether a detail added to `shape` right now awaits a scale — `captureAwaitsScale` over the
	 * leaf's calibration and background, which `selectTool.design()` does not carry (Decision 11:
	 * "by the rule tracing already follows").
	 */
	readonly detailPending: (shape: AssetShape) => boolean;
	/** Where a completed trace or drawn detail hands control back to: Select, as on a plan. */
	readonly returnToSelect: () => void;
	/** The Select tool's own deps — the leaf's design store and one conditional shape write. */
	readonly selectTool: DesignerSelectToolDeps;
}

/**
 * `addDetail` over the design `selectTool.design()` answers NOW, pending by the capture rule, with the
 * version a write of it is conditional on and the id the new detail will have.
 *
 * A shapeless asset refuses THROUGH `requireShape` (`updateAssetShape.ts`), the one function that owns
 * that code and its sentence, rather than a second spelling of them here: a detail, like a clearance,
 * is drawn relative to a footprint.
 */
function detailOn(deps: DesignerToolDeps, name: string, outline: CurvedPolygon): Result<{ readonly shape: AssetShape; readonly expected: EntityVersion; readonly detailId: string }, ValidationError> {
	const design = deps.selectTool.design();
	// A null shape only ever gets `requireShape`'s refusal, which is all the cast states.
	if (design === null) return requireShape(null) as Result<never, ValidationError>;
	const added = addDetail(design.shape, { name, outline, line: 'solid', pending: deps.detailPending(design.shape) });
	if (!added.ok) return err(added.error);
	return ok({ shape: added.value, expected: design.geometryVersion, detailId: nextDetailId(design.shape) });
}

/**
 * The ONE write all three detail tools build, and it asks `detailOn` TWICE, for two reasons.
 *
 * - **At release**, so a domain refusal is the tool's own: it reaches `reportInvalidInput` and
 *   dispatches nothing (the one-gesture constraint).
 * - **When its step runs**, inside `execute`: the leaf's dispatcher queues this write behind every
 *   earlier write and its read-back (`createWriteChain`, spec Amendment 2), so a draw released before a
 *   drag's or a nudge's refresh landed builds on what that write left rather than being refused as a
 *   version conflict. `detailId` is re-pointed at the id that read gives, and the tool reads it only
 *   once the dispatch has resolved. A refusal here is the dispatcher's answer, reported as one.
 *
 * The command is built ONCE: a redo re-executes the same write rather than reading the design again.
 */
function detailWrite(deps: DesignerToolDeps, name: string, outline: CurvedPolygon): Result<DetailWrite, ValidationError> {
	const released = detailOn(deps, name, outline);
	if (!released.ok) return err(released.error);
	let command: UndoableCommand | null = null;
	const write = {
		detailId: released.value.detailId,
		command: {
			execute: async (): Promise<DispatchResult> => {
				if (command === null) {
					const step = detailOn(deps, name, outline);
					if (!step.ok) return err(step.error);
					command = deps.selectTool.createCommand(step.value.shape, step.value.expected);
					write.detailId = step.value.detailId;
				}
				return await command.execute();
			},
			// Undo is only ever asked of a write whose `execute` succeeded, which built the command.
			undo: () => (command as UndoableCommand).undo(),
		},
	};
	return ok(write);
}

/** A drawn detail is selected once written, and every draw returns to Select (Amendment 1). */
function completeDetail(deps: DesignerToolDeps, detailId: string): void {
	deps.returnToSelect();
	deps.selectTool.select({ kind: 'detail', id: detailId });
}

/**
 * Trace detail is `DrawPolygonTool`. Every refusal a traced detail can meet — the polygon rules, no
 * footprint, `addDetail`'s own — is asked in `validateOutline`, which runs before any command is
 * built, so it reaches `reportInvalidInput` and dispatches NOTHING (the one-gesture constraint: a
 * domain refusal is never dispatched). The write that check built is held for `commandFor`, which
 * `closePolygon` calls straight after it with no await between, so the two cannot see different
 * designs.
 */
function traceDetailTool(deps: DesignerToolDeps): DrawPolygonTool {
	// Assigned by the successful `validateOutline` that always precedes `commandFor` and `onCompleted`.
	let traced!: DetailWrite;
	return new DrawPolygonTool({
		id: 'trace-detail',
		validateOutline: (points) => {
			const polygon = createPolygon(points);
			if (!polygon.ok) return polygon;
			const write = detailWrite(deps, 'outline', polygon.value);
			if (!write.ok) return write;
			traced = write.value;
			return polygon;
		},
		completion: {
			commandFor: () => ({ ...traced.command, createdId: null }),
		},
		reportRejected: deps.reportRejected,
		reportInvalidInput: deps.reportInvalidInput,
		onCompleted: () => completeDetail(deps, traced.detailId),
	});
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
	const { assetId, edits, returnToSelect } = deps;
	/**
	 * TOTAL over `DesignerToolId`, which is what makes the toolbar's table and this function
	 * one fact rather than two. Registered by iterating the record's own values, so there is no
	 * second list of "the ones to register".
	 */
	const tools: Readonly<Record<DesignerToolId, EditorTool>> = {
		select: new DesignerSelectTool(deps.selectTool),
		// `createdId` is `null` for the footprint and clearance traces, which is the second of the two states
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
			onCompleted: returnToSelect,
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
			onCompleted: returnToSelect,
		}),
		'draw-rect': new DrawDetailTool({
			id: 'draw-rect',
			outlineFor: rectOutline,
			commandFor: (outline) => detailWrite(deps, 'rectangle', outline),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
			onCompleted: (detailId) => completeDetail(deps, detailId),
		}),
		'draw-circle': new DrawDetailTool({
			id: 'draw-circle',
			outlineFor: circleOutline,
			commandFor: (outline) => detailWrite(deps, 'circle', outline),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
			onCompleted: (detailId) => completeDetail(deps, detailId),
		}),
		'trace-detail': traceDetailTool(deps),
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
