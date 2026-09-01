/**
 * @vitest-environment jsdom
 *
 * The asset designer's write and read side as the COMPOSITION applies it (design slice A9):
 * the five geometry commands, the height command and the design read, composed over the
 * root's own asset repository, the root's own asset geometry sidecar and the root's own
 * event bus — and each of the seven guarded under its own boundary event.
 *
 * The same shape as `slice10CascadeWiring.test.ts`, `sequenceNoticeWiring.test.ts` and
 * `libraryOverlapWiring.test.ts`, and it exists for their reason: a composition that passes
 * the wrong collaborator COMPILES, passes every other test here, and says nothing. `events`
 * being a required member is only half a check — a root handing these commands a fresh
 * `createEventBus()` type-checks perfectly and announces into an object nothing subscribed
 * to, so the subscriber below sits on `root.eventBus` rather than on a bus this file made.
 *
 * Two things it deliberately does NOT reach, said rather than left to be assumed:
 *
 * - **A second `AssetGeometryStore` over the same folder is invisible to every case here.**
 *   What is asserted is the FOLDER (a store built on the wrong one writes somewhere else, and
 *   the sidecar case reddens) and that the query reads what the commands wrote. The store's
 *   `KeyedQueues` is per instance, so two stores would split the per-asset lock an asset
 *   DELETE and a design write share — a race no assertion here can produce on demand.
 * - **The boundary's own EVENT NAMES are the half `tests/plugin/guardCategory.test.ts`
 *   cannot say.** That file drives every door the walk finds and requires the mapped refusal;
 *   it says nothing about which event a log line carries, which is what makes a fault
 *   attributable to a door rather than to a slice. Hence the last case here, which is
 *   `guardWiring.test.ts`'s shape one slice later.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { createRepositoryStack, type RepositoryStack } from '../helpers/vault';
import { installObsidianDom } from '../helpers/dom';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { expectOk } from '../helpers/domain';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../src/domain/asset/Asset.events';
import type { PersistenceServices } from '../../src/plugin/composition-root';

installObsidianDom();

/**
 * A composed root over a fake vault, plus one asset created THROUGH it — the root's own
 * guarded `createAsset`, so the note lands in the root's own library folder and the root's
 * own index knows where it is. Writing it through the stack's repositories instead would
 * populate a different index and prove nothing about this composition.
 */
async function rootWithAnAsset(): Promise<{
	stack: RepositoryStack;
	persistence: PersistenceServices;
	heard: AssetId[];
	assetId: AssetId;
}> {
	const stack = createRepositoryStack();
	const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
	const persistence = root.persistence;
	if (persistence === null) throw new Error('expected a composed persistence stack');

	const heard: AssetId[] = [];
	root.eventBus.subscribe('AssetDesignChanged', (event) => {
		heard.push((event as AssetDesignChanged).payload.assetId);
	});

	const asset = expectOk(
		await persistence.createAsset.execute({
			name: 'Kitchen island',
			category: 'fixture',
			unit: 'piece',
			unitCostAmount: '450.00',
			currency: 'EUR',
		}),
	);
	return { stack, persistence, heard, assetId: asset.id };
}

describe('the asset designer the composition root hands out', () => {
	it('announces a shape write on the root event bus', async () => {
		const { persistence, heard, assetId } = await rootWithAnAsset();

		const written = await persistence.assetDesign.setFootprintFromDimensions.execute({
			assetId,
			width: 1200,
			depth: 800,
		});

		expect(expectOk(written)).toBe('wrote');
		expect(heard).toEqual([assetId]);
	});

	/**
	 * The sidecar lands under the CONFIGURED library folder, which is the collaborator the
	 * commands cannot derive and the composition alone supplies — ADR-0014 puts an asset's
	 * geometry in the library's own `Geometry/`, a sibling of `Assets/`.
	 */
	it('writes the sidecar under the configured library folder', async () => {
		const { stack, persistence, assetId } = await rootWithAnAsset();

		expectOk(
			await persistence.assetDesign.setFootprintFromDimensions.execute({
				assetId,
				width: 1200,
				depth: 800,
			}),
		);

		const path = `${DEFAULT_SETTINGS.libraryFolder}/Geometry/${assetId}.rpgeo`;
		const written = stack.vault.entries.get(path);
		expect(written).toBeDefined();
		expect(JSON.parse(written ?? '{}')).toMatchObject({
			assetId,
			shape: { footprintOrigin: 'typed', footprintPending: false },
		});
	});

	/**
	 * The read side joins the two resources the write side split, and reports a version for
	 * EACH — which is what tells a composition holding two ports from one holding the same
	 * port twice. The revisions differ by construction here: the note has been written twice
	 * (the create, then the height) and the sidecar once.
	 */
	it('reads back the design the commands wrote, with each port\'s own version', async () => {
		const { persistence, assetId } = await rootWithAnAsset();

		expectOk(await persistence.assetDesign.setHeight.execute({ assetId, height: 900 }));
		expectOk(
			await persistence.assetDesign.setFootprintFromDimensions.execute({
				assetId,
				width: 1200,
				depth: 800,
			}),
		);

		const design = expectOk(await persistence.assetDesign.get.execute(assetId));

		expect(design.name).toBe('Kitchen island');
		expect(design.height).toBe(900);
		expect(design.dimensions).toEqual({ width: 1200, depth: 800 });
		expect(design.dimensionsUnscaled).toBe(false);
		expect(design.noteVersion.revision).toBe(2);
		expect(design.geometryVersion.revision).toBe(1);
	});

	/**
	 * Every door of the bundle, under its OWN event name. The asset repository is what all
	 * seven read first, so detonating it faults each of them below the boundary — and a door
	 * composed raw REJECTS rather than resolving, which is what makes this a check on the
	 * composition rather than on `guardCommand`.
	 */
	it('answers a mapped refusal at every door, each under its own boundary event', async () => {
		const { persistence, assetId } = await rootWithAnAsset();
		resetRecorder();
		Object.defineProperty(persistence.assets, 'getById', {
			configurable: true,
			value: () => {
				throw new Error('the vault exploded');
			},
		});
		const design = persistence.assetDesign;

		const results = [
			await design.setFootprint.execute({ assetId, points: [] }),
			await design.setFootprintFromDimensions.execute({ assetId, width: 1200, depth: 800 }),
			await design.setClearance.execute({ assetId, points: null }),
			await design.setAnchor.execute({ assetId, anchor: { x: 0, y: 0 } }),
			await design.setFacing.execute({ assetId, facing: 0 }),
			await design.setHeight.execute({ assetId, height: 900 }),
			await design.get.execute(assetId),
		];

		expect(results.map((result) => result.ok)).toEqual([false, false, false, false, false, false, false]);
		expect(results.map((result) => (result.ok ? null : result.error.code))).toEqual(
			Array.from({ length: 7 }, () => 'vault.unexpected-failure'),
		);
		expect(lines.map((line) => line.event)).toEqual([
			'command.setAssetFootprint.failed',
			'command.setAssetFootprintFromDimensions.failed',
			'command.setAssetClearance.failed',
			'command.setAssetAnchor.failed',
			'command.setAssetFacing.failed',
			'command.setAssetHeight.failed',
			'query.getAssetDesign.failed',
		]);
	});

	/**
	 * **The SECOND door of each design command, which is the one the undo stack dispatches.**
	 * `ReversibleAssetDesignCommands` takes `executeWithVersion` — it must, because
	 * rediscovering the written version with a read-back is a window a peer can land in — so
	 * guarding `execute` alone would have wrapped the door nobody uses, which is the defect
	 * this repository has already shipped once at the Inspector's override adapters.
	 *
	 * `tests/plugin/guardCategory.test.ts` already refuses a raw door as a CATEGORY, and this
	 * case is the complement rather than a duplicate: it pins each door's own EVENT NAME, so a
	 * pair sharing one name — which leaves "which entry point faulted" unanswerable from a log
	 * line, the whole reason `guardBothDoors` guards separately — fails here.
	 */
	it('guards the versioned door of every design command under its own event name', async () => {
		const { persistence, assetId } = await rootWithAnAsset();
		resetRecorder();
		Object.defineProperty(persistence.assets, 'getById', {
			configurable: true,
			value: () => {
				throw new Error('the vault exploded');
			},
		});
		const design = persistence.assetDesign;

		const results = [
			await design.setFootprint.executeWithVersion({ assetId, points: [] }),
			await design.setFootprintFromDimensions.executeWithVersion({ assetId, width: 1200, depth: 800 }),
			await design.setClearance.executeWithVersion({ assetId, points: null }),
			await design.setAnchor.executeWithVersion({ assetId, anchor: { x: 0, y: 0 } }),
			await design.setFacing.executeWithVersion({ assetId, facing: 0 }),
			await design.setHeight.executeWithVersion({ assetId, height: 900 }),
		];

		expect(results.map((result) => (result.ok ? null : result.error.code))).toEqual(
			Array.from({ length: 6 }, () => 'vault.unexpected-failure'),
		);
		expect(lines.map((line) => line.event)).toEqual([
			'command.setAssetFootprint.with-version.failed',
			'command.setAssetFootprintFromDimensions.with-version.failed',
			'command.setAssetClearance.with-version.failed',
			'command.setAssetAnchor.with-version.failed',
			'command.setAssetFacing.with-version.failed',
			'command.setAssetHeight.with-version.failed',
		]);
	});
});
