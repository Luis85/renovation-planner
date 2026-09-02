/**
 * Task B3b: the reversible adapters, without which undo is a lie.
 *
 * The harness — every command, both ledgers, the fixtures and the port wrappers — is
 * `tests/helpers/assetDesignHarness.ts`, shared with `reversibleAssetDesignWindows.test.ts`
 * rather than copied, and its own docblock carries the account of why every collaborator here
 * is the REAL one.
 *
 * **This file holds the adapters' ordinary contract; its sibling holds the three WINDOWS a
 * gesture straddles.** They were one file until the 450-line test budget split them, and the
 * split is along that seam rather than at whatever line the budget fell on.
 */
import { describe, expect, it } from 'vitest';
import { leftWritesBehind, type VersionedDispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { isErr, ok } from '../../../src/core/result/Result';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import {
	CALIBRATION,
	SQUARE,
	TRIANGLE,
	WIDER,
	drawn,
	present,
	seeded,
	sidecarFailingReadsAfter,
	sidecarWritingBetweenReads,
} from '../../helpers/assetDesignHarness';


describe('the inverse a geometry gesture captures', () => {
	/**
	 * The plan's own first case. Asserted on the whole DOCUMENT rather than on the footprint,
	 * because an inverse narrowed to the one field a command owns restores an old value over a
	 * neighbour the same write moved — which is Task B7's background/calibration pair exactly,
	 * and the assertion that would have to be re-derived if this one were narrower.
	 */
	it('restores the exact document the forward write replaced', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());
		const before = await document();

		const command = reversible.setFootprint({ assetId, points: TRIANGLE });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await document()).shape?.footprint.points).toEqual(TRIANGLE);

		expect(expectOk(await command.undo())).toBe('wrote');
		expect(await document()).toEqual(before);
	});

	/**
	 * The inverse is what the read FOUND, never what the gesture assumed. A clearance restored
	 * from an assumed empty pre-state looks identical on an undrawn asset and silently deletes
	 * a boundary somebody measured on a drawn one.
	 */
	it('puts back a clearance that was already there, rather than an assumed absence', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());

		const command = reversible.setClearance({ assetId, points: WIDER });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await command.undo())).toBe('wrote');

		expect((await document()).shape?.clearance?.points).toEqual(TRIANGLE);
	});

	/** The typed footprint door is reachable and reversible too, and it is a separate command. */
	it('reverses a TYPED footprint, which is a different command through the same adapter', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());

		const command = reversible.setFootprintFromDimensions({ assetId, width: 1200, depth: 800 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await document()).shape?.footprintOrigin).toBe('typed');

		expect(expectOk(await command.undo())).toBe('wrote');
		const shape = (await document()).shape;
		expect(shape?.footprintOrigin).toBe('traced');
		expect(shape?.footprint.points).toEqual(SQUARE);
	});

	/** The facing adapter, whose command owns one scalar and no pending flag. */
	it('reverses a facing', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());

		const command = reversible.setFacing({ assetId, facing: Math.PI / 2 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await document()).shape?.facing).toBeCloseTo(Math.PI / 2, 12);

		expect(expectOk(await command.undo())).toBe('wrote');
		expect((await document()).shape?.facing).toBe(0);
	});

	/**
	 * Task B3b's own calibration case, INHERITED by Task B6 rather than re-derived — that task
	 * wrote it out as an `it.skip` and said why: `reversible.calibrate` had no command to wrap
	 * until `CalibrateAsset` existed, and "the rescaled-coordinate assertion is the whole point
	 * of a calibration undo, and it is the assertion a re-derived version would be likeliest to
	 * drop."
	 *
	 * **It is asserted on BOTH sides of the undo, which the relocated version was not.** A
	 * restored `SQUARE` is what the seed already held, so a build whose forward write rescaled
	 * NOTHING restores the same coordinates and passes — the middle assertion is the only thing
	 * that tells the two apart. `footprintPending` is asserted for the same reason from the
	 * other end: a calibration takes every flag down, so an inverse that put the coordinates
	 * back and left the flags cleared would leave a converted-looking outline nothing would
	 * ever convert again.
	 */
	it('restores a calibration undo including every coordinate it rescaled', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed({ ...drawn(), footprintPending: true });

		const command = reversible.calibrate({
			assetId,
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 200,
		});
		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await document()).shape?.footprint.points[2]).toEqual({ x: 200, y: 200 });
		expect((await document()).shape?.footprintPending).toBe(false);

		expect(expectOk(await command.undo())).toBe('wrote');

		const restored = (await document()).shape;
		expect(restored?.footprint.points).toEqual(SQUARE);
		expect(restored?.footprintPending).toBe(true);
		expect((await document()).calibration).toBeNull();
	});

	/**
	 * **Task B3b's own case, relocated to Task B7 rather than re-derived.** The amendment that
	 * moved it said why: `SetAssetBackground` writes the note AND clears the sidecar's
	 * calibration, so a snapshot rule capturing only the background field would restore the old
	 * REFERENCE over an erased calibration — which is not the pre-command state, and exactly the
	 * half of Decision 5 a re-derived snapshot rule would miss. Seeding a CALIBRATED asset is
	 * what makes that visible: the calibration this undo restores is the one the forward write
	 * cleared, not one this adapter invented.
	 */
	it('restores the calibration a background change cleared, not only the reference', async () => {
		const { reversible, assetId, seedCalibration, sidecar } = await seeded();
		await seedCalibration();

		const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await sidecar.read(assetId)).document.calibration).toBeNull();

		expect(expectOk(await command.undo())).toBe('wrote');

		const after = await sidecar.read(assetId);
		expect(expectOk(after).document.calibration).toEqual(CALIBRATION);
	});

	/**
	 * A REDO re-captures, and the case has to make the two builds DIFFER to say so. A redo whose
	 * document is the one its own first execute replaced passes against a capture-once adapter
	 * as well — the pre-state is the same document both times — so a peer leaf writes BETWEEN
	 * the undo and the redo, and the undo that follows must put back what the redo actually
	 * replaced. A capture-once inverse restores the document from before that peer's edit and
	 * silently deletes it.
	 */
	it('re-captures on a redo, so the undo after it restores what the REDO replaced', async () => {
		const { reversible, assetId, seed, document, plain } = await seeded();
		await seed(drawn());

		const command = reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } });
		await command.execute();
		await command.undo();

		// A peer designer leaf, in between — which is why the redo's pre-state is not the
		// first execute's.
		expect(expectOk(await plain.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');
		const beforeRedo = await document();

		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await command.undo())).toBe('wrote');

		expect(await document()).toEqual(beforeRedo);
		expect((await document()).shape?.facing).toBe(1);
	});
});

describe('what an undo reports when there is nothing to reverse', () => {
	/**
	 * The plan's own case. `ok` is not evidence that anything was written — a `'wrote'` here
	 * would clear a `save-error` a real persistence failure left behind, over a gesture that
	 * touched nothing.
	 */
	it('reports no-write on an undo that had nothing to reverse', async () => {
		const { reversible, assetId, seed } = await seeded();
		await seed(drawn());

		// The FACING, deliberately: it owns no pending flag, so re-submitting the stored value
		// really is a no-write. Re-submitting the stored ANCHOR is not one on an uncalibrated
		// surface — `anchorPending` is recorded at capture, so the same coordinates move a
		// flag — which is a fact about the command rather than about this adapter.
		const command = reversible.setFacing({ assetId, facing: 0 });
		expect(await command.execute()).toEqual(ok('no-write'));

		expect(await command.undo()).toEqual(ok('no-write'));
	});

	/**
	 * And the same answer for a gesture whose forward half was REFUSED. Asserted through the
	 * vault as well as through the answer: a build that captured an inverse before knowing the
	 * write landed would restore a document nothing had replaced, and the revision is what
	 * says so.
	 */
	it('captures nothing when the forward command refuses, so the undo writes nothing', async () => {
		const { reversible, assetId, seed, geometryVersion } = await seeded();
		await seed(null);
		const before = await geometryVersion();

		const command = reversible.setClearance({ assetId, points: WIDER });
		expect(expectErr(await command.execute()).code).toBe('asset.no-footprint');

		expect(await command.undo()).toEqual(ok('no-write'));
		expect(await geometryVersion()).toEqual(before);
	});

	/**
	 * The NOTE half of both answers, asked separately because it is a separate adapter over a
	 * separate resource — the geometry cases above are equally true of a build whose note
	 * adapter captured an inverse for a write that never happened.
	 */
	it('captures nothing for a height the asset already carries, nor for one it refuses', async () => {
		const { reversible, assetId, height, designChanges } = await seeded();

		const idle = reversible.setHeight({ assetId, height: 700 });
		expect(await idle.execute()).toEqual(ok('no-write'));
		expect(await idle.undo()).toEqual(ok('no-write'));

		const refused = reversible.setHeight({ assetId, height: -5 });
		expect(expectErr(await refused.execute()).code).toBe('asset.negative-height');
		expect(await refused.undo()).toEqual(ok('no-write'));

		expect(await height()).toBe(700);
		expect(designChanges).toEqual([]);
	});

	/**
	 * The BACKGROUND adapter's own three no-write shapes: an undo with nothing captured yet
	 * (never executed), a forward refusal (the command's own cheap kind check), and the
	 * command's own no-write outcome (re-submitting an unchanged, already-uncalibrated
	 * reference) — asked separately because this is the one adapter whose forward door writes
	 * TWO resources and reports a `secondaryVersion` the other adapters never touch.
	 */
	it('reports no-write on a background undo that never executed', async () => {
		const { reversible, assetId } = await seeded();

		const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(await command.undo()).toEqual(ok('no-write'));
	});

	it('captures nothing when the background command refuses an unsupported kind', async () => {
		const { reversible, assetId } = await seeded();

		const command = reversible.setBackground({ assetId, path: 'Specs/oven.docx', kind: 'docx', page: null });
		expect(expectErr(await command.execute()).code).toBe('asset.unsupported-background');

		expect(await command.undo()).toEqual(ok('no-write'));
	});

	it('reports no-write when re-submitting the reference the asset already carries', async () => {
		const { reversible, assetId } = await seeded();
		const first = reversible.setBackground({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });
		expect(expectOk(await first.execute())).toBe('wrote');

		const again = reversible.setBackground({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });
		expect(expectOk(await again.execute())).toBe('no-write');

		expect(await again.undo()).toEqual(ok('no-write'));
	});

	/** A spent inverse is dropped, so a second undo re-writes nothing and bumps nothing. */
	it('reports no-write on a second undo, rather than re-writing the same restore', async () => {
		const { reversible, assetId, seed, geometryVersion } = await seeded();
		await seed(drawn());
		const command = reversible.setFacing({ assetId, facing: 1 });
		await command.execute();
		await command.undo();
		const afterUndo = await geometryVersion();

		expect(await command.undo()).toEqual(ok('no-write'));
		expect(await geometryVersion()).toEqual(afterUndo);
	});
});

describe('the ledger, and the restores it has to hold', () => {
	/**
	 * The plan's third case, which is slice 8's rule applied here: EVERY write records, the
	 * restore included, or the next command's expectation is a revision the vault no longer
	 * has.
	 */
	it('records every write into the ledger, restores included', async () => {
		const { reversible, assetId, seed, geometryLedger } = await seeded();
		await seed(drawn());

		const command = reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } });
		await command.execute();
		const afterWrite = geometryLedger.lastWritten(assetId);

		await command.undo();

		expect(afterWrite).not.toBeNull();
		expect(geometryLedger.lastWritten(assetId)).not.toEqual(afterWrite);
	});

	/**
	 * What the ledger BUYS, rather than what it holds: two gestures in one history, undone in
	 * order. The second gesture's write moved the sidecar past the first's, so the first's undo
	 * is only possible against a version the HISTORY tracked — a per-adapter expectation
	 * refuses here, which is design slice 6's whole argument re-asked on this document.
	 */
	it('undoes past a sibling gesture that wrote the same sidecar', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());
		const before = await document();
		const history = new CommandHistory();

		expect(expectOk(await history.run(reversible.setFacing({ assetId, facing: 1 })))).toBe('wrote');
		expect(expectOk(await history.run(reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } })))).toBe('wrote');

		expect(expectOk(await history.undo())).toBe('wrote');
		expect(expectOk(await history.undo())).toBe('wrote');
		expect(await document()).toEqual(before);
	});

	/**
	 * **The two-ledger case, and the one this whole split exists for.** An asset is two
	 * resources under one `EntityId` and `SessionWriteLedger` holds one `EntityVersion` per id,
	 * so a SINGLE ledger has the note's version and the sidecar's overwrite each other: undo
	 * the height, and what the ledger holds is the NOTE's version; undo the geometry beneath
	 * it, and that note version is presented to the SIDECAR, refused as stale, and the undo
	 * stack is stuck with no way forward.
	 *
	 * Asserted through a real `CommandHistory` because the ORDER is the mechanism, and on the
	 * document as well as on the two answers — two `ok`s are equally true of a build that
	 * restored the wrong thing.
	 */
	it('undoes a geometry edit beneath a height edit, rather than presenting the note version to the sidecar', async () => {
		const { reversible, assetId, seed, document, height } = await seeded();
		await seed(drawn());
		const before = await document();
		const history = new CommandHistory();

		expect(expectOk(await history.run(reversible.setFootprint({ assetId, points: TRIANGLE })))).toBe('wrote');
		expect(expectOk(await history.run(reversible.setHeight({ assetId, height: 900 })))).toBe('wrote');

		expect(expectOk(await history.undo())).toBe('wrote');
		expect(expectOk(await history.undo())).toBe('wrote');

		expect(await height()).toBe(700);
		expect(await document()).toEqual(before);
	});
});

describe('an undo is CONDITIONAL, because somebody else may have written', () => {
	/**
	 * An undo that overwrites a later edit is a lost update wearing an undo's clothes. The
	 * refusal is asserted on the CODE and on the document: "it refused" is equally true of a
	 * build that refused for the wrong reason.
	 */
	it('refuses rather than overwriting a sidecar write this history did not make', async () => {
		const { reversible, assetId, seed, document, plain } = await seeded();
		await seed(drawn());
		const command = reversible.setFootprint({ assetId, points: TRIANGLE });
		await command.execute();

		// A peer designer leaf, writing the same asset outside this history.
		expect(expectOk(await plain.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');
		const outsider = await document();

		expect(expectErr(await command.undo()).code).toBe('asset-geometry.revision-conflict');
		expect(await document()).toEqual(outsider);
	});

	/** The note half of the same rule, through the repository rather than the sidecar. */
	it('refuses rather than overwriting a NOTE write this history did not make', async () => {
		const { reversible, assetId, plain, height } = await seeded();
		const command = reversible.setHeight({ assetId, height: 900 });
		await command.execute();

		expect(expectOk(await plain.setHeight.execute({ assetId, height: 1200 }))).toBe('wrote');

		expect(expectErr(await command.undo()).code).toBe('asset.revision-conflict');
		expect(await height()).toBe(1200);
	});

	/**
	 * The BACKGROUND adapter's own version of the note half: a peer note write between execute
	 * and undo refuses the restore with an ordinary revision conflict, exactly as the height
	 * adapter's does. The sidecar is untouched by this peer, so this alone does not reach the
	 * compensate path below — that needs a peer on the OTHER resource.
	 */
	it('refuses a background undo rather than overwriting a NOTE write this history did not make', async () => {
		const { reversible, assetId, plain, height } = await seeded();
		const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
		await command.execute();

		expect(expectOk(await plain.setHeight.execute({ assetId, height: 1200 }))).toBe('wrote');

		expect(expectErr(await command.undo()).code).toBe('asset.revision-conflict');
		expect(await height()).toBe(1200);
	});

	/**
	 * **The background adapter's own compensate-on-undo failure.** Task 3 gave the undo a
	 * pre-flight sidecar read, so a peer write landing BEFORE the undo is even called is caught
	 * cleanly now — a pre-write `undo.superseded`, asserted in
	 * `reversibleAssetDesignWindows.test.ts`'s "a background undo after a peer has written the
	 * sidecar". A read-then-write is not atomic, though, so a peer landing IN that gap — after
	 * the pre-flight read has matched, before the restoring write reaches the store — still
	 * reaches the store's own refusal. The note restore is free to succeed first, so this is a
	 * genuinely HALF-undone state: the note points at the old reference again, but the
	 * calibration it implies is still gone. Reported via `markUncompensated` rather than
	 * swallowed, mirroring the forward command's own compensate failure for the identical
	 * reason.
	 */
	it('reports an uncompensated background undo when a peer writes the sidecar between the undo\'s pre-flight read and its restore', async () => {
		const peer: { run: () => Promise<unknown> } = { run: () => Promise.resolve() };
		// Three reads reach the wrapped sidecar before the peer must run: the adapter's own
		// pre-state read and the command's own snapshot read, both during `execute`, then the
		// undo's own pre-flight read — `after: 3` fires the peer the instant that third read has
		// resolved, landing it exactly in the gap between the read and the restoring write.
		const { reversible, assetId, seed, plain, document, stack } = await seeded({
			sidecar: (real) => sidecarWritingBetweenReads(real, 3, () => peer.run()),
		});
		await seed(drawn()); // a shape to seed a document, so `plain.setFacing` has something to write
		const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
		expect(expectOk(await command.execute())).toBe('wrote');

		peer.run = async () => {
			expect(expectOk(await plain.setFacing.execute({ assetId, facing: 1.2 }))).toBe('wrote');
		};

		const result = await command.undo();
		expect(isErr(result) && leftWritesBehind(result.error)).toBe(true);
		// The note WAS restored — the background reference is back to what it was before this
		// gesture, which is no reference at all.
		expect(expectOk(await stack.assets.getById(assetId))?.entity.background).toBeNull();
		// ...and the sidecar is exactly what the peer left it, untouched by the refused restore.
		expect((await document()).shape?.facing).toBe(1.2);
	});
});

/**
 * The FORWARD write is conditional too, and these two cases are the reason.
 *
 * Both were reported against the first version of this module, which passed `this.input`
 * straight through and let each command condition on its OWN read.
 */
describe('the window between this gesture\'s snapshot and the command\'s own read', () => {
	/**
	 * **A peer writing in that window used to be silently un-written by the undo.** The command
	 * reads AFTER this adapter does, so it merged the peer's document and saved it forward,
	 * while the inverse held the pre-peer one. The undo is conditioned on the ledger — which
	 * holds the version the forward write produced — so it succeeded, put the pre-peer document
	 * back, and the peer's clearance was gone with no refusal anywhere.
	 *
	 * Asserted on the REFUSAL rather than on the document, because a build that captured the
	 * peer's document as its inverse would also leave the clearance intact and pass a
	 * document-only assertion while the lost update sat one gesture away.
	 */
	it('refuses the forward write rather than capturing an inverse that predates a peer', async () => {
		// The peer is staged through the harness's own `sidecar` knob and a hook box, because
		// the asset id it needs does not exist until `seeded` has run. `after: 1` means
		// "immediately after this adapter has taken its snapshot", which is the window.
		const hook: { run: () => Promise<unknown> } = { run: () => Promise.resolve() };
		const w = await seeded({ sidecar: (real) => sidecarWritingBetweenReads(real, 1, () => hook.run()) });
		expectOk(await w.sidecar.write(w.assetId, { calibration: null, shape: drawn() }));
		const peerRan = { done: false };
		hook.run = async () => {
			const current = expectOk(await w.sidecar.read(w.assetId));
			expectOk(
				await w.sidecar.write(
					w.assetId,
					{ ...current.document, shape: { ...drawn(), clearance: { points: [...WIDER] } } },
					current.version,
				),
			);
			peerRan.done = true;
		};

		const gesture = w.reversible.setFootprint({ assetId: w.assetId, points: [...TRIANGLE] });
		const outcome = await gesture.execute();

		expect(peerRan.done).toBe(true);
		expect(expectErr(outcome).code).toBe('asset-geometry.revision-conflict');
		// And the peer's document is still what is stored, which is the consequence the refusal
		// exists to buy rather than a restatement of it.
		expect((await w.document()).shape?.clearance).toEqual({ points: [...WIDER] });
	});

	/**
	 * **A caller's own `expected` is spent by the first execute**, and holding it across every
	 * one makes redo refuse deterministically: the undo advances the resource, so the version
	 * the caller named is two writes behind by the time the redo asks.
	 *
	 * Both halves are asserted. The first execute must still HONOUR the caller's claim — that is
	 * what an `expected` is for — so a build that simply ignored it would pass the redo half
	 * alone. The refusal case below is what holds that end.
	 */
	it('redoes a gesture the caller gave an expected version for', async () => {
		const { reversible, assetId, sidecar, geometryVersion } = await seeded();
		await sidecar.write(assetId, { calibration: null, shape: drawn() });

		const gesture = reversible.setAnchor({ assetId, anchor: { x: 9, y: 9 }, expected: await geometryVersion() });
		expect(expectOk(await gesture.execute())).toBe('wrote');
		expect(expectOk(await gesture.undo())).toBe('wrote');

		expect(expectOk(await gesture.execute())).toBe('wrote');
		const after = expectOk(await sidecar.read(assetId));
		expect(after.document.shape?.anchor).toEqual({ x: 9, y: 9 });
	});

	it('still refuses a FIRST execute whose caller named a version the store has moved past', async () => {
		const { reversible, assetId, sidecar, geometryVersion } = await seeded();
		await sidecar.write(assetId, { calibration: null, shape: drawn() });
		const stale = await geometryVersion();
		// Somebody else writes, so the caller's claim about what it read is now false.
		const current = expectOk(await sidecar.read(assetId));
		expectOk(await sidecar.write(assetId, current.document, current.version));

		const gesture = reversible.setAnchor({ assetId, anchor: { x: 9, y: 9 }, expected: stale });

		expect(expectErr(await gesture.execute()).code).toBe('asset-geometry.revision-conflict');
	});
});

describe('every successful restore announces itself', () => {
	/**
	 * The initiating leaf refreshes through its own dispatcher; every OTHER leaf showing this
	 * asset learns from the event. An undo that published nothing would leave a peer sitting on
	 * the forward state until something unrelated woke it — the staleness Task B3a closed for
	 * the forward path, re-entering through the inverse.
	 *
	 * Both halves in one case, because they are two different code paths: the geometry restore
	 * announces from this module, the note restore likewise, and a build that announced from
	 * only one is exactly what a single-resource case would pass.
	 */
	it('publishes a design change for a geometry restore and for a note restore alike', async () => {
		const { reversible, assetId, seed, designChanges } = await seeded();
		await seed(drawn());

		const geometry = reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } });
		await geometry.execute();
		const height = reversible.setHeight({ assetId, height: 900 });
		await height.execute();
		expect(designChanges).toEqual([assetId, assetId]);

		expect(expectOk(await height.undo())).toBe('wrote');
		expect(expectOk(await geometry.undo())).toBe('wrote');

		expect(designChanges).toEqual([assetId, assetId, assetId, assetId]);
	});

	/** And a `no-write` undo announces NOTHING: a peer re-reading a document nothing moved. */
	it('announces nothing for an undo that wrote nothing', async () => {
		const { reversible, assetId, seed, designChanges } = await seeded();
		await seed(drawn());
		const command = reversible.setFacing({ assetId, facing: 0 });
		await command.execute();

		await command.undo();

		expect(designChanges).toEqual([]);
	});
});

describe('a read this adapter cannot complete', () => {
	/** The pre-state read is what an inverse is BUILT from, so a fault there is the answer. */
	it('surfaces a failed pre-state read rather than running the command blind', async () => {
		const { reversible, assetId, geometryVersion } = await seeded({
			sidecar: (real) => sidecarFailingReadsAfter(real, 0),
		});
		const before = await geometryVersion();

		expect(expectErr(await reversible.setFacing({ assetId, facing: 1 }).execute()).code)
			.toBe('vault.unexpected-failure');

		expect(await geometryVersion()).toEqual(before);
	});

	/**
	 * **INVERTED, and the inversion is the point.** This case used to assert that a failing
	 * READ-BACK left the ledger empty and that the undo then refused — a property of an adapter
	 * that learned its version by asking the port again after the command returned. That read
	 * is gone: the command reports the version its own write produced, because the window
	 * between those two operations was a lost update (a peer landing in it was recorded as this
	 * gesture's, and the undo restored over their edit — the block near the end of this file).
	 *
	 * So there is now no read after the write for a fault to land on, and what this case pins
	 * is the consequence: a gesture whose sidecar has gone unreadable AFTER its write still
	 * knows what it wrote, and its undo is an ordinary conditional restore rather than a
	 * refusal. Asserted on the DOCUMENT and not only on the outcome, because "the undo
	 * succeeded" is equally true of a build that wrote the wrong bytes back.
	 *
	 * `sidecarFailingReadsAfter(real, 2)` still names the two reads a forward gesture makes —
	 * this adapter's pre-read and the command's own — and every read past them now belongs to a
	 * LATER gesture rather than to this one.
	 */
	it('knows the version it wrote without a read-back, so the undo still applies', async () => {
		const { reversible, assetId, seed, document, geometryLedger } = await seeded({
			sidecar: (real) => sidecarFailingReadsAfter(real, 2),
		});
		await seed(drawn());
		const before = await document();

		const command = reversible.setFacing({ assetId, facing: 1 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(geometryLedger.lastWritten(assetId)).not.toBeNull();

		expect(expectOk(await command.undo())).toBe('wrote');
		expect(await document()).toEqual(before);
	});

	/** The note's pre-state read, which must not report an absent asset for a fault. */
	it('surfaces a failed NOTE read rather than reporting the asset missing', async () => {
		const { reversible, assetId, corrupt } = await seeded();
		corrupt();

		expect(expectErr(await reversible.setHeight({ assetId, height: 900 }).execute()).code)
			.toBe('asset.entity-invalid');
	});

	/** And an asset that really is absent is that, rather than a fault. */
	it('refuses an asset that is not there rather than capturing an inverse of nothing', async () => {
		const { reversible, stack } = await seeded();
		const written = expectOk(await stack.assets.save(makeAsset(), 'absent'));
		const absent = written.entity.id;
		expectOk(await stack.assets.delete(absent, written.version));

		const command = reversible.setHeight({ assetId: absent, height: 900 });
		expect(expectErr(await command.execute()).code).toBe('asset.not-found');
		expect(await command.undo()).toEqual(ok('no-write'));
	});

	/**
	 * The BACKGROUND adapter's own three reads, asked separately because it is the one adapter
	 * that spans two resources and reads BOTH before dispatching — a failure at either one, or
	 * an absent asset, must surface exactly as it does for the single-resource adapters above.
	 */
	it('surfaces a failed NOTE read for a background gesture rather than reporting the asset missing', async () => {
		const { reversible, assetId, corrupt } = await seeded();
		corrupt();

		expect(
			expectErr(
				await reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null }).execute(),
			).code,
		).toBe('asset.entity-invalid');
	});

	it('refuses an asset that is not there for a background gesture rather than writing an orphan sidecar', async () => {
		const { reversible, stack } = await seeded();
		const written = expectOk(await stack.assets.save(makeAsset(), 'absent'));
		const absent = written.entity.id;
		expectOk(await stack.assets.delete(absent, written.version));

		const command = reversible.setBackground({ assetId: absent, path: 'Specs/other.png', kind: 'image', page: null });
		expect(expectErr(await command.execute()).code).toBe('asset.not-found');
		expect(await command.undo()).toEqual(ok('no-write'));
	});

	/** The background adapter's own geometry pre-read — the one this class alone performs. */
	it('surfaces a failed sidecar pre-read for a background gesture', async () => {
		const { reversible, assetId } = await seeded({ sidecar: (real) => sidecarFailingReadsAfter(real, 0) });

		const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });

		expect(expectErr(await command.execute()).code).toBe('vault.unexpected-failure');
	});

	/**
	 * An asset DELETED after this gesture's write and before its undo must not be RESURRECTED
	 * by that undo, and the case is kept because that consequence is unchanged — only its
	 * mechanism moved. It used to hold because the read-back found nothing and left the ledger
	 * empty; the read-back is gone (see the inverted case above and the last block in this
	 * file), so what refuses now is the conditional restore itself, against a note that is not
	 * there to carry the version this gesture recorded.
	 *
	 * The ledger assertion is INVERTED with it: the adapter records what its own write
	 * produced, so the entry exists. Asserted anyway rather than dropped, because "the ledger
	 * is left alone" was the old case's whole load-bearing claim and a silent removal would
	 * leave a later reader unable to tell which behaviour is intended.
	 *
	 * The deletion is staged through the command door rather than through a repository
	 * decorator, because the door is what the adapter awaits — a decorator would have to guess
	 * which call to intercept, and a wrong guess is a green test about a different program.
	 */
	it('does not resurrect an asset deleted between its write and its undo', async () => {
		const seeds = await seeded();
		const { assetId, plain, stack, noteLedger } = seeds;
		const reversible = seeds.reversibleWith({
			setHeight: {
				executeWithVersion: async (input): Promise<VersionedDispatchResult> => {
					const ran = await plain.setHeight.executeWithVersion(input);
					const loaded = present(expectOk(await stack.assets.getById(assetId)));
					expectOk(await stack.assets.delete(assetId, loaded.version));
					return ran;
				},
			},
		});

		const command = reversible.setHeight({ assetId, height: 900 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(noteLedger.lastWritten(assetId)).not.toBeNull();

		expect(await command.undo()).toEqual(expect.objectContaining({ ok: false }));
		expect(expectOk(await stack.assets.getById(assetId))).toBeNull();
	});
});
