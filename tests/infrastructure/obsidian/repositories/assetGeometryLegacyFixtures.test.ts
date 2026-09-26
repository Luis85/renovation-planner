/**
 * Every legacy asset-geometry version `raiseLegacyVersions` raises, read as BYTES that were
 * checked in rather than as an object literal built by the test that reads it.
 *
 * **Why a file and not a literal**, which is AD15 row F08's whole point: a literal is
 * constructed by the same process that consumes it, so it can never disagree with the reader
 * about JSON's own surface — a number that survives `JSON.stringify` but not `JSON.parse`, a
 * key order, an escape, a line ending, an encoding. `dto/assetGeometry.test.ts` drives the
 * schema hard and drives it entirely on literals; these cases drive the same schema through
 * `AssetGeometryStore.read`'s real `vault.read` → `JSON.parse` → `AssetGeometrySchema` →
 * `validateAssetShape` chain, over a real filesystem.
 *
 * **It is also a lock on the FILES.** A fixture nothing loads is the instrument that reaches
 * nothing and looks exactly like a clean result, and this port's absent-sidecar answer is a
 * SUCCESS (`{ calibration: null, shape: null }` at revision 0) rather than a refusal — so a
 * deleted or renamed fixture would not turn a read red on its own. Two things are asserted at
 * every case for that reason: the version the file still DECLARES on disk, and the revision and
 * shape that only a present, parsed, validated document can produce.
 *
 * Deliberately NOT here: what a v4 file does, which is the round trip
 * `assetGeometrySidecar.test.ts` and `assetGeometrySidecarDetails.test.ts` already own, and
 * anything about writing — these fixtures are read-only input and the clone is discarded.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';
import { expectOk } from '../../../helpers/domain';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometrySnapshot } from '../../../../src/application/ports/AssetGeometrySidecar';

describe('legacy asset geometry sidecars, read off the checked-in bytes', () => {
	let open: FixtureStack | undefined;

	afterEach(() => {
		open?.dispose();
		open = undefined;
	});

	/**
	 * Opens the fixture vault, asserts the file still SAYS it is `declared`, and answers what the
	 * port read back. The declared-version check reads the clone rather than `tests/vault/...`
	 * directly, so it is the same bytes the port was handed and not a second path spelling that
	 * could drift from it.
	 */
	const readLegacy = async (assetId: string, declared: number): Promise<AssetGeometrySnapshot> => {
		open = await openFixtureVault('legacy-schema');
		// The checked-in path, spelled rather than derived: `FixtureStack` does not declare the
		// `libraryFolder` its factory returns, and this is a fact about where the fixture SITS
		// rather than about where the store would look. The two are asserted against each other
		// anyway — a library root the store no longer resolves to leaves it reading no file, and
		// the revision below is what catches that.
		const raw: unknown = JSON.parse(readFileSync(join(open.root, 'Library', 'Geometry', `${assetId}.rpgeo`), 'utf8'));
		expect((raw as { schemaVersion: number }).schemaVersion).toBe(declared);

		const sidecar = new ObsidianAssetGeometrySidecar(open.assetGeometry);
		return expectOk(await sidecar.read(assetId as AssetId));
	};

	/**
	 * Version 1 — and the file omits all three pending keys, which is what a build predating them
	 * wrote and what no other checked-in sidecar expresses (`valid-project`'s `asset-designed`
	 * spells them out). `.default(false)` is therefore exercised off disk rather than only over a
	 * literal that deleted the key on purpose.
	 *
	 * `-594.005` carries three decimals, which is the figure CLAUDE.md names as the one that
	 * catches a coercion (`594.005` is not representable in binary floating point while `99.99`
	 * survives one). `dto/assetGeometry.test.ts` makes that claim over a literal, on a positive
	 * `anchor.x`; here it is made about a real `JSON.parse`, which is the half a literal cannot
	 * make at all.
	 */
	it('raises a version 1 file to a shape with no details, no groups and no review flag', async () => {
		const snapshot = await readLegacy('asset-legacy-v1', 1);

		expect(snapshot.version.revision).toBe(4);
		expect(snapshot.document).toEqual({
			calibration: null,
			shape: {
				footprint: { points: [{ x: -594.005, y: -400 }, { x: 600, y: -400 }, { x: 600, y: 400 }, { x: -594.005, y: 400 }] },
				// The only checked-in sidecar carrying `traced` — `valid-project`'s is `typed` —
				// and load-bearing only because this line asserts it.
				footprintOrigin: 'traced',
				footprintPending: false,
				clearancePending: false,
				anchorPending: false,
				clearanceNeedsReview: false,
				clearance: null,
				anchor: { x: 0, y: 0 },
				facing: 0,
				details: [],
				groups: [],
			},
		});
	});

	/**
	 * Version 2 — curves and details cross the boundary, and neither `kind` nor `pending` is in
	 * the file: v2 could not express the first and defaulted the second, so both come back
	 * stamped by the read rather than by the document (AD04 §5, absent means closed).
	 */
	it('raises a version 2 file, defaulting each graphic to closed and keeping its curves', async () => {
		const snapshot = await readLegacy('asset-legacy-v2', 2);

		expect(snapshot.version.revision).toBe(7);
		expect(snapshot.document).toEqual({
			calibration: null,
			shape: {
				footprint: {
					points: [{ x: -300, y: -250 }, { x: 300, y: -250 }, { x: 300, y: 250 }, { x: -300, y: 250 }],
					bulges: [0.5, 0, 0, 0],
				},
				footprintOrigin: 'typed',
				footprintPending: false,
				clearancePending: false,
				anchorPending: false,
				clearanceNeedsReview: false,
				clearance: null,
				// An anchor OFF the origin and a facing of three quarter turns, so a mapper that
				// dropped either — or normalised the angle — cannot pass by landing on zero.
				anchor: { x: 0, y: -250 },
				facing: 4.71238898038469,
				details: [{
					id: 'detail-hob',
					kind: 'closed',
					name: 'hob',
					outline: { points: [{ x: -200, y: -150 }, { x: 200, y: -150 }, { x: 200, y: 150 }, { x: -200, y: 150 }] },
					line: 'dashed',
					pending: false,
				}],
				groups: [],
			},
		});
	});

	/**
	 * Version 3 — an open graphic with one bulge per SEGMENT, a labelled group over both
	 * graphics, and a CLEARANCE with no `clearanceNeedsReview` key beside it. That last pairing is
	 * the whole of v4's argument met at a real file: a boundary drawn before the flag existed
	 * reads as not flagged, because a build that could not set it never left one unset by mistake.
	 */
	it('raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged', async () => {
		const snapshot = await readLegacy('asset-legacy-v3', 3);

		expect(snapshot.version.revision).toBe(11);
		expect(snapshot.document).toEqual({
			calibration: null,
			shape: {
				footprint: { points: [{ x: -400, y: -300 }, { x: 400, y: -300 }, { x: 400, y: 300 }, { x: -400, y: 300 }] },
				footprintOrigin: 'typed',
				footprintPending: false,
				clearancePending: false,
				anchorPending: false,
				clearanceNeedsReview: false,
				clearance: { points: [{ x: -400, y: -300 }, { x: 400, y: -300 }, { x: 400, y: 900 }, { x: -400, y: 900 }] },
				anchor: { x: 0, y: 0 },
				facing: 1.5707963267948966,
				details: [
					{
						id: 'detail-door',
						kind: 'open',
						name: 'door',
						label: 'Door swing',
						outline: { points: [{ x: -400, y: 300 }, { x: -400, y: 900 }], bulges: [0.4142135623730951] },
						line: 'dashed',
						pending: false,
					},
					{
						id: 'detail-panel',
						kind: 'closed',
						name: 'panel',
						outline: { points: [{ x: -200, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 100 }, { x: -200, y: 100 }] },
						line: 'solid',
						pending: false,
					},
				],
				groups: [{ id: 'group-front', label: 'Front', members: ['detail-door', 'detail-panel'] }],
			},
		});
	});
});
