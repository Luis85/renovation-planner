/**
 * `AssetGeometryStore` and the port face over it (ADR-0014).
 *
 * Driven through `ObsidianAssetGeometrySidecar` rather than through the store, because the
 * port is what every caller above `infrastructure/` will hold and the raising of storage
 * tuples to `Point`s is half of what these cases are about. Where a rule belongs to the
 * store alone — that a write creates `Geometry/` before it creates a file in it — the
 * assertion is on what the VAULT was asked to do, which is the only place that rule is
 * visible from here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { createAssetId, type AssetId } from '../../../../src/domain/asset/AssetId';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { makeAsset } from '../../../helpers/entities';
import { libraryGeometryIn } from '../../../../src/plugin/settings/libraryMigration';

const rectangle = (): AssetShape => expectOk(shapeFromDimensions(1200, 800));

const seeded = () => {
	const stack: RepositoryStack = createRepositoryStack();
	const assetId = createAssetId();
	return {
		stack,
		assetId,
		path: assetSidecarPathFor(stack.libraryFolder, assetId),
		sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry),
	};
};

/** The bytes a hand edit would leave: everything the schema wants, with one field to spoil. */
const rawDocument = (assetId: string, overrides: Record<string, unknown> = {}): string =>
	JSON.stringify({
		schemaVersion: 1,
		assetId,
		revision: 3,
		unit: 'mm',
		calibration: null,
		shape: {
			footprint: { points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] },
			footprintOrigin: 'typed',
			footprintPending: false,
			clearancePending: false,
			anchorPending: false,
			clearance: null,
			anchor: { x: 0, y: 0 },
			facing: 0,
		},
		...overrides,
	});

describe('ObsidianAssetGeometrySidecar', () => {
	it('reads an asset with no sidecar as a shapeless design rather than as a failure', async () => {
		const { sidecar, assetId } = seeded();

		const snapshot = expectOk(await sidecar.read(assetId));

		expect(snapshot.document).toEqual({ calibration: null, shape: null });
		expect(snapshot.version.revision).toBe(0);
	});

	it('creates the library Geometry folder before the file in it', async () => {
		const { sidecar, stack, assetId, path } = seeded();

		expectOk(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));

		// `FakeVault.create` refuses a path whose parent does not exist, exactly as Obsidian
		// does — the fake that caught this same missing `ensureFolder` for plan sidecars. So
		// the write above having SUCCEEDED is already most of the proof; the ordering
		// assertion is what tells a build that creates the folder from a build that happens
		// to run after some other writer made it.
		expect(stack.vault.operations).toContain(`createFolder:${stack.libraryFolder}/Geometry`);
		expect(stack.vault.operations.indexOf(`createFolder:${stack.libraryFolder}/Geometry`))
			.toBeLessThan(stack.vault.operations.indexOf(`create:${path}`));
	});

	it('round-trips a typed rectangle, provenance included', async () => {
		const { sidecar, assetId } = seeded();
		const document: AssetGeometryDocument = { calibration: null, shape: rectangle() };

		const written = expectOk(await sidecar.write(assetId, document));
		const read = expectOk(await sidecar.read(assetId));

		expect(written.revision).toBe(1);
		expect(read.version.revision).toBe(1);
		expect(read.document.shape?.footprintOrigin).toBe('typed');
		// Raised back to `Point`s, never the `[x, y]` tuples the file holds.
		expect(read.document.shape?.footprint.points[0]).toEqual({ x: -600, y: -400 });
		expect(read.document).toEqual(document);
	});

	/**
	 * A SECOND write is a modify, not a create, and it is the only place the store chooses
	 * between the two — `writeText` asks the vault what is there rather than trusting what
	 * the caller read. Without a case for it the modify arm never runs at all: every other
	 * write here is either the first one for its asset or a refusal that returns before the
	 * file is touched.
	 */
	it('modifies the file a second write finds, rather than creating a second one', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		expectOk(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));

		const second = expectOk(await sidecar.write(assetId, { calibration: null, shape: null }));

		expect(second.revision).toBe(2);
		expect(stack.vault.operations.filter((op) => op.startsWith('create:'))).toEqual([`create:${path}`]);
		expect(stack.vault.operations).toContain(`modify:${path}`);
		expect(expectOk(await sidecar.read(assetId)).document.shape).toBeNull();
	});

	/**
	 * The document is written and read WHOLE (SDD §40), which is why the port is
	 * document-grained rather than per-attribute: a recalibration rewrites the calibration
	 * and every rescaled coordinate the shape holds in ONE file operation. This is the case
	 * that carries a calibration and a clearance at once, so both of the adapter's nullable
	 * fields are exercised through their PRESENT arm rather than only through `null`.
	 */
	it('round-trips a calibration and a clearance together', async () => {
		const { sidecar, assetId } = seeded();
		const base = rectangle();
		const document: AssetGeometryDocument = {
			calibration: {
				pointA: { x: 0, y: 0 },
				pointB: { x: 800, y: 0 },
				knownDistance: 1200,
				pixelsPerWorldUnit: 0.75,
			},
			shape: {
				...base,
				clearance: {
					points: [
						{ x: -700, y: -500 },
						{ x: 700, y: -500 },
						{ x: 700, y: 500 },
						{ x: -700, y: 500 },
					],
				},
			},
		};

		expectOk(await sidecar.write(assetId, document));

		expect(expectOk(await sidecar.read(assetId)).document).toEqual(document);
	});

	/**
	 * A vault write that fails is a REFUSAL, never a resolved success — the save indicator
	 * infers nothing from `ok`, so a store that swallowed this would badge "Saved" over a
	 * file that was never written.
	 */
	it('refuses when the vault write fails', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.failures.add(`create:${path}`);

		const error = expectErr(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));

		expect(error).toMatchObject({ category: 'Persistence', code: 'asset-geometry.write-failed' });
	});

	/**
	 * A vault read that FAULTS is mapped into a resolved refusal at this boundary rather
	 * than thrown — the store is below the Error Boundary's guards, and a rejection from
	 * here reaches a caller that declares a `Result` and has no catch.
	 */
	it('refuses when the sidecar cannot be read', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		expectOk(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));
		stack.vault.failures.add(`read:${path}`);

		expect(expectErr(await sidecar.read(assetId))).toMatchObject({
			category: 'Persistence',
			code: 'asset-geometry.unreadable',
		});
	});

	/**
	 * A write reads first — inside the lock, which is what makes the conditional write a
	 * compare-and-swap — so a sidecar this build cannot READ is one it will not overwrite
	 * either. That is the safe direction and it is deliberate: the file is a hand edit or a
	 * newer build's, and replacing it wholesale would destroy whatever it says while
	 * reporting success.
	 */
	it('refuses to overwrite a sidecar it cannot read', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(path, '{ not json');
		const bytes = stack.vault.entries.get(path);

		const error = expectErr(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));

		expect(error).toMatchObject({ category: 'Persistence', code: 'asset-geometry.corrupt' });
		expect(stack.vault.entries.get(path)).toBe(bytes);
	});

	it('refuses a stale expectation and leaves the bytes on disk untouched', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		const stale = expectOk(await sidecar.read(assetId)).version;
		expectOk(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));
		const bytes = stack.vault.entries.get(path);

		const error = expectErr(
			await sidecar.write(assetId, { calibration: null, shape: null }, stale),
		);

		expect(error).toMatchObject({ category: 'Validation', code: 'asset-geometry.revision-conflict' });
		// The error alone is equally true of a build that wrote and then reported: the file
		// is what says nothing was written.
		expect(stack.vault.entries.get(path)).toBe(bytes);
	});

	it('refuses a sidecar whose unit is not mm rather than reinterpreting it (ADR-009)', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(path, rawDocument(assetId, { unit: 'cm' }));

		expect(expectErr(await sidecar.read(assetId)).code).toBe('asset-geometry.schema-invalid');
	});

	/**
	 * Step 4a's refusal, at the READ. `Polygon` is deliberately unvalidated at the type
	 * level so a tool can hold a mid-gesture buffer, so without this a hand-edited sidecar
	 * would cross into `AssetShape` having never passed `createPolygon`, while every command
	 * above assumes it did. A refusal and not a repair: reading a corrupt file as an empty
	 * design presents it as an asset nobody has drawn yet.
	 */
	/**
	 * The CALIBRATION half of the rule the docblock above `shapeFromPersistence` states in
	 * full — "a sidecar is a file a user can open and edit, so this is where that assumption
	 * is made true rather than merely relied on" — which was applied to the shape and not to
	 * the calibration beside it. A rule stated in a docblock and not followed by the door it
	 * is written above.
	 *
	 * `pointA` and `pointB` coincide here while every scalar is positive, so the Zod schema
	 * sees four well-typed numbers and nothing wrong. The plan sidecar has no equivalent hole
	 * because its calibration is validated one layer up, at `Plan.withCalibration`; an asset
	 * geometry document is handed to a command with no entity assembly in between, so this
	 * read is the only door there is.
	 *
	 * Why it is not cosmetic: `setFootprint` decides `footprintPending` from
	 * `document.calibration !== null`. A degenerate calibration is non-null, so a fresh trace
	 * over it would be recorded as ALREADY SCALED while no usable scale exists — silently
	 * mislabelling provenance in the field family that took four review rounds to settle.
	 *
	 * A REFUSAL and never a repair, for the reason the shape half gives: nulling a corrupt
	 * calibration would present a damaged file as a plan nobody has calibrated.
	 */
	it('refuses a calibration the schema accepts and the domain does not', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(
			path,
			rawDocument(assetId, {
				calibration: {
					pointA: { x: 100, y: 100 },
					pointB: { x: 100, y: 100 },
					knownDistance: 1200,
					pixelsPerWorldUnit: 0.75,
				},
			}),
		);

		const error = expectErr(await sidecar.read(assetId));
		// The domain's OWN code, exactly as the shape half passes `asset.*` through — one rule,
		// one vocabulary, no second spelling of it here. The CATEGORY is restamped and the code
		// is not: `validateCalibration` raises this one as a `Calculation`, which
		// `RepositoryError` does not admit, and at a read boundary every one of its refusals
		// means the stored document is invalid.
		expect(error).toMatchObject({ category: 'Validation', code: 'plan.degenerate-points' });
	});

	it('reads a calibration the domain accepts, so the rule refuses degeneracy rather than calibrations', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(
			path,
			rawDocument(assetId, {
				calibration: {
					pointA: { x: 0, y: 0 },
					pointB: { x: 800, y: 0 },
					knownDistance: 1200,
					pixelsPerWorldUnit: 0.75,
				},
			}),
		);

		expect(expectOk(await sidecar.read(assetId)).document.calibration).toEqual({
			pointA: { x: 0, y: 0 },
			pointB: { x: 800, y: 0 },
			knownDistance: 1200,
			pixelsPerWorldUnit: 0.75,
		});
	});

	/**
	 * AN ID THAT CANNOT NAME A FILE is refused HERE, at the one site that derives a path — not
	 * at the index, which is where two earlier attempts put it.
	 *
	 * The hazards are all WRITE hazards: a separator gives a nested sidecar that reads and
	 * writes agree on until a library migration orphans it; a forbidden character or a reserved
	 * Windows device name gives a path that cannot be created at all, on Windows only, so it
	 * fails for users and works for whoever wrote the code. None of them stops a note being
	 * READ, which is why refusing at the index was wrong: it converted a bad write into lost
	 * access, making a note the user can see on disk unopenable in the app.
	 *
	 * Refusing here instead means the note stays indexed and openable, no sidecar is ever
	 * written for it, and there is therefore nothing for a migration to orphan — which closes
	 * the original concern properly rather than by making the asset disappear.
	 *
	 * Reserved device names are reserved WITH an extension: `CON.rpgeo` names the device, not a
	 * file. Matched case-insensitively, and on the id itself, which is the whole stem.
	 */
	it('refuses to resolve a path for an id that cannot name a file', async () => {
		const { sidecar, stack } = seeded();
		const cases = [
			'asset/custom',
			'asset\\custom',
			'asset:custom',
			'asset*x',
			'a|b',
			'a#b',
			'.',
			'..',
			' asset ',
			'asset.',
			'CON',
			'nul',
			'COM1',
			// Reserved BEFORE the first dot, not only as the whole id: Windows treats
			// `CON.shape` as the console too, so an extension is no escape. The first version
			// of this rule anchored on the whole string and let all three of these through.
			'CON.shape',
			'con.rpgeo',
			'COM1.x',
		];
		for (const raw of cases) {
			const id = raw as unknown as Parameters<typeof sidecar.read>[0];
			expect(expectErr(await sidecar.read(id)).code).toBe('asset-geometry.unusable-id');
		}
		// Nothing was written for any of them, which the refusal alone does not say.
		expect([...stack.vault.entries.keys()].some((p) => p.endsWith('.rpgeo'))).toBe(false);
	});

	/**
	 * The WRITE and the DELETE, not only the read — and this case is named for what it asserts
	 * because the first draft was not. It said "and the DELETE" while exercising `write` alone,
	 * which left the delete path's refusal arm uncovered; `coverage-final.json` reported it and
	 * the gate passed anyway on floor headroom. A test name that outruns its assertions is a
	 * defect this repository has a rule about, and this is it, written twenty minutes after
	 * quoting that rule.
	 *
	 * `delete` is reached through the STORE rather than the port, because the port has none —
	 * `PlanGeometrySidecar` does not declare one either, and the repository holds the concrete
	 * store.
	 */
	it('refuses the write and the delete for such an id too, not only the read', async () => {
		const { sidecar, stack } = seeded();
		const id = 'asset:custom' as unknown as Parameters<typeof sidecar.read>[0];

		expect(expectErr(await sidecar.write(id, { calibration: null, shape: rectangle() })).code)
			.toBe('asset-geometry.unusable-id');
		expect(expectErr(await stack.assetGeometry.delete(id)).code).toBe('asset-geometry.unusable-id');
	});

	/**
	 * The control that keeps the reserved rule from over-refusing: `console` and `my.CON` are
	 * ordinary strings that merely CONTAIN a device name, and an id is refused only when the
	 * device name is its whole stem. Measured, because widening the match to a substring would
	 * pass every case above while rejecting legitimate ids.
	 */
	/**
	 * LENGTH, measured in BYTES rather than characters — which is the half a character count
	 * gets wrong. `.rpgeo` is 6 bytes, so a 250-character ASCII id yields a 256-byte filename
	 * against the 255-byte component limit on ext4 and APFS; and `'é'.repeat(130)` is 130
	 * CHARACTERS and 260 BYTES, so a character bound passes it and the filesystem still
	 * refuses. Same defect one encoding over.
	 *
	 * Honest about what this buys, because it is less than it looks: without the bound the
	 * write still fails — `vault.create` refuses and the store maps it — so what changes is
	 * WHICH error. A coded `asset-geometry.unusable-id` naming the id is diagnosable; an opaque
	 * vault failure is not.
	 */
	it('refuses an id whose filename would exceed the component limit, counting bytes', async () => {
		const { sidecar } = seeded();
		for (const raw of ['a'.repeat(250), 'é'.repeat(130)]) {
			const id = raw as unknown as Parameters<typeof sidecar.read>[0];
			expect(expectErr(await sidecar.read(id)).code).toBe('asset-geometry.unusable-id');
		}
	});

	it('accepts an id right at the limit, so the bound is off by nothing', async () => {
		const { sidecar } = seeded();
		// 249 bytes + `.rpgeo` is exactly 255.
		const id = 'a'.repeat(249) as unknown as Parameters<typeof sidecar.read>[0];
		expect(expectOk(await sidecar.read(id)).document.shape).toBeNull();
	});

	it('accepts an id that merely contains a device name', async () => {
		const { sidecar } = seeded();
		for (const raw of ['console', 'console.log', 'my.CON', 'a.b']) {
			const id = raw as unknown as Parameters<typeof sidecar.read>[0];
			// A shapeless read, which is what an asset nobody has designed answers — the point
			// being that it RESOLVED a path rather than refusing one.
			expect(expectOk(await sidecar.read(id)).document.shape).toBeNull();
		}
	});

	it('still resolves an ordinary id, so the rule refuses unusable ids and not ids', async () => {
		const { sidecar, assetId } = seeded();
		expectOk(await sidecar.write(assetId, { calibration: null, shape: rectangle() }));
		expect(expectOk(await sidecar.read(assetId)).document.shape).not.toBeNull();
	});

	it('refuses a hand-edited sidecar whose footprint has two vertices', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(
			path,
			rawDocument(assetId, {
				shape: {
					footprint: { points: [[0, 0], [1, 1]] },
					footprintOrigin: 'traced',
					footprintPending: false,
					clearancePending: false,
					anchorPending: false,
					clearance: null,
					anchor: { x: 0, y: 0 },
					facing: 0,
				},
			}),
		);

		expect(expectErr(await sidecar.read(assetId)).code).toBe('asset-geometry.schema-invalid');
	});

	/**
	 * The domain rules the SCHEMA cannot see — `validateAssetShape`'s, which is why the read
	 * runs it as well as the parse. A typed footprint marked as awaiting a scale is three
	 * valid JSON fields whose combination no command can produce; read as written it would
	 * suppress the unscaled warning over geometry nobody measured.
	 */
	it('refuses a shape the schema accepts and the domain does not', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(
			path,
			rawDocument(assetId, {
				shape: {
					footprint: { points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] },
					footprintOrigin: 'typed',
					footprintPending: true,
					clearancePending: false,
					anchorPending: false,
					clearance: null,
					anchor: { x: 0, y: 0 },
					facing: 0,
				},
			}),
		);

		expect(expectErr(await sidecar.read(assetId)).code).toBe('asset.typed-footprint-cannot-be-pending');
	});

	/**
	 * The store's own narrowing, pinned rather than left as a sentence in its docblock. A
	 * plan sidecar from a newer build refuses through `MigrationRunner` with the `Migration`
	 * category — "this build is too old" rather than "your data is bad" — and this store runs
	 * no runner, because the runner is keyed by the closed `DiagnosticEntityKind` union and
	 * widening it changes the diagnostics snapshot. So the REFUSAL is the same and the
	 * category is not: `schemaVersion: z.literal(1)` is what does the refusing.
	 *
	 * Registering an `asset-geometry` migration kind is what would flip this case, which is
	 * the point of having it — the day somebody does, this fails and says so.
	 */
	it('refuses a sidecar written by a newer build, as a schema refusal rather than a migration one', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(path, rawDocument(assetId, { schemaVersion: 2 }));

		const error = expectErr(await sidecar.read(assetId));

		expect(error).toMatchObject({ category: 'Validation', code: 'asset-geometry.schema-invalid' });
	});

	/**
	 * The filename join happens above; THIS is where a hand-renamed file or a hand-edited
	 * `assetId` surfaces, never silently preferred — `PlanGeometryStore`'s own rule, which
	 * the plan's Step 4a closed for vertex COUNT and said nothing about identity. Without
	 * it, copying one asset's `.rpgeo` onto another's name loads asset A's geometry as
	 * asset B's and then EDITS it there.
	 */
	it('refuses a sidecar that declares a different asset', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		const other = createAssetId();
		stack.vault.entries.set(path, rawDocument(other));

		const error = expectErr(await sidecar.read(assetId));

		expect(error).toMatchObject({ category: 'Persistence', code: 'asset-geometry.asset-id-mismatch' });
		expect(error.message).toContain(other);
	});
});

/**
 * The same port over slice 12's DISK-BACKED fixture vault, against bytes that were checked
 * in rather than written by the test that reads them.
 *
 * Two assets, because the pair is the point: one designed and one not. An asset with no
 * sidecar is the ordinary starting state of every asset ever created, and a fixture that
 * could only express the designed one would hide every "no shape yet" path in the suite
 * behind a `.rpgeo` somebody remembered to add.
 */
describe('ObsidianAssetGeometrySidecar over the fixture vault', () => {
	let open: FixtureStack | undefined;

	afterEach(() => {
		open?.dispose();
		open = undefined;
	});

	it('reads a designed asset\'s shape off the checked-in sidecar', async () => {
		open = await openFixtureVault('valid-project');
		const sidecar = new ObsidianAssetGeometrySidecar(open.assetGeometry);

		const snapshot = expectOk(await sidecar.read('asset-designed' as AssetId));

		expect(snapshot.version.revision).toBe(2);
		expect(snapshot.document.shape?.footprintOrigin).toBe('typed');
		// Raised to `Point`s from the tuples the file holds, over a real filesystem read —
		// which is the half `createRepositoryStack` cannot demonstrate.
		expect(snapshot.document.shape?.footprint.points).toEqual([
			{ x: -300, y: -280 },
			{ x: 300, y: -280 },
			{ x: 300, y: 280 },
			{ x: -300, y: 280 },
		]);
	});

	it('reads an asset with no sidecar as shapeless rather than failing', async () => {
		open = await openFixtureVault('valid-project');
		const sidecar = new ObsidianAssetGeometrySidecar(open.assetGeometry);

		const snapshot = expectOk(await sidecar.read('asset-undesigned' as AssetId));

		expect(snapshot.document).toEqual({ calibration: null, shape: null });
		expect(snapshot.version.revision).toBe(0);
	});
});

/** An asset with its note written and NO sidecar: the state every case below starts from. */
const savedAsset = async (name = 'Radiator') => {
	const stack: RepositoryStack = createRepositoryStack();
	const asset = makeAsset({ name });
	const saved = expectOk(await stack.assets.save(asset, 'absent'));
	return {
		stack,
		asset,
		version: saved.version,
		notePath: stack.index.getPath(asset.id) ?? '',
		path: assetSidecarPathFor(stack.libraryFolder, asset.id),
		sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry),
	};
};

/**
 * The sidecar's LIFECYCLE, which is the half `AssetGeometryStore`'s read and write cannot
 * carry: a `.rpgeo` that outlives the asset note is not merely untidy. It is carried
 * through every later library migration by `libraryGeometryIn`, and — since an asset id is
 * a user-editable frontmatter field — a REUSED id silently loads a deleted asset's design
 * onto the new one, which DEFEATS the store's `asset-id-mismatch` guard rather than
 * slipping past it: the reused id makes the two agree.
 *
 * The shape is `ObsidianPlanRepository.delete`'s and the reasoning is in
 * `AssetGeometryStore.delete`'s own docblock — note first, sidecar second, the note
 * restored byte-for-byte when the sidecar refuses.
 */
describe('deleting an asset takes its geometry sidecar with it', () => {
	it('removes the .rpgeo of a designed asset', async () => {
		const { stack, asset, version, path, sidecar } = await savedAsset();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: rectangle() }));
		expect(stack.vault.entries.has(path)).toBe(true);

		expectOk(await stack.assets.delete(asset.id, version));

		expect(stack.vault.entries.has(path)).toBe(false);
	});

	/**
	 * An asset nobody has designed has no sidecar, which is the ORDINARY state rather than a
	 * failure — the rule `read` already follows, kept true through a delete.
	 *
	 * The absence is evidence only because this fixture COULD have produced the file: the
	 * case above writes one through the same helper, and the assertion below pins that
	 * nothing wrote one here.
	 */
	it('succeeds for an undesigned asset, which has no sidecar to remove', async () => {
		const { stack, asset, version, notePath, path } = await savedAsset('Undesigned');
		expect(stack.vault.entries.has(path)).toBe(false);

		expectOk(await stack.assets.delete(asset.id, version));

		expect(stack.vault.entries.has(notePath)).toBe(false);
		expect(stack.index.getPath(asset.id)).toBeUndefined();
	});

	it('restores the note when the sidecar refuses to go, leaving neither half done', async () => {
		const { stack, asset, version, notePath, path, sidecar } = await savedAsset();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: rectangle() }));
		const before = stack.vault.entries.get(notePath);
		stack.vault.failures.add(`delete:${path}`);

		const refusal = expectErr(await stack.assets.delete(asset.id, version));

		expect(refusal.code).toBe('asset.delete-failed');
		// Neither the note gone with the file behind, nor the file gone with the note behind.
		expect(stack.vault.entries.get(notePath)).toBe(before);
		expect(stack.vault.entries.has(path)).toBe(true);
		expect(stack.index.getPath(asset.id)).toBe(notePath);
	});

	it('refuses before trashing anything when the note cannot be snapshotted', async () => {
		const { stack, asset, version, notePath, path, sidecar } = await savedAsset();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: rectangle() }));
		stack.vault.failures.add(`read:${notePath}`);

		expect(expectErr(await stack.assets.delete(asset.id, version)).code).toBe('asset.delete-failed');

		expect(stack.vault.entries.has(notePath)).toBe(true);
		expect(stack.vault.entries.has(path)).toBe(true);
	});

	it('reports the original failure and logs when the compensation refuses too', async () => {
		const { stack, asset, version, notePath, path, sidecar } = await savedAsset();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: rectangle() }));
		stack.vault.failures.add(`delete:${path}`);
		stack.vault.failures.add(`create:${notePath}`);

		expect(expectErr(await stack.assets.delete(asset.id, version)).code).toBe('asset.delete-failed');

		expect(stack.logged.some((line) => line.event === 'asset.delete-compensation-failed')).toBe(true);
	});

	/**
	 * The consequence made checkable rather than argued: `libraryGeometryIn` is what a
	 * library migration MOVES, so an orphan is what it would carry to the new folder forever.
	 */
	it('leaves a library migration nothing orphaned to carry', async () => {
		const { stack, asset, version, path, sidecar } = await savedAsset();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: rectangle() }));
		expect(libraryGeometryIn(stack.vault.getFiles(), stack.libraryFolder).map((file) => file.path))
			.toEqual([path]);

		expectOk(await stack.assets.delete(asset.id, version));

		expect(libraryGeometryIn(stack.vault.getFiles(), stack.libraryFolder)).toEqual([]);
	});
});
