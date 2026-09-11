import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { expectOk } from '../../helpers/domain';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { assetShapeAnswer, readAssetShapes } from '../../../src/presentation/read-models/assetShapes';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { Result } from '../../../src/core/result/Result';

const shape = expectOk(shapeFromDimensions(800, 600));
const dto = (patch: Partial<AssetDesignDto>): AssetDesignDto => ({ assetId: 'asset-a', name: 'Radiator', height: null, background: null, calibration: null, shape, dimensions: { width: 800, depth: 600 }, clearanceExtent: null, dimensionsUnscaled: false, noteVersion: { revision: 1 }, geometryVersion: { revision: 1 }, ...patch } as AssetDesignDto);

describe('asset shape answers', () => {
	it('maps every design read onto what placing needs', () => {
		expect(assetShapeAnswer(ok(dto({})))).toEqual({ kind: 'placeable', name: 'Radiator', shape, dimensions: { width: 800, depth: 600 } });
		expect(assetShapeAnswer(ok(dto({ shape: null, dimensions: null })))).toEqual({ kind: 'no-shape', name: 'Radiator' });
		expect(assetShapeAnswer(ok(dto({ shape: { ...shape, footprintPending: true } })))).toEqual({ kind: 'unscaled', name: 'Radiator' });
		expect(assetShapeAnswer(err({ category: 'Reference', code: 'asset.not-found', message: '' }))).toEqual({ kind: 'missing' });
		expect(assetShapeAnswer(err({ category: 'Persistence', code: 'asset-geometry.corrupt', message: '' }))).toEqual({ kind: 'unreadable' });
	});
	it('reads each distinct id once and answers every requested id', async () => {
		const execute = vi.fn<() => Promise<Result<AssetDesignDto, AssetDesignError>>>(() => Promise.resolve(ok(dto({}))));
		const answers = await readAssetShapes({ execute }, ['asset-a', 'asset-b', 'asset-a']);
		expect(execute).toHaveBeenCalledTimes(2);
		expect([...answers.keys()]).toEqual(['asset-a', 'asset-b']);
	});
});
