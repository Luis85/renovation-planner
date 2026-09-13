/**
 * `measured: true` (2026-09-13 item modes spec §B): an outline copied off a plan is already in
 * millimetres, so it is stored typed and never awaits a scale. Without the flag the same first
 * outline on an uncalibrated asset is pending, and the Plan editor refuses to place it as
 * `unscaled`, which is the whole reason the flag exists.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetFootprintCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { createEventBus } from '../../../../src/core/events/EventBus';
import type { Point } from '../../../../src/core/geometry/Point';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const OUTLINE: readonly Point[] = [{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }];

async function freshAsset() {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	const command = new SetAssetFootprintCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() });
	return { assetId, command, stored: async () => expectOk(await sidecar.read(assetId)).document.shape };
}

describe('SetAssetFootprint, measured', () => {
	it('stores a first outline on an uncalibrated asset as typed millimetres, not awaiting a scale', async () => {
		const { assetId, command, stored } = await freshAsset();

		expect(expectOk(await command.execute({ assetId, points: OUTLINE, measured: true }))).toBe('wrote');

		expect(await stored()).toMatchObject({ footprint: { points: OUTLINE }, footprintOrigin: 'typed', footprintPending: false });
	});

	it('still records the same outline as a pending trace without the flag', async () => {
		const { assetId, command, stored } = await freshAsset();

		await command.execute({ assetId, points: OUTLINE });

		expect(await stored()).toMatchObject({ footprintOrigin: 'traced', footprintPending: true });
	});
});
