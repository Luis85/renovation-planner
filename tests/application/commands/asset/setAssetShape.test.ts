import { describe, expect, it } from 'vitest';
import { SetAssetShapeCommand } from '../../../../src/application/commands/asset/SetAssetShape';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { shapeFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/** Spec 2026-09-13 Decision 7: presets and every part edit write through this one command. */
const CALIBRATION = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 100, pixelsPerWorldUnit: 1 };

async function seeded() {
	const stack = createRepositoryStack();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const assetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	return {
		sidecar,
		assetId,
		command: new SetAssetShapeCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() }),
		read: async () => expectOk(await sidecar.read(assetId)),
	};
}

const symbol = (): AssetShape => ({
	...expectOk(shapeFromDimensions(400, 700)),
	details: [{ id: 'detail-1', name: 'tank', line: 'solid', pending: false, outline: { points: [{ x: -200, y: -350 }, { x: 200, y: -350 }, { x: 200, y: -150 }, { x: -200, y: -150 }] } }],
});

describe('SetAssetShapeCommand', () => {
	it('replaces the whole shape and keeps the calibration beside it', async () => {
		const h = await seeded();
		expectOk(await h.sidecar.write(h.assetId, { calibration: CALIBRATION, shape: expectOk(shapeFromDimensions(1200, 800)) }));

		expect(expectOk(await h.command.execute({ assetId: h.assetId, shape: symbol() }))).toBe('wrote');

		const { document } = await h.read();
		expect(document.shape?.details.map((detail) => detail.name)).toEqual(['tank']);
		expect(document.shape?.footprint.points[1]).toEqual({ x: 200, y: -350 });
		expect(document.calibration).toEqual(CALIBRATION);
	});

	it('refuses a shape the domain refuses, and writes nothing', async () => {
		const h = await seeded();
		const collinear = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] };
		// `kind` spelled out because the spread is over the `AssetDetail` UNION: without it the literal
		// is assignable to neither arm, and the case means the closed one.
		const degenerate = { ...symbol(), details: [{ ...symbol().details[0], kind: 'closed' as const, outline: collinear }] };

		expect(expectErr(await h.command.execute({ assetId: h.assetId, shape: degenerate })).code).toBe('asset.degenerate-detail');
		expect((await h.read()).version.revision).toBe(0);
	});

	it('refuses an asset that does not exist', async () => {
		const h = await seeded();

		expect(expectErr(await h.command.execute({ assetId: createAssetId(), shape: symbol() })).code).toBe('asset.not-found');
	});
});
