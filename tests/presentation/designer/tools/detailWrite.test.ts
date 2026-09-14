/**
 * The detail tools' ONE write as `registerDesignerTools` builds it (symbols spec, Amendment 2), over a
 * recording context whose dispatcher HOLDS the command rather than executing it — so a case can change
 * the design between the release and the moment the write's step runs, which is the gap a queued write
 * waits in. `designerWriteChain.test.ts` is the mounted half.
 */
import { describe, expect, it } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { ReversibleAssetDesignCommands } from '../../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { registerDesignerTools } from '../../../../src/presentation/designer/tools/registerDesignerTools';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import { observationToken } from '../../../helpers/domain';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';
import { flushGesture, pointerAt, toolContext } from '../../../helpers/tool-context';

const LATER_VERSION: EntityVersion = { revision: 8, observed: observationToken('geometry-8') };
/** The toilet after a write that added a third detail — so the id a new detail takes has moved on. */
const WITH_THIRD = { ...TOILET, details: [...TOILET.details, { ...TOILET.details[0], id: 'detail-3' }] };

function drawRig() {
	let design: { shape: AssetShape; geometryVersion: EntityVersion } | null = { shape: TOILET, geometryVersion: DESIGN_VERSION };
	const held: UndoableCommand[] = [];
	const built: { shape: AssetShape; expected: EntityVersion }[] = [];
	const inner = { executed: 0, undone: 0 };
	const harness = toolContext({
		commandDispatcher: {
			run: (command) => {
				held.push(command);
				return new Promise<DispatchResult>(() => {
					// Never settles: each case runs the held step itself.
				});
			},
		},
	});
	const manager = new ToolManager(() => harness.context);
	registerDesignerTools(manager, {
		assetId: 'asset-1' as AssetId,
		edits: {} as ReversibleAssetDesignCommands,
		reportRejected: () => undefined,
		reportInvalidInput: () => undefined,
		supplyKnownDistance: () => Promise.resolve(null),
		hasGeometryToRescale: () => false,
		confirmRecalibration: () => Promise.resolve(false),
		detailPending: () => false,
		returnToSelect: () => undefined,
		selectTool: {
			design: () => design,
			selection: () => null,
			mode: () => 'transform',
			select: () => undefined,
			setPreview: () => undefined,
			createCommand: (shape, expected) => {
				built.push({ shape, expected });
				return {
					execute: () => {
						inner.executed += 1;
						return Promise.resolve(ok('wrote'));
					},
					undo: () => {
						inner.undone += 1;
						return Promise.resolve(ok('wrote'));
					},
				};
			},
			reportRejected: () => undefined,
			reportInvalidInput: () => undefined,
			writing: () => false,
			settled: () => Promise.resolve(),
		},
	});
	manager.setActiveTool('draw-rect');
	return {
		held,
		built,
		inner,
		manager,
		setDesign: (next: typeof design) => {
			design = next;
		},
	};
}

/** A rectangle far outside the toilet, where nothing snaps. */
function drawRect(rig: ReturnType<typeof drawRig>): void {
	rig.manager.pointerDown(pointerAt(1000, 1000));
	rig.manager.pointerMove(pointerAt(1200, 1100));
	rig.manager.pointerUp(pointerAt(1200, 1100));
}

describe('a drawn detail’s write', () => {
	it('is built on the design its step reads, not the one its release read', async () => {
		const rig = drawRig();
		drawRect(rig);
		expect(rig.built).toEqual([]);

		rig.setDesign({ shape: WITH_THIRD, geometryVersion: LATER_VERSION });
		await expect(rig.held[0]?.execute()).resolves.toEqual(ok('wrote'));

		expect(rig.built).toHaveLength(1);
		expect(rig.built[0]?.expected).toBe(LATER_VERSION);
		expect(rig.built[0]?.shape.details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3', 'detail-4']);
	});

	it('refuses at its step, building nothing, when the design it reads then has no shape', async () => {
		const rig = drawRig();
		drawRect(rig);

		rig.setDesign(null);
		const result = await rig.held[0]?.execute();

		expect(result?.ok === false && result.error.code).toBe('asset.no-footprint');
		expect(rig.built).toEqual([]);
	});

	/** Green before this task too (the command WAS the built one then); it pins that the lazy write is built once. */
	it('re-executes the write it built on redo, reading the design once, and undoes through it', async () => {
		const rig = drawRig();
		drawRect(rig);
		const command = rig.held[0] as UndoableCommand;

		await command.execute();
		rig.setDesign({ shape: WITH_THIRD, geometryVersion: LATER_VERSION });
		await command.undo();
		await command.execute();
		await flushGesture();

		expect(rig.built).toHaveLength(1);
		expect(rig.built[0]?.expected).toBe(DESIGN_VERSION);
		expect(rig.inner).toEqual({ executed: 2, undone: 1 });
	});
});
