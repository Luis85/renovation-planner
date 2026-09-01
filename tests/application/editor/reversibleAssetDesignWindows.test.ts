/**
 * The THREE WINDOWS an asset design gesture straddles, in one file because they are
 * separately reachable, easy to conflate, and each one's fix is invisible to the other two.
 *
 * Split out of `reversibleAssetDesign.test.ts` at the 450-line test budget, along that seam
 * rather than at whatever line the budget fell on; the harness both files drive is
 * `tests/helpers/assetDesignHarness.ts`.
 */
import { describe, expect, it } from 'vitest';
import { ReversibleAssetDesignCommands } from '../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import type { WriteLedger } from '../../../src/application/editor/WriteLedger';
import { expectErr, expectOk } from '../../helpers/domain';
import {
	SQUARE,
	TRIANGLE,
	WIDER,
	drawn,
	present,
	repositoryWritingAfterSave,
	seeded,
	sidecarWritingAfterWrite,
} from '../../helpers/assetDesignHarness';

/**
 * **WINDOW 2: a foreign write SANDWICHED between two of this history's own gestures.**
 *
 * Three windows a design gesture straddles, separately reachable and easy to conflate, so
 * they are named here once for all of them and each has its own block:
 *
 * 1. this adapter's pre-read → the wrapped command's own read. Closed by conditioning the
 *    forward write on the snapshot this gesture kept — asserted in the sibling file, under
 *    "the window between this gesture's snapshot and the command's own read", because that
 *    one was already closed when these two were found.
 * 2. between two gestures, which is this one.
 * 3. the command's write → whatever learns the version it produced. The block below.
 *
 * The sandwich is the one the version alone cannot see, because every write in it is
 * conditional and every condition holds: the peer's write is not refused by anyone, the
 * SECOND gesture reads past it legitimately, and its undo then advances the ledger to a
 * version the store really holds — so the FIRST gesture's undo matches the tip and puts a
 * pre-peer document back with no refusal anywhere. `WriteLedger` walks all five steps.
 */
describe('a foreign write sandwiched between two design gestures', () => {
	it('refuses the first gesture undo rather than restoring a document that predates a peer', async () => {
		const { reversible, assetId, seed, document, plain } = await seeded();
		await seed(drawn());

		const gestureOne = reversible.setFootprint({ assetId, points: TRIANGLE });
		expect(expectOk(await gestureOne.execute())).toBe('wrote');

		// A peer designer leaf, or a synced change: through the plain command, so it touches
		// no ledger of ours — which is exactly what makes it foreign.
		expect(expectOk(await plain.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');

		const gestureTwo = reversible.setClearance({ assetId, points: WIDER });
		expect(expectOk(await gestureTwo.execute())).toBe('wrote');
		// Its own inverse post-dates the peer, so undoing it is legitimate and must succeed.
		expect(expectOk(await gestureTwo.undo())).toBe('wrote');
		expect((await document()).shape?.facing).toBe(1);

		const error = expectErr(await gestureOne.undo());
		expect(error.code).toBe('undo.superseded');
		// The consequence the refusal buys, rather than a restatement of it.
		expect((await document()).shape?.facing).toBe(1);
	});

	/**
	 * The BACKGROUND adapter's own version of the sandwich, on EACH of its two ledgers
	 * separately — it is the one adapter that checks both, and each check has to refuse on its
	 * own before the write it guards is ever attempted.
	 */
	it('refuses a background undo when the NOTE ledger has moved since, via a sandwiched peer', async () => {
		const { reversible, assetId, plain } = await seeded();

		const gestureOne = reversible.setBackground({ assetId, path: 'Specs/a.png', kind: 'image', page: null });
		expect(expectOk(await gestureOne.execute())).toBe('wrote');

		// A peer, foreign to this history, writing the NOTE this gesture also touches.
		expect(expectOk(await plain.setHeight.execute({ assetId, height: 1200 }))).toBe('wrote');

		const gestureTwo = reversible.setHeight({ assetId, height: 1500 });
		expect(expectOk(await gestureTwo.execute())).toBe('wrote');
		expect(expectOk(await gestureTwo.undo())).toBe('wrote');

		expect(expectErr(await gestureOne.undo()).code).toBe('undo.superseded');
	});

	it('refuses a background undo when the GEOMETRY ledger has moved since, via a sandwiched peer', async () => {
		const { reversible, assetId, seed, plain } = await seeded();
		await seed(drawn());

		const gestureOne = reversible.setBackground({ assetId, path: 'Specs/a.png', kind: 'image', page: null });
		expect(expectOk(await gestureOne.execute())).toBe('wrote');

		// A peer, foreign to this history, writing the SIDECAR this gesture also touches.
		expect(expectOk(await plain.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');

		const gestureTwo = reversible.setFacing({ assetId, facing: 2 });
		expect(expectOk(await gestureTwo.execute())).toBe('wrote');
		expect(expectOk(await gestureTwo.undo())).toBe('wrote');

		expect(expectErr(await gestureOne.undo()).code).toBe('undo.superseded');
	});

	/** The NOTE half of the same rule, whose inverse is a whole `Asset` and not one field. */
	it('refuses a note gesture undo rather than restoring an entity that predates a peer', async () => {
		const { reversible, assetId, plain, height } = await seeded();

		const gestureOne = reversible.setHeight({ assetId, height: 900 });
		expect(expectOk(await gestureOne.execute())).toBe('wrote');

		expect(expectOk(await plain.setHeight.execute({ assetId, height: 1200 }))).toBe('wrote');

		const gestureTwo = reversible.setHeight({ assetId, height: 1500 });
		expect(expectOk(await gestureTwo.execute())).toBe('wrote');
		expect(expectOk(await gestureTwo.undo())).toBe('wrote');
		expect(await height()).toBe(1200);

		expect(expectErr(await gestureOne.undo()).code).toBe('undo.superseded');
		expect(await height()).toBe(1200);
	});

	/**
	 * **The over-correction, and it is the whole reason the ledger exists.** A guard that
	 * refused whenever the ledger's tip had moved since a gesture ran would refuse this — two
	 * of this history's own gestures on one asset, undone in order — which is the exact
	 * sequence design slice 6 built the shared ledger to make work.
	 *
	 * Two ledgers and two resources deliberately, because a single-resource version passes a
	 * build whose generation is keyed per LEDGER rather than per entity.
	 */
	it('still undoes two sibling gestures of its own, in order, across both resources', async () => {
		const { reversible, assetId, seed, document, height } = await seeded();
		await seed(drawn());

		const footprint = reversible.setFootprint({ assetId, points: TRIANGLE });
		const tallness = reversible.setHeight({ assetId, height: 900 });
		const clearance = reversible.setClearance({ assetId, points: WIDER });
		expect(expectOk(await footprint.execute())).toBe('wrote');
		expect(expectOk(await tallness.execute())).toBe('wrote');
		expect(expectOk(await clearance.execute())).toBe('wrote');

		expect(expectOk(await clearance.undo())).toBe('wrote');
		expect(expectOk(await tallness.undo())).toBe('wrote');
		expect(expectOk(await footprint.undo())).toBe('wrote');

		expect((await document()).shape?.footprint.points).toEqual(SQUARE);
		expect((await document()).shape?.clearance?.points).toEqual(TRIANGLE);
		expect(await height()).toBe(700);
	});
});

/**
 * **WINDOW 3: between the command's own write and whatever learns the version it produced.**
 *
 * This adapter used to learn that version by reading the port back, and a peer writing in
 * between was recorded as ours: the undo then presented the PEER's version, matched, and
 * restored the pre-gesture document over their edit. One gesture is enough, so window 2's
 * generation cannot help — nothing later ever pre-reads and disagrees.
 *
 * Closed by the command reporting the version its own write produced (`executeWithVersion`,
 * the door the two Inspector override adapters already take) — the remedy the deleted
 * read-back helper's own header named while declining it, which is why "a documented residue
 * reads as surveyed ground" is a rule about this repository rather than an aphorism.
 */
describe('the window between the command\'s write and the version this gesture records', () => {
	it('records the version its OWN write produced, so a peer landing after it is not recorded as ours', async () => {
		const hook: { run: () => Promise<unknown> } = { run: () => Promise.resolve() };
		const w = await seeded({ sidecar: (real) => sidecarWritingAfterWrite(real, () => hook.run()) });
		await w.seed(drawn());
		const peerRan = { done: false };
		hook.run = async () => {
			const current = expectOk(await w.sidecar.read(w.assetId));
			expectOk(
				await w.sidecar.write(
					w.assetId,
					{ ...current.document, shape: { ...(current.document.shape ?? drawn()), facing: 1 } },
					current.version,
				),
			);
			peerRan.done = true;
		};

		const gesture = w.reversible.setFootprint({ assetId: w.assetId, points: TRIANGLE });
		expect(expectOk(await gesture.execute())).toBe('wrote');
		expect(peerRan.done).toBe(true);

		// Asserted on the CODE: this refusal comes from the store, because the version the
		// gesture presents is the one it really wrote and the peer has moved past it.
		expect(expectErr(await gesture.undo()).code).toBe('asset-geometry.revision-conflict');
		expect((await w.document()).shape?.facing).toBe(1);
	});

	/** The note half, where the peer lands between the repository save and the read-back. */
	it('records the note version its own save produced, not what a read-back found after a peer', async () => {
		const hook: { run: () => Promise<unknown> } = { run: () => Promise.resolve() };
		const w = await seeded({ assets: (real) => repositoryWritingAfterSave(real, () => hook.run()) });
		const peerRan = { done: false };
		hook.run = async () => {
			const current = present(expectOk(await w.stack.assets.getById(w.assetId)));
			expectOk(await w.stack.assets.save(expectOk(current.entity.withChanges({ height: 1200 })), current.version));
			peerRan.done = true;
		};

		const gesture = w.reversible.setHeight({ assetId: w.assetId, height: 900 });
		expect(expectOk(await gesture.execute())).toBe('wrote');
		expect(peerRan.done).toBe(true);

		expect(expectErr(await gesture.undo()).code).toBe('asset.revision-conflict');
		expect(await w.height()).toBe(1200);
	});
});

/**
 * **The fallback when the ledger answers NOTHING**, which is a fail-closed default rather
 * than a working path — and it needed a case of its own the moment the read-back went.
 *
 * `lastWritten ?? preVersion` used to be reached by an ordinary failure: the adapter learned
 * its version with a second read, and a read that faulted left the ledger empty. That read is
 * gone (the block above), so the only way here now is a `WriteLedger` that records nothing —
 * the shape a future asset-delete adapter's `forget` would produce for an id, and the shape
 * `reversibleCreateZone.test.ts` already stands one up for.
 *
 * What it asserts is the REFUSAL, because the fallback is not a way to make the undo work:
 * `preVersion` is what the store held BEFORE this gesture wrote, so presenting it against a
 * store that has moved on is exactly the fail-closed answer — better than overwriting a state
 * this adapter can no longer describe. Both adapters, because a build that fixed one is a
 * build the other's identical line says nothing about.
 */
/** Records nothing and remembers nothing — every question answered as if unasked. */
const silentLedger = (): WriteLedger => ({
	lastWritten: () => null,
	record: () => undefined,
	forget: () => undefined,
	generation: () => 0,
	observe: () => 0,
});

describe('an undo whose ledger answers nothing at all', () => {
	it('falls back to the pre-gesture version and is refused, on the geometry side', async () => {
		const w = await seeded();
		const adapters = new ReversibleAssetDesignCommands(
			{
				sidecar: w.sidecar,
				assets: w.stack.assets,
				events: w.events,
				noteLedger: silentLedger(),
				geometryLedger: silentLedger(),
			},
			w.bundle,
		);
		await w.seed(drawn());
		const gesture = adapters.setFootprint({ assetId: w.assetId, points: TRIANGLE });
		expect(expectOk(await gesture.execute())).toBe('wrote');
		const written = await w.document();

		expect(expectErr(await gesture.undo()).code).toBe('asset-geometry.revision-conflict');
		expect(await w.document()).toEqual(written);
	});

	it('falls back to the pre-gesture version and is refused, on the note side', async () => {
		const w = await seeded();
		const adapters = new ReversibleAssetDesignCommands(
			{
				sidecar: w.sidecar,
				assets: w.stack.assets,
				events: w.events,
				noteLedger: silentLedger(),
				geometryLedger: silentLedger(),
			},
			w.bundle,
		);
		const gesture = adapters.setHeight({ assetId: w.assetId, height: 900 });
		expect(expectOk(await gesture.execute())).toBe('wrote');

		expect(expectErr(await gesture.undo()).code).toBe('asset.revision-conflict');
		expect(await w.height()).toBe(900);
	});
});
