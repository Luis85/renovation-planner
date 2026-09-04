/**
 * `GetAssetDesign` (Task A8) — the designer's read model, and the one place an asset's two
 * resources are joined: the NOTE (name, height) and the geometry SIDECAR (calibration,
 * shape). Everything derived is derived here; nothing is stored twice.
 *
 * Driven through the REAL `ObsidianAssetRepository` and the REAL
 * `ObsidianAssetGeometrySidecar` over the in-memory vault, for the reason
 * `setAssetFootprint.test.ts` and `setAssetHeight.test.ts` each give for their own half: a
 * hand-written double answers whatever it was told to, and three of the rules below are
 * about what a REAL read does — that an absent sidecar is a shapeless asset rather than a
 * failure, that a sidecar the domain refuses does not degrade into a shapeless one, and
 * that a note whose bytes will not parse is not an asset that is gone.
 */
import { describe, expect, it } from 'vitest';
import { GetAssetDesignQuery } from '../../../src/application/queries/GetAssetDesign';
import { SetAssetBackgroundCommand } from '../../../src/application/commands/asset/SetAssetBackground';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../src/core/events/EventBus';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../src/infrastructure/obsidian/repositories/paths';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetGeometryDocument } from '../../../src/application/ports/AssetGeometrySidecar';
import type { AssetShape, FootprintOrigin } from '../../../src/domain/asset/AssetShape';
import { footprintFromDimensions } from '../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../src/domain/plan/Calibration';
import type { Point } from '../../../src/core/geometry/Point';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from '../../helpers/vault';
import { makeAsset } from '../../helpers/entities';
import { expectErr, expectOk } from '../../helpers/domain';

/** 100 wide, 60 deep, so a bounding box read is not a bounding box guessed. */
const RECTANGLE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 60 },
	{ x: 0, y: 60 },
];

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

const shapeWith = (footprintOrigin: FootprintOrigin, footprintPending: boolean): AssetShape => ({
	footprint: { points: [...RECTANGLE] },
	footprintOrigin,
	footprintPending,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
});

/**
 * The query is constructed HERE, once, for the reason Task A5a paid for: a query built
 * beside a case is a query a mutation run silently leaves un-mutated.
 */
async function seeded(props: { readonly name?: string; readonly height?: number | null } = {}) {
	const stack = createRepositoryStack();
	const saved = expectOk(
		await stack.assets.save(
			makeAsset({ name: props.name ?? 'Kitchen island', height: props.height ?? null }),
			'absent',
		),
	);
	const assetId = saved.entity.id;
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);

	return {
		stack,
		assetId,
		sidecar,
		noteVersion: saved.version,
		notePath: stack.index.getPath(assetId) ?? '',
		sidecarPath: assetSidecarPathFor(stack.libraryFolder, assetId),
		query: new GetAssetDesignQuery(stack.assets, sidecar),
		async seed(document: AssetGeometryDocument): Promise<void> {
			expectOk(await sidecar.write(assetId, document));
		},
		/**
		 * A hand edit every schema ACCEPTS: the note's `id` is rewritten to another asset's,
		 * which is what a user editing frontmatter does. The index keeps the entry it scanned,
		 * so the path still resolves — this is a DISPLACED entry, not a broken note.
		 */
		displaceNote(): void {
			const path = stack.index.getPath(assetId) ?? '';
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, id: createAssetId() }) + body);
			stack.metadataCache.catchUp();
		},
		/** A hand edit no schema would accept, so the next read of the NOTE fails. */
		corruptNote(): void {
			const path = stack.index.getPath(assetId) ?? '';
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, category: 'not-a-category' }) + body);
			stack.metadataCache.catchUp();
		},
	};
}

describe('GetAssetDesign', () => {
	it('joins the note and the sidecar, so one read answers the whole design', async () => {
		const { query, assetId, seed } = await seeded({ name: 'Kitchen island', height: 900 });
		await seed({ calibration: CALIBRATION, shape: shapeWith('traced', false) });

		const design = expectOk(await query.execute(assetId));

		expect(design.assetId).toBe(assetId);
		expect(design.name).toBe('Kitchen island');
		expect(design.height).toBe(900);
		expect(design.calibration).toEqual(CALIBRATION);
		expect(design.shape?.footprintOrigin).toBe('traced');
	});

	it('derives dimensions from the footprint rather than reading a stored pair', async () => {
		const { query, assetId, seed } = await seeded();
		await seed({ calibration: null, shape: shapeWith('traced', false) });

		expect(expectOk(await query.execute(assetId)).dimensions).toEqual({ width: 100, depth: 60 });
	});

	/**
	 * **Task A8's Amendment 1 case, closed by Task B7.** A seeded document can show that
	 * `dimensionsUnscaled` takes no second term (row 3 below); it cannot show that
	 * `SetAssetBackground` itself leaves a measured outline's millimetres and its
	 * `footprintPending` flag alone — only a real command dispatch proves that, end to end.
	 */
	it('keeps a measured outline measured when its background is replaced', async () => {
		const { query, assetId, seed, sidecar, stack } = await seeded();
		await seed({ calibration: CALIBRATION, shape: shapeWith('traced', false) });
		const setBackground = new SetAssetBackgroundCommand(
			{ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() },
			{ fileExists: (path) => path === 'Specs/other.png' },
		);

		expect(expectOk(await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null })))
			.toBe('wrote');

		const dto = expectOk(await query.execute(assetId));
		expect(dto.calibration).toBeNull();
		expect(dto.dimensionsUnscaled).toBe(false);
	});

	/**
	 * `dimensionsUnscaled` IS `footprintPending`, with no second term — the per-attribute
	 * model's whole point. Both directions of the join a reader is tempted to write are
	 * closed here, and each by a row the other cannot see:
	 *
	 * - `pending || calibration === null` — a measured outline whose background was later
	 *   REPLACED (Decision 5 clears the calibration and leaves the millimetres alone) is
	 *   row 3, and it is still measured.
	 * - `pending && calibration !== null` — a fresh trace on a surface that already carries
	 *   a scale nothing has applied to it is row 5, and it is still unscaled.
	 *
	 * Row 3 is the seeded-document version of the case above: it pins the JOIN's own property
	 * (no read of `calibration` in the unscaled derivation) without needing a real command.
	 */
	it.each([
		['typed', false, 'uncalibrated', false],
		['traced', false, 'calibrated', false],
		['traced', false, 'uncalibrated', false],
		['traced', true, 'uncalibrated', true],
		['traced', true, 'calibrated', true],
	] as const)(
		'a %s footprint with footprintPending %s on an %s asset reports unscaled=%s',
		async (origin, footprintPending, scale, expected) => {
			const { query, assetId, seed } = await seeded();
			await seed({
				calibration: scale === 'calibrated' ? CALIBRATION : null,
				shape: shapeWith(origin, footprintPending),
			});

			expect(expectOk(await query.execute(assetId)).dimensionsUnscaled).toBe(expected);
		},
	);

	/**
	 * An absent sidecar is the ordinary starting state of every asset ever created, so it
	 * reads as a shapeless design. Null rather than zeros: `{ width: 0, depth: 0 }` is a
	 * measurement of an object nobody has drawn, and a surface printing it would be stating
	 * a size no one authored.
	 */
	it('answers null dimensions rather than zeros when there is no footprint', async () => {
		const { query, assetId } = await seeded();

		const design = expectOk(await query.execute(assetId));

		expect(design.shape).toBeNull();
		expect(design.dimensions).toBeNull();
		expect(design.dimensionsUnscaled).toBe(false);
	});

	it('refuses an asset that is not there rather than answering an empty design', async () => {
		const { query } = await seeded();

		expect(expectErr(await query.execute(createAssetId())).code).toBe('asset.not-found');
	});

	/**
	 * A read that FAULTS is not an asset that is absent. `isErr(x) || x.value === null` is
	 * the one branch that cannot say which happened, and this repository has shipped it
	 * three times — a vault fault reported to a user as "that entry is gone".
	 */
	it('surfaces a failed note read rather than reporting the asset missing', async () => {
		const { query, assetId, corruptNote } = await seeded();
		corruptNote();

		expect(expectErr(await query.execute(assetId)).code).toBe('asset.entity-invalid');
	});

	/**
	 * The reported symptom of the note-side identity hole, pinned where it was actually
	 * visible. This is the one read in the plugin that JOINS a second file keyed on the id it
	 * was asked for, so a displaced index entry did not merely answer the wrong asset — it
	 * answered `assetId` and `name` from the note it happened to load beside a `shape` and a
	 * `geometryVersion` read from the REQUESTED id's sidecar. One DTO, two identities, and
	 * every geometry command the designer dispatched from that leaf went on conditioning
	 * itself on the other asset's revision.
	 *
	 * The fix is not here: `openNoteById` compares the loaded note's declared id against the
	 * requested one, so `assets.getById` refuses and this query propagates that refusal the
	 * same way it propagates any other failed note read. The case belongs here anyway,
	 * because the guarantee this query owes is about the DTO — that its `assetId` and its
	 * geometry can never name two different assets — and nothing at the repository states it.
	 */
	it('cannot answer a DTO whose note and sidecar name different assets', async () => {
		const { query, assetId, seed, displaceNote } = await seeded();
		await seed({ calibration: CALIBRATION, shape: shapeWith('traced', false) });
		displaceNote();

		const result = await query.execute(assetId);

		// Before the guard this resolved `ok`, and `design.assetId` was the STRANGER's — so a
		// case reaching straight for the code would have failed at a helper rather than here.
		expect(result.ok).toBe(false);
		expect(expectErr(result).code).toBe('asset.note-id-mismatch');
	});

	/**
	 * The sidecar read runs `validateAssetShape` and REFUSES rather than repairing, and the
	 * refusal has to survive this join. Reported as a shapeless asset it would be worse than
	 * a wrong answer: the surface would offer to draw a first outline over a file that
	 * already holds one, and the unscaled warning that damaged shape may be owed would be
	 * unreachable.
	 *
	 * **And it names the file, per §3.5's fifth row.** The sidecar's own JSON parsed fine —
	 * `snapshot.value.path` is in scope at `ObsidianAssetGeometrySidecar.read` the moment
	 * `shapeFromPersistence` refuses — so this is a damaged-sidecar state exactly like
	 * `asset-geometry.corrupt`, and re-reading the same unchanged bytes cannot fix a typed
	 * footprint marked pending. Without the path this state cannot say which file to repair,
	 * which is the one thing it exists for.
	 */
	it('surfaces a sidecar the domain refuses rather than reporting a shapeless asset', async () => {
		const { query, assetId, sidecarPath, stack } = await seeded();
		stack.vault.entries.set(
			sidecarPath,
			JSON.stringify({
				schemaVersion: 1,
				assetId,
				revision: 3,
				unit: 'mm',
				calibration: null,
				shape: {
					footprint: { points: [[0, 0], [100, 0], [100, 60], [0, 60]] },
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

		const error = expectErr(await query.execute(assetId));

		expect(error.code).toBe('asset.typed-footprint-cannot-be-pending');
		expect(error.sidecarPath).toBe(sidecarPath);
	});

	/**
	 * §3.5's refusal table: a damaged-sidecar message names the file, and `BaseError.message`
	 * is developer English with no structured path field to carry one — so the path rides on
	 * the read model's own `sidecarPath` instead. Asserted on the CODE as well as the path, so
	 * a fixture that trips a different guard cannot pass this case for the wrong reason.
	 */
	it('names the sidecar on a damaged-sidecar refusal', async () => {
		const { query, assetId, sidecarPath, stack } = await seeded();
		stack.vault.entries.set(sidecarPath, 'not json at all');

		const error = expectErr(await query.execute(assetId));

		expect(error.code).toBe('asset-geometry.corrupt');
		expect(error.sidecarPath).toBe(sidecarPath);
	});

	/**
	 * `AssetGeometryStore.pathFor` runs `usableAsFilename` BEFORE it ever derives a path, so
	 * an id it refuses has no file to name — which is exactly why §3.5 withholds `Open
	 * designer` in favour of `Open note` for this one code alone. Reached the way a real vault
	 * reaches it: a hand edit to the note's frontmatter `id`, which `AssetFrontmatterSchemaV1`
	 * accepts with no format restriction (`z.string().min(1)`) — the asset stays indexed and
	 * readable and becomes impossible to design. `rebuildIndex()` is the full scan standing in
	 * for the reindex a real vault would run after such an edit; `metadataCache.catchUp()`
	 * alone drains the parse lag and says nothing about the index.
	 */
	it('carries no sidecar path for an id that cannot name a file', async () => {
		const { query, assetId, stack } = await seeded();
		const path = stack.index.getPath(assetId) ?? '';
		const hostileId = 'has/slash' as AssetId;
		const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
		stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, id: hostileId }) + body);
		stack.metadataCache.catchUp();
		stack.rebuildIndex();

		const error = expectErr(await query.execute(hostileId));

		expect(error.code).toBe('asset-geometry.unusable-id');
		expect(error.sidecarPath).toBeUndefined();
	});

	/**
	 * A finite EXTENT is not a finite SPAN: every boundary below this one admits coordinates
	 * one at a time, so -1e308 and 1e308 each pass and their difference is `Infinity`.
	 * Reported rather than presented as a measurement — the lie the unscaled marker exists to
	 * prevent, and `JSON.stringify` would write it back as `null`.
	 *
	 * A NEEDLE and not the obvious rectangle, which is what the first draft used and is a
	 * measurement worth keeping: at ±1e308 the shoelace terms of an axis-aligned rectangle
	 * are ±`Infinity`, their sum is `NaN`, and `enclosesArea` refuses it as
	 * `asset.degenerate-footprint` one guard EARLIER — so that fixture proves the read
	 * boundary works and says nothing about this query at all.
	 *
	 * The VERTEX ORDER is load-bearing for the same reason, which is why it is stated rather
	 * than left to look arbitrary. `signedAreaSum` shifts every term to `points[0]`, and its
	 * first term multiplies `(points[1].x - origin.x)` by `(points[0].y - origin.y)`, which
	 * is exactly zero — so an origin at either far end makes that term `Infinity * 0`, `NaN`,
	 * and the whole sum `NaN`. Starting at the near vertex keeps every cross product finite
	 * while the x-span still overflows, which is precisely the state this arm exists for: a
	 * shape that is valid, encloses an area, and is measurable in one of its two axes only.
	 */
	it('refuses a footprint whose extent is not representable rather than measuring it', async () => {
		const { query, assetId, seed } = await seeded();
		await seed({
			calibration: null,
			shape: {
				...shapeWith('traced', false),
				footprint: {
					points: [
						{ x: 0, y: 1e-300 },
						{ x: 1e308, y: 0 },
						{ x: -1e308, y: 0 },
					],
				},
			},
		});

		expect(expectErr(await query.execute(assetId)).code).toBe('dimensions-overflow');
	});

	/**
	 * The CLEARANCE's own extent goes through the same guarded `dimensionsOf` call the
	 * footprint's does, and `validateAssetShape` does not close the gap on its own:
	 * `enclosesArea` tests `Number.isFinite` on the AREA, and this needle has a finite
	 * shoelace sum and an infinite SPAN — the identical fixture the footprint case above
	 * uses, copied deliberately rather than invented, moved to the clearance instead of the
	 * footprint. An axis-aligned rectangle spanning -1e308 to 1e308 would trip
	 * `asset.degenerate-clearance` one guard earlier and never reach `dimensionsOf` at all —
	 * a green test exercising a different guard.
	 */
	it('refuses a clearance whose span overflows rather than reporting Infinity', async () => {
		const { query, assetId, seed } = await seeded();
		await seed({
			calibration: null,
			shape: {
				...shapeWith('traced', false),
				clearance: {
					points: [
						{ x: 0, y: 1e-300 },
						{ x: 1e308, y: 0 },
						{ x: -1e308, y: 0 },
					],
				},
			},
		});

		expect(expectErr(await query.execute(assetId)).code).toBe('dimensions-overflow');
	});

	/**
	 * Beside the footprint's, not instead of it: an ordinary shape carries both a footprint
	 * and a clearance, each with its own extent, and this is the case that would have printed
	 * `Infinity mm` before either overflow guard existed to say why it could not.
	 */
	it('derives the clearance extent beside the footprint on an ordinary shape', async () => {
		const { query, assetId, seed } = await seeded();
		const clearance = expectOk(footprintFromDimensions(1400, 400));
		await seed({
			calibration: null,
			shape: { ...shapeWith('traced', false), clearance },
		});

		const design = expectOk(await query.execute(assetId));

		expect(design.clearanceExtent).toEqual({ width: 1400, depth: 400 });
		expect(design.dimensions).toEqual({ width: 100, depth: 60 });
	});

	/**
	 * TWO versions, named, because an asset is two resources with two independent revision
	 * counters — the same fact Task B3's two ledgers exist for. One field called `version`
	 * would be a value half of its readers use against the wrong port: presented to the note
	 * it refuses as stale, presented to the sidecar it conditions a write on a number that
	 * never described it.
	 */
	it('reports the note and the sidecar revisions separately', async () => {
		const { query, assetId, seed, noteVersion } = await seeded();
		await seed({ calibration: null, shape: shapeWith('typed', false) });
		await seed({ calibration: CALIBRATION, shape: shapeWith('typed', false) });

		const design = expectOk(await query.execute(assetId));

		expect(design.noteVersion).toEqual(noteVersion);
		expect(design.geometryVersion.revision).toBe(2);
	});
});
