/**
 * `SetAssetBackground` (Task B7) — the note's spec-sheet reference AND the sidecar's
 * calibration, cleared in the same gesture (Decision 5).
 *
 * Driven through the REAL `ObsidianAssetRepository` and the REAL `ObsidianAssetGeometrySidecar`
 * over the in-memory vault, for the reason every other design-command suite in this epic
 * gives: what these cases are about is the DOCUMENT and the NOTE that end up on disk, and a
 * hand-written fake would answer whatever it was told to.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetBackgroundCommand } from '../../../../src/application/commands/asset/SetAssetBackground';
import { leftWritesBehind } from '../../../../src/application/commands/DispatchOutcome';
import type { AssetGeometrySidecar } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { AssetRepository } from '../../../../src/application/ports/AssetRepository';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { err, isErr, isOk } from '../../../../src/core/result/Result';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/** A vault fault a case can inject, shaped exactly as the ports' own union permits. */
const VAULT_FAULT = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the write failed',
} as const;

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

function shapeWith(overrides: Partial<AssetShape> = {}): AssetShape {
	return {
		footprint: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }] },
		footprintOrigin: 'traced',
		footprintPending: false,
		clearance: null,
		clearancePending: false,
		anchor: { x: 0, y: 0 },
		anchorPending: false,
		facing: 0,
		...overrides,
	};
}

/**
 * The command is constructed HERE, once, for the reason this epic has already paid for: a
 * command built beside a case is a command a mutation run silently leaves un-mutated.
 *
 * Both ports are wrapped rather than replaced outright, so a case can fail ONE write without
 * losing the real vault behind every other call — `sidecarWriteFails` and `noteWriteFails` are
 * armed per case and never retroactively affect a write already made.
 */
async function seeded() {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const real = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const written = expectOk(await stack.assets.save(makeAsset(), 'absent'));
	const assetId = written.entity.id;
	const path = stack.index.getPath(assetId) ?? '';

	// `null` means "never fails"; a number is the write COUNT (1-indexed) it starts failing
	// from, so a case can let an earlier write through and fail only a later one — the shape
	// the "reports an uncompensated failure" case needs (the clear must land before the
	// restore is asked to).
	let sidecarFailsFrom: number | null = null;
	let sidecarWrites = 0;
	let sidecarReadsFail = false;
	const sidecar: AssetGeometrySidecar = {
		read: (id) => (sidecarReadsFail ? Promise.resolve(err(VAULT_FAULT)) : real.read(id)),
		write: (id, document, expected) => {
			sidecarWrites += 1;
			if (sidecarFailsFrom !== null && sidecarWrites >= sidecarFailsFrom) {
				return Promise.resolve(err(VAULT_FAULT));
			}
			return real.write(id, document, expected);
		},
	};

	let noteWritesFail = false;
	let noteReadsFail = false;
	const assets: AssetRepository = {
		getById: (id) => (noteReadsFail ? Promise.resolve(err(VAULT_FAULT)) : stack.assets.getById(id)),
		listAll: () => stack.assets.listAll(),
		delete: (id, expected) => stack.assets.delete(id, expected),
		save: (asset, expected) =>
			noteWritesFail ? Promise.resolve(err(VAULT_FAULT)) : stack.assets.save(asset, expected),
	};

	return {
		stack,
		assetId,
		sidecar: real,
		setBackground: new SetAssetBackgroundCommand({ sidecar, assets, events }),
		async seedShape(shape: AssetShape | null): Promise<void> {
			expectOk(await real.write(assetId, { calibration: null, shape }));
		},
		/** Adds `CALIBRATION` to whatever the sidecar already holds, rather than replacing it. */
		async seedCalibration(): Promise<void> {
			const current = expectOk(await real.read(assetId));
			expectOk(await real.write(assetId, { ...current.document, calibration: CALIBRATION }, current.version));
		},
		/** Fails the sidecar's write from its `fromCall`-th call onward (1-indexed). */
		sidecarWriteFails(fromCall = 1): void {
			sidecarFailsFrom = fromCall;
		},
		noteWriteFails(): void {
			noteWritesFail = true;
		},
		sidecarReadFails(): void {
			sidecarReadsFail = true;
		},
		noteReadFails(): void {
			noteReadsFail = true;
		},
		readFrontmatter(): Record<string, unknown> {
			return parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter;
		},
		/** A hand edit no schema would accept, so the next read of this NOTE fails. */
		corrupt(): void {
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, category: 'not-a-category' }) + body);
			stack.metadataCache.catchUp();
		},
		/** A hand edit carrying only half the background pair — a path with no kind. */
		corruptPartialBackground(): void {
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(
				path,
				serializeFrontmatter({ ...frontmatter, 'background-path': 'Specs/oven.pdf' }) + body,
			);
			stack.metadataCache.catchUp();
		},
	};
}

describe('SetAssetBackground', () => {
	/**
	 * Step 0: the schema strips unknown keys and the mapper writes only modelled fields, so a
	 * command writing `background-path` AROUND them would not round-trip — the next ordinary
	 * save of that asset would silently delete the reference. Asserted through a SECOND,
	 * unrelated save rather than only a re-read, because a read straight after this command's
	 * own write would pass even if the field lived nowhere `assetToPersistence` reaches.
	 */
	it('round-trips a background reference through the repository, and an ordinary save keeps it', async () => {
		const { setBackground, assetId, stack } = await seeded();

		expect(expectOk(await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 })))
			.toBe('wrote');

		const loaded = expectOk(await stack.assets.getById(assetId));
		if (loaded === null) throw new Error('expected the asset to be present');
		expectOk(await stack.assets.save(loaded.entity, loaded.version)); // an unrelated later save

		const reloaded = expectOk(await stack.assets.getById(assetId));
		expect(reloaded?.entity.background).toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });
	});

	it('stores the reference in the note, so a plugin-less reader can see which file it is', async () => {
		const { setBackground, assetId, readFrontmatter } = await seeded();

		await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });

		const frontmatter = await readFrontmatter();
		expect(frontmatter['background-path']).toBe('Specs/oven.pdf');
		expect(frontmatter['background-kind']).toBe('pdf');
		expect(frontmatter['background-page']).toBe(1);
	});

	it('refuses a path that is not a supported background kind', async () => {
		const { setBackground, assetId } = await seeded();

		const result = await setBackground.execute({ assetId, path: 'Specs/oven.docx', kind: 'docx', page: null });

		expect(isErr(result)).toBe(true);
	});

	it('clears the calibration, because two points on the old document name nothing on the new one', async () => {
		const { setBackground, assetId, seedCalibration, sidecar } = await seeded();
		await seedCalibration();

		await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.calibration).toBeNull();
	});

	it('does NOT re-flag an already-measured outline: the object did not change size', async () => {
		const { setBackground, assetId, seedShape, seedCalibration, sidecar } = await seeded();
		await seedShape(shapeWith({ footprintOrigin: 'traced', footprintPending: false }));
		await seedCalibration();

		await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
	});

	/**
	 * The whole ordering claim, asserted directly: a sidecar write that fails outright must
	 * leave the NOTE untouched. `sidecarWriteFails()` defaults to the first call, which is the
	 * clear — so nothing downstream of it, including the note write, is ever reached.
	 */
	it('leaves neither half applied when the write fails', async () => {
		const { setBackground, assetId, sidecarWriteFails, readFrontmatter } = await seeded();
		sidecarWriteFails();
		const before = await readFrontmatter();

		const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(isErr(result)).toBe(true);
		expect(await readFrontmatter()).toEqual(before);
	});

	/**
	 * The compensation: a note write that fails AFTER the calibration was cleared restores it,
	 * from the snapshot taken before clearing it. Without this, a failed background change
	 * leaves the user on their old background with its calibration destroyed, for a change
	 * that never happened.
	 */
	it('restores the calibration when the note write fails, so a failed change changes nothing', async () => {
		const { setBackground, assetId, seedCalibration, noteWriteFails, sidecar } = await seeded();
		await seedCalibration();
		noteWriteFails();

		const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(isErr(result)).toBe(true);
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.calibration).not.toBeNull();
	});

	/**
	 * And when the RESTORE also fails, the refusal says so rather than letting the indicator
	 * settle at `Saved` over a vault whose calibration is gone. `sidecarWriteFails(2)` lets the
	 * FIRST sidecar write (the clear) land — the compensation has to have something to
	 * compensate for — and fails only the second (the restore).
	 */
	it('reports an uncompensated failure rather than letting the indicator settle at Saved', async () => {
		const { setBackground, assetId, seedCalibration, noteWriteFails, sidecarWriteFails } = await seeded();
		await seedCalibration();
		noteWriteFails();
		sidecarWriteFails(2);

		const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(isErr(result) && leftWritesBehind(result.error)).toBe(true);
	});

	/** `dot <= 0` refuses BOTH a plain extensionless name and a dotfile — the `<=` is load-bearing. */
	it('refuses a path with no extension at all, as well as one with the wrong extension', async () => {
		const { setBackground, assetId } = await seeded();

		const result = await setBackground.execute({ assetId, path: 'Specs/oven', kind: 'pdf', page: null });

		expect(expectErr(result).code).toBe('asset.unsupported-background');
	});

	/**
	 * `ok` is not evidence that anything was written: re-submitting the reference this asset
	 * already carries, over a document that is already uncalibrated, has to say so rather than
	 * clearing a calibration that was never there and re-writing an identical note.
	 */
	it('reports no-write when re-submitting the reference the asset already carries', async () => {
		const { setBackground, assetId, stack } = await seeded();
		expect(expectOk(await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 })))
			.toBe('wrote');
		const before = expectOk(await stack.assets.getById(assetId))?.version;

		const result = await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });

		expect(expectOk(result)).toBe('no-write');
		expect(expectOk(await stack.assets.getById(assetId))?.version).toEqual(before);
	});

	/**
	 * A read that FAULTS is not an asset that is absent — collapsing the two tells a user their
	 * catalogue entry no longer exists about a note whose bytes are sitting on disk, the relabel
	 * this repository has already paid for more than once.
	 */
	it('propagates a failed note read rather than reporting the asset missing', async () => {
		const { setBackground, assetId, corrupt } = await seeded();
		corrupt();

		const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(expectErr(result).code).toBe('asset.entity-invalid');
	});

	it('refuses an asset that is not there rather than writing a sidecar for an invented id', async () => {
		const { setBackground } = await seeded();
		const invented = createAssetId();

		const result = await setBackground.execute({ assetId: invented, path: 'Specs/other.png', kind: 'image', page: null });

		expect(expectErr(result).code).toBe('asset.not-found');
	});

	it('propagates a failed sidecar read', async () => {
		const { setBackground, assetId, sidecarReadFails } = await seeded();
		sidecarReadFails();

		const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(expectErr(result).code).toBe('vault.unexpected-failure');
	});

	/**
	 * The domain refusal this command's own cheap kind check cannot catch: a page is validated
	 * only by `Asset.create`, and touches neither resource, exactly like every other domain
	 * refusal here.
	 */
	it('refuses a non-positive page, and writes neither half', async () => {
		const { setBackground, assetId, readFrontmatter } = await seeded();
		const before = readFrontmatter();

		const result = await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 0 });

		expect(expectErr(result).code).toBe('asset.invalid-background-page');
		expect(readFrontmatter()).toEqual(before);
	});

	/**
	 * `background-path` and `background-kind` are nullable independently, so a hand-edited note
	 * carrying one without the other is possible; the mapper reads that as no background rather
	 * than a partial one — `AssetBackgroundRef` has no representation for a kind with no path.
	 */
	it('reads a hand-edited note carrying only half the background pair as no background', async () => {
		const { assetId, stack, corruptPartialBackground } = await seeded();
		corruptPartialBackground();

		const reloaded = expectOk(await stack.assets.getById(assetId));

		expect(reloaded?.entity.background).toBeNull();
	});
});
