/**
 * Schema version 2 (symbols spec, Decision 6): bulges and details cross the storage boundary, a v1
 * file still reads, and every write is v4 — the header said v2 and the assertions below have said `toBe(4)` since the DTO began raising to 4 — which is what makes a v1-only build refuse the file
 * rather than silently dropping its details on its next write.
 */
import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { validateAssetShape, shapeFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { openGraphic } from '../../../helpers/assetShapes';
import { updateDetail } from '../../../../src/domain/asset/detailEdits';

const seeded = () => {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	return {
		stack,
		assetId,
		path: assetSidecarPathFor(stack.libraryFolder, assetId),
		sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry),
	};
};

const RAW_SHAPE = {
	footprint: { points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] },
	footprintOrigin: 'typed',
	footprintPending: false,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
};

const rawDocument = (assetId: string, overrides: Record<string, unknown> = {}): string =>
	JSON.stringify({ schemaVersion: 1, assetId, revision: 3, unit: 'mm', calibration: null, shape: RAW_SHAPE, ...overrides });

const QUARTER = Math.tan(Math.PI / 8);
const circle = (radius: number): CurvedPolygon => ({
	points: [{ x: 0, y: -radius }, { x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }],
	bulges: [QUARTER, QUARTER, QUARTER, QUARTER],
});
const square = (half: number): CurvedPolygon => ({
	points: [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }],
});
const symbol = (): AssetShape => ({
	...expectOk(shapeFromDimensions(900, 900)),
	footprint: circle(450),
	// `kind` spelled out because this fixture is compared against what comes BACK: a shape that has
	// been through `validateAssetShape` always carries the discriminant, whether or not the document
	// it was read from did (AD04 §5 — absent means closed, and the validator stamps it).
	details: [
		{ id: 'detail-1', kind: 'closed', name: 'top', outline: circle(400), line: 'solid', pending: false },
		{ id: 'detail-2', kind: 'closed', name: 'overhead', outline: square(200), line: 'dashed', pending: true },
	],
	groups: [],
});

describe('asset geometry sidecar, schema version 2', () => {
	it('round-trips a curved footprint and its details', async () => {
		const { sidecar, assetId } = seeded();
		const document: AssetGeometryDocument = { calibration: null, shape: symbol() };

		expectOk(await sidecar.write(assetId, document));

		expect(expectOk(await sidecar.read(assetId)).document).toEqual(document);
	});

	it('reads a version 1 file as a shape with no details, and writes version 4 back', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(path, rawDocument(assetId));

		const read = expectOk(await sidecar.read(assetId));
		expect(read.document.shape?.details).toEqual([]);
		expectOk(await sidecar.write(assetId, read.document, read.version));

		expect(JSON.parse(stack.vault.entries.get(path) ?? '{}').schemaVersion).toBe(4);
	});

	it('writes a straight outline with no bulges key', async () => {
		const { sidecar, stack, assetId, path } = seeded();

		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));

		const stored = JSON.parse(stack.vault.entries.get(path) ?? '{}');
		expect(stored.shape.footprint).toEqual({ points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] });
		expect(stored.shape.details).toEqual([]);
	});

	it('refuses a version 2 outline whose bulge count does not match its edges', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		const shape = { ...RAW_SHAPE, footprint: { ...RAW_SHAPE.footprint, bulges: [0.5] }, details: [] };
		stack.vault.entries.set(path, rawDocument(assetId, { schemaVersion: 2, shape }));

		expect(expectErr(await sidecar.read(assetId))).toMatchObject({ category: 'Validation', code: 'asset-geometry.schema-invalid' });
	});
});

/**
 * AD04's own fields across the storage boundary: an OPEN graphic, a user label on it and on a
 * group, and the group itself. Every one of them is a mapper arm that no other case reaches — and
 * the round trip is the only instrument that can say a field survives BOTH directions, since a
 * write that drops it and a read that invents it look identical from either side alone.
 */
describe('schema version 3 fields', () => {
	it('round-trips an open graphic, its label and its group', async () => {
		const { sidecar, assetId, stack, path } = seeded();
		const base = symbol();
		const shape = expectOk(
			validateAssetShape({
				...base,
				details: [...base.details, openGraphic('detail-3', [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }])],
				groups: [{ id: 'group-1', label: 'Front', members: ['detail-1', 'detail-3'] }],
			}),
		);

		expectOk(await sidecar.write(assetId, { calibration: null, shape }));
		const read = expectOk(await sidecar.read(assetId));

		expect(read.document.shape).toEqual(shape);
		const stored = JSON.parse(stack.vault.entries.get(path) ?? '{}');
		expect(stored.schemaVersion).toBe(4);
		expect(stored.shape.details[2]).toMatchObject({ kind: 'open' });
		expect(stored.shape.groups).toEqual([{ id: 'group-1', label: 'Front', members: ['detail-1', 'detail-3'] }]);
	});

	/** A graphic's own label, which rides on the detail rather than on the group. */
	it('round-trips a label on a graphic', async () => {
		const { sidecar, assetId } = seeded();
		const base = symbol();
		const shape = expectOk(validateAssetShape({ ...base, details: [{ ...base.details[0], label: 'Lid' }, base.details[1]] }));

		expectOk(await sidecar.write(assetId, { calibration: null, shape }));

		expect(expectOk(await sidecar.read(assetId)).document.shape?.details[0]).toMatchObject({ name: 'top', label: 'Lid' });
	});

	/**
	 * AD09's acceptance criterion 2, end to end through the edit the Parts panel actually dispatches:
	 * a rename SURVIVES the file, and the preset's semantic identifier is what it was.
	 *
	 * The case above round-trips a label a fixture built; this one round-trips one `updateDetail`
	 * wrote, which is the only version that can catch a rename door writing the wrong field. Clearing
	 * it is asserted in the same case because removal is the half a mapper is most likely to turn into
	 * a stored empty string.
	 */
	it('round-trips a rename made through updateDetail, and its removal, leaving the semantic name alone', async () => {
		const { sidecar, assetId } = seeded();
		const renamed = expectOk(updateDetail(symbol(), 'detail-1', { label: 'Lid' }));

		expectOk(await sidecar.write(assetId, { calibration: null, shape: renamed }));
		const afterRename = expectOk(await sidecar.read(assetId)).document.shape;
		expect(afterRename?.details[0]).toMatchObject({ name: 'top', label: 'Lid' });

		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(updateDetail(afterRename as AssetShape, 'detail-1', { label: '' })) }));
		const afterClearing = expectOk(await sidecar.read(assetId)).document.shape;
		expect(afterClearing?.details[0]).not.toHaveProperty('label');
		expect(afterClearing?.details[0].name).toBe('top');
	});
});
