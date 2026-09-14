/**
 * Fixtures for the asset designer's selection (symbols spec, Decision 10): a toilet built by its REAL
 * preset, a point just inside an outline, and the unit rig `DesignerSelectTool` is driven by.
 *
 * Shared rather than copied, so the unit suites and the mounted ones name one shape and one set of
 * points — and so every coordinate a case uses is DERIVED from the preset, never typed beside it.
 */
import type { AppError } from '../../src/core/errors/AppError';
import type { CurvedPolygon } from '../../src/core/geometry/CurvedPolygon';
import type { Point } from '../../src/core/geometry/Point';
import { ok } from '../../src/core/result/Result';
import type { DispatchResult } from '../../src/application/commands/DispatchOutcome';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import type { DesignerSelection, SelectionMode } from '../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../src/presentation/designer/selection/snapCandidates';
import { DesignerSelectTool } from '../../src/presentation/designer/tools/designer-select-tool';
import { expectDefined, observationToken } from './domain';
import { toiletShape } from './assetShapes';
import { toolContext, type ToolContextHarness, type ToolContextOptions } from './tool-context';

/** The toilet at its default size: a round-fronted footprint, a front clearance, `detail-1` the tank, `detail-2` the bowl. */
export const TOILET: AssetShape = toiletShape(); // Task 3's fixture, one definition

/** A detail of `TOILET`'s outline by id, so a case names the part rather than an array index. */
export function detailOutline(id: string): CurvedPolygon {
	return expectDefined(TOILET.details.find((detail) => detail.id === id), `detail ${id}`).outline;
}

/**
 * Ten millimetres above an outline's lowest corner point, on its horizontal centre. Inside the tank,
 * the bowl's straight middle and the footprint alike — and more than a grab radius from the anchor at
 * both cameras the suites use (8 mm in the unit rig, 80 mm in the mounted one).
 */
export function justInsideBottom(outline: CurvedPolygon): Point {
	const xs = outline.points.map((point) => point.x);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...outline.points.map((point) => point.y)) - 10 };
}

/** The version every unit-rig design reads as, so a case can assert the write was made conditional on it. */
export const DESIGN_VERSION: EntityVersion = { revision: 7, observed: observationToken('geometry-7') };

export interface SelectToolRigOptions {
	/** Default `TOILET`; `null` is an asset nobody has drawn on. */
	readonly shape?: AssetShape | null;
	readonly selection?: DesignerSelection | null;
	readonly mode?: SelectionMode;
	readonly context?: ToolContextOptions;
}

export interface SelectToolRig {
	readonly tool: DesignerSelectTool;
	readonly harness: ToolContextHarness;
	/** Every `select` call, in order. */
	readonly selected: (DesignerSelection | null)[];
	/** Every `setPreview` call, in order. */
	readonly previews: (AssetShape | null)[];
	/** Every write built, with the version it was made conditional on. */
	readonly written: { readonly shape: AssetShape; readonly expected: EntityVersion }[];
	readonly rejected: AppError[];
	readonly invalid: AppError[];
}

/**
 * `DesignerSelectTool` over the real hit order, the real drag arithmetic and the REAL snap service
 * (`tool-context.ts`'s subclass), with the store's four members replaced by recorders. The snap
 * candidates are the designer's own function over the same shape the tool reads.
 */
export function selectToolRig(options: SelectToolRigOptions = {}): SelectToolRig {
	const shape = options.shape === undefined ? TOILET : options.shape;
	let selection = options.selection ?? null;
	const mode = options.mode ?? 'transform';
	const selected: SelectToolRig['selected'] = [];
	const previews: SelectToolRig['previews'] = [];
	const written: SelectToolRig['written'] = [];
	const rejected: AppError[] = [];
	const invalid: AppError[] = [];
	const harness = toolContext({
		snapCandidates: (exclude) => designerSnapCandidates(shape, exclude ?? []),
		...options.context,
	});
	const tool = new DesignerSelectTool({
		design: () => (shape === null ? null : { shape, geometryVersion: DESIGN_VERSION }),
		selection: () => selection,
		mode: () => mode,
		select: (next) => {
			selected.push(next);
			selection = next;
		},
		setPreview: (next) => {
			previews.push(next);
		},
		createCommand: (next, expected) => {
			written.push({ shape: next, expected });
			return {
				execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
				undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
			};
		},
		reportRejected: (error) => {
			rejected.push(error);
		},
		reportInvalidInput: (error) => {
			invalid.push(error);
		},
	});
	return { tool, harness, selected, previews, written, rejected, invalid };
}
