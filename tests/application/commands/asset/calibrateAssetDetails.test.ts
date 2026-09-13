/**
 * Decision 5 of the symbols spec: a detail is its own coordinate group with its own pending flag,
 * rescaled by exactly the calibration that converts it and by no other.
 */
import { describe, expect, it } from 'vitest';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import type { Point } from '../../../../src/core/geometry/Point';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetDetail } from '../../../../src/domain/asset/AssetDetail';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { nonFiniteRescaleError } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const DOUBLING = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 } as const;
const TRIANGLE: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

const detail = (id: string, pending: boolean, points: readonly Point[], bulges?: readonly number[]): AssetDetail => ({
	id, name: id, line: 'solid', pending, outline: bulges === undefined ? { points } : { points, bulges },
});

async function seeded(details: readonly AssetDetail[]) {
	const stack = createRepositoryStack();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const assetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	expectOk(await sidecar.write(assetId, { calibration: null, shape: { ...expectOk(shapeFromDimensions(100, 60)), details } }));
	return {
		assetId,
		calibrate: new CalibrateAssetCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() }),
		async storedDetails(): Promise<readonly AssetDetail[]> {
			return expectOk(await sidecar.read(assetId)).document.shape?.details ?? [];
		},
	};
}

describe('what a calibration does to details', () => {
	it('rescales a pending detail, keeps its curves and clears its flag', async () => {
		const h = await seeded([detail('traced', true, TRIANGLE, [0.5, 0, 0])]);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const [converted] = await h.storedDetails();
		expect(converted.outline.points).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]);
		expect(converted.outline.bulges).toEqual([0.5, 0, 0]);
		expect(converted.pending).toBe(false);
	});

	it('leaves a measured detail exactly where it is', async () => {
		const h = await seeded([detail('measured', false, TRIANGLE)]);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		expect((await h.storedDetails())[0].outline.points).toEqual(TRIANGLE);
	});

	it('refuses a rescale whose product with a detail coordinate is not finite', async () => {
		const huge = [{ x: 1e308, y: 0 }, { x: 1.5e308, y: 0 }, { x: 1.5e308, y: 1 }];
		const h = await seeded([detail('huge', true, huge)]);

		expect(expectErr(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING })).code).toBe(nonFiniteRescaleError().code);
	});
});
