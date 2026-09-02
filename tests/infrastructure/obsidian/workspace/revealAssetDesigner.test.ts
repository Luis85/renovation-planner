/**
 * Opening the Asset Designer for a specific Asset.
 *
 * The sibling of `revealPlanEditor.test.ts`: the designer is per-ASSET, not a singleton, for
 * the same reason the Plan Editor is per-plan — comparing two objects means having both open.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { revealAssetDesigner } from '../../../../src/infrastructure/obsidian/workspace/revealAssetDesigner';
import { FakeWorkspace } from '../../../helpers/workspace';

const TYPE = 'renovation-asset-designer';

/** Every cause the activation answered — see `revealView.test.ts` for why it is a count. */
const faults: unknown[] = [];

beforeEach(() => {
	faults.length = 0;
});

/**
 * Builds the whole `RevealDeps`, for the fake rule `revealView.test.ts` states: `reportFault`
 * is required, and a case omitting it would only fail once something faulted.
 */
const depsFor = (fake: unknown) =>
	({
		workspace: fake,
		reportFault: (cause: unknown) => {
			faults.push(cause);
		},
	}) as never;

describe('revealing an asset designer', () => {
	it('opens a leaf carrying the asset id in its view state', async () => {
		const workspace = new FakeWorkspace();

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-chair');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state).toEqual({
			type: TYPE,
			active: true,
			state: { assetId: 'asset-chair' },
		});
		expect(workspace.revealed).toEqual([workspace.leaves[0]]);
	});

	it('reuses the leaf already showing that asset rather than opening a second', async () => {
		const workspace = new FakeWorkspace();
		const existing = workspace.withOpen(TYPE, { assetId: 'asset-chair' });

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-chair');

		expect(workspace.leaves).toEqual([existing]);
		expect(workspace.revealed).toEqual([existing]);
	});

	/**
	 * `setViewState` only on a leaf this call CREATED. Setting it on an existing leaf rebuilds
	 * a view the user has already read, calibrated or edited — the designer's whole working
	 * position.
	 */
	it('does not re-set the view state of a leaf it found', async () => {
		const workspace = new FakeWorkspace();
		const existing = workspace.withOpen(TYPE, { assetId: 'asset-chair' });
		const before = existing.state;

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-chair');

		expect(existing.state).toBe(before);
	});

	it('opens a second, independent leaf for a different asset', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE, { assetId: 'asset-chair' });

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-table');

		expect(workspace.leaves).toHaveLength(2);
		expect(workspace.leaves[1].state?.state).toEqual({ assetId: 'asset-table' });
	});

	it('ignores a leaf of the same type whose state names no asset', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE);

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-chair');

		expect(workspace.leaves).toHaveLength(2);
	});

	it('ignores a leaf whose asset id is not a string', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE, { assetId: 7 });

		await revealAssetDesigner(depsFor(workspace), TYPE, 'asset-chair');

		expect(workspace.leaves).toHaveLength(2);
	});
});

describe('two activations racing', () => {
	it('coalesces two opens of the SAME asset into one leaf', async () => {
		// The multiplicity premise is per ASSET, not per call: an asset already open must not
		// get a second designer. The candidate lookup cannot see a leaf being built, so two
		// opens in one tick both found nothing and both created.
		const workspace = new FakeWorkspace();

		await Promise.all([
			revealAssetDesigner(depsFor(workspace), TYPE, 'asset-1'),
			revealAssetDesigner(depsFor(workspace), TYPE, 'asset-1'),
		]);

		expect(workspace.leaves).toHaveLength(1);
	});

	it('still gives two DIFFERENT assets their own leaves when they race', async () => {
		// The over-correction the case above would hide, and the reason the key carries the
		// state rather than the type alone: coalescing on the view type would collapse the
		// very multiplicity this function exists to permit.
		const workspace = new FakeWorkspace();

		await Promise.all([
			revealAssetDesigner(depsFor(workspace), TYPE, 'asset-1'),
			revealAssetDesigner(depsFor(workspace), TYPE, 'asset-2'),
		]);

		expect(workspace.leaves).toHaveLength(2);
		expect(
			workspace.leaves.map((leaf) => leaf.state?.state?.['assetId']).toSorted(),
		).toEqual(['asset-1', 'asset-2']);
	});
});

/**
 * The same gap `revealPlanEditor.test.ts` pins for its own wrapper: a throw escaping the
 * candidate lookup used to become an unhandled rejection out of an `async` function whose
 * callers `void` it.
 */
describe('a fault from a candidate’s own view state', () => {
	it('is answered rather than rejecting', async () => {
		const exploding = {
			getLeavesOfType: () => [
				{
					getViewState: () => {
						throw new Error('state exploded');
					},
				},
			],
		};

		await expect(revealAssetDesigner(depsFor(exploding), TYPE, 'asset-chair')).resolves.toBeUndefined();

		expect(faults).toHaveLength(1);
		expect((faults[0] as Error).message).toBe('state exploded');
	});
});
