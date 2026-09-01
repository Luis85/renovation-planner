/**
 * Task B3b: the reversible adapters, without which undo is a lie.
 *
 * Driven through the REAL `ObsidianAssetGeometrySidecar` and the REAL
 * `ObsidianAssetRepository` over the in-memory vault, for the reason the two design-command
 * suites give one boundary down: what these cases are about is the DOCUMENT and the NOTE that
 * end up on disk, and every property here — which revision a write was conditioned on, which
 * document a restore put back, whether a `no-write` bumped anything — is a property of a store
 * that really keeps a revision and really replaces a whole document. A hand-written fake would
 * have answered whatever it was told to.
 *
 * The bus is the REAL one for the same reason both of those files state: `RecordingEventBus`
 * discards its handler, so a case built on it asserts an empty list in both worlds. What a peer
 * designer leaf rests on is what a SUBSCRIBER heard.
 */
import { describe, expect, it } from 'vitest';
import {
	ReversibleAssetDesignCommands,
	type AssetDesignCommandBundle,
} from '../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { SetAssetAnchorCommand } from '../../../src/application/commands/asset/SetAssetAnchor';
import { SetAssetClearanceCommand } from '../../../src/application/commands/asset/SetAssetClearance';
import { SetAssetFacingCommand } from '../../../src/application/commands/asset/SetAssetFacing';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
} from '../../../src/application/commands/asset/SetAssetFootprint';
import { SetAssetHeightCommand } from '../../../src/application/commands/asset/SetAssetHeight';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../../src/application/ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../../src/application/ports/versioning';
import { createEventBus, type EventBus } from '../../../src/core/events/EventBus';
import type { Point } from '../../../src/core/geometry/Point';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../../src/domain/asset/Asset.events';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from '../../helpers/vault';

const SQUARE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
];

const TRIANGLE: readonly Point[] = [
	{ x: -20, y: -20 },
	{ x: 140, y: -20 },
	{ x: 140, y: 140 },
];

const WIDER: readonly Point[] = [
	{ x: -50, y: -50 },
	{ x: 150, y: -50 },
	{ x: 150, y: 150 },
	{ x: -50, y: 150 },
];

/** A shape somebody has already drawn on, so every adapter has a pre-state to restore. */
const drawn = (): AssetShape => ({
	footprint: { points: [...SQUARE] },
	footprintOrigin: 'traced',
	footprintPending: false,
	clearance: { points: [...TRIANGLE] },
	clearancePending: false,
	anchor: { x: 5, y: 5 },
	anchorPending: false,
	facing: 0,
});

/** A vault fault a test can inject, shaped exactly as the ports' own union permits. */
const VAULT_FAULT = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the sidecar could not be read',
} as const;

/**
 * `AssetRepository.getById` answers `null` for an asset that is not there, and the cases below
 * that reach for a version have just written one. A helper rather than a `!`, which the linter
 * refuses and which would report a later defect as a property access on nothing.
 */
function present<T>(value: T | null): T {
	if (value === null) throw new Error('expected the asset to be present');
	return value;
}

/** What a SUBSCRIBER heard, which is what a peer designer leaf actually rests on. */
function designChangesHeardOn(bus: EventBus): AssetId[] {
	const heard: AssetId[] = [];
	bus.subscribe('AssetDesignChanged', (event) => {
		heard.push((event as AssetDesignChanged).payload.assetId);
	});
	return heard;
}

/**
 * A sidecar whose reads start failing after the Nth, so the read-back an adapter performs to
 * learn the version its command wrote can be made to fault while the pre-state read succeeds.
 *
 * A delegating object literal rather than a subclass: what is being modelled is one method
 * answering a fault, and everything else must go on being the real store.
 */
function sidecarFailingReadsAfter(real: AssetGeometrySidecar, reads: number): AssetGeometrySidecar {
	let seen = 0;
	return {
		read: (assetId) => (++seen > reads ? Promise.resolve(err(VAULT_FAULT)) : real.read(assetId)),
		write: (assetId, document, expected) => real.write(assetId, document, expected),
	};
}

/**
 * A sidecar that lets a peer write land in the window BETWEEN the adapter's pre-state read and
 * the wrapped command's own read — which is the window the forward conditioning closes, and the
 * only way to drive it: both reads go through this port, one after the other, with nothing else
 * between them that a test could reach.
 *
 * `after` counts reads, so `1` means "immediately after the adapter has taken its snapshot".
 */
function sidecarWritingBetweenReads(
	real: AssetGeometrySidecar,
	after: number,
	peer: () => Promise<unknown>,
): AssetGeometrySidecar {
	let seen = 0;
	return {
		read: async (assetId) => {
			const answer = await real.read(assetId);
			if (++seen === after) await peer();
			return answer;
		},
		write: (assetId, document, expected) => real.write(assetId, document, expected),
	};
}

/**
 * Every command and both ledgers are constructed HERE, once. A command built beside a case is
 * a command a mutation run silently leaves un-mutated, which this epic has already paid for.
 */
async function seeded(options: { readonly sidecar?: (real: AssetGeometrySidecar) => AssetGeometrySidecar } = {}) {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const real = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const sidecar = options.sidecar?.(real) ?? real;
	const written = expectOk(await stack.assets.save(makeAsset({ height: 700 }), 'absent'));
	const assetId = written.entity.id;
	const path = stack.index.getPath(assetId) ?? '';

	const commandDeps = { sidecar, assets: stack.assets, events };
	const noteLedger = new SessionWriteLedger();
	const geometryLedger = new SessionWriteLedger();
	// Typed as the BUNDLE rather than as the concrete classes, so a case that replaces one door
	// with a stand-in is replacing a door and not narrowing to a class the compiler then wants
	// every private field of.
	const bundle: AssetDesignCommandBundle = {
		setFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand(commandDeps),
		setFootprint: new SetAssetFootprintCommand(commandDeps),
		setClearance: new SetAssetClearanceCommand(commandDeps),
		setAnchor: new SetAssetAnchorCommand(commandDeps),
		setFacing: new SetAssetFacingCommand(commandDeps),
		setHeight: new SetAssetHeightCommand(stack.assets, events),
	};

	// ANNOTATED, and constructed here rather than inline in the returned literal: fallow
	// resolves a class's members through the annotation where the consuming expression sits,
	// and six factory methods whose only callers are this file are reported as
	// `unused-class-members` when the `new` expression's result reaches them through an
	// inferred object property. Measured both ways rather than guessed.
	const reversible: ReversibleAssetDesignCommands = new ReversibleAssetDesignCommands(
		{ sidecar, assets: stack.assets, events, noteLedger, geometryLedger },
		bundle,
	);

	return {
		stack,
		events,
		assetId,
		sidecar: real,
		noteLedger,
		geometryLedger,
		bundle,
		designChanges: designChangesHeardOn(events),
		reversible,
		/** The adapters over a bundle a case has replaced one door of. */
		reversibleWith(overrides: Partial<AssetDesignCommandBundle>): ReversibleAssetDesignCommands {
			return new ReversibleAssetDesignCommands(
				{ sidecar, assets: stack.assets, events, noteLedger, geometryLedger },
				{ ...bundle, ...overrides },
			);
		},
		async seed(shape: AssetShape | null): Promise<void> {
			expectOk(await real.write(assetId, { calibration: null, shape }));
		},
		async document(): Promise<AssetGeometryDocument> {
			return expectOk(await real.read(assetId)).document;
		},
		async geometryVersion(): Promise<EntityVersion> {
			return expectOk(await real.read(assetId)).version;
		},
		async height(): Promise<number | null | undefined> {
			return expectOk(await stack.assets.getById(assetId))?.entity.height;
		},
		/** A hand edit no schema would accept, so the next read of this NOTE fails. */
		corrupt(): void {
			const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(path) ?? '');
			stack.vault.entries.set(path, serializeFrontmatter({ ...frontmatter, category: 'not-a-category' }) + body);
			stack.metadataCache.catchUp();
		},
	};
}

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
	 * A REDO re-captures, and the case has to make the two builds DIFFER to say so. A redo whose
	 * document is the one its own first execute replaced passes against a capture-once adapter
	 * as well — the pre-state is the same document both times — so a peer leaf writes BETWEEN
	 * the undo and the redo, and the undo that follows must put back what the redo actually
	 * replaced. A capture-once inverse restores the document from before that peer's edit and
	 * silently deletes it.
	 */
	it('re-captures on a redo, so the undo after it restores what the REDO replaced', async () => {
		const { reversible, assetId, seed, document, bundle } = await seeded();
		await seed(drawn());

		const command = reversible.setAnchor({ assetId, anchor: { x: 40, y: 40 } });
		await command.execute();
		await command.undo();

		// A peer designer leaf, in between — which is why the redo's pre-state is not the
		// first execute's.
		expect(expectOk(await bundle.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');
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
		const { reversible, assetId, seed, document, bundle } = await seeded();
		await seed(drawn());
		const command = reversible.setFootprint({ assetId, points: TRIANGLE });
		await command.execute();

		// A peer designer leaf, writing the same asset outside this history.
		expect(expectOk(await bundle.setFacing.execute({ assetId, facing: 1 }))).toBe('wrote');
		const outsider = await document();

		expect(expectErr(await command.undo()).code).toBe('asset-geometry.revision-conflict');
		expect(await document()).toEqual(outsider);
	});

	/** The note half of the same rule, through the repository rather than the sidecar. */
	it('refuses rather than overwriting a NOTE write this history did not make', async () => {
		const { reversible, assetId, bundle, height } = await seeded();
		const command = reversible.setHeight({ assetId, height: 900 });
		await command.execute();

		expect(expectOk(await bundle.setHeight.execute({ assetId, height: 1200 }))).toBe('wrote');

		expect(expectErr(await command.undo()).code).toBe('asset.revision-conflict');
		expect(await height()).toBe(1200);
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
		const { stack, sidecar, assetId } = await seeded();
		expectOk(await sidecar.write(assetId, { calibration: null, shape: drawn() }));

		const peerRan = { done: false };
		const intercepted = sidecarWritingBetweenReads(sidecar, 1, async () => {
			const current = expectOk(await sidecar.read(assetId));
			expectOk(
				await sidecar.write(
					assetId,
					{ ...current.document, shape: { ...drawn(), clearance: { points: [...WIDER] } } },
					current.version,
				),
			);
			peerRan.done = true;
		});
		const events = createEventBus();
		const adapters: ReversibleAssetDesignCommands = new ReversibleAssetDesignCommands(
			{
				sidecar: intercepted,
				assets: stack.assets,
				events,
				noteLedger: new SessionWriteLedger(),
				geometryLedger: new SessionWriteLedger(),
			},
			{
				setFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand({ sidecar: intercepted, assets: stack.assets, events }),
				setFootprint: new SetAssetFootprintCommand({ sidecar: intercepted, assets: stack.assets, events }),
				setClearance: new SetAssetClearanceCommand({ sidecar: intercepted, assets: stack.assets, events }),
				setAnchor: new SetAssetAnchorCommand({ sidecar: intercepted, assets: stack.assets, events }),
				setFacing: new SetAssetFacingCommand({ sidecar: intercepted, assets: stack.assets, events }),
				setHeight: new SetAssetHeightCommand(stack.assets, events),
			},
		);

		const gesture = adapters.setFootprint({ assetId, points: [...TRIANGLE] });
		const outcome = await gesture.execute();

		expect(peerRan.done).toBe(true);
		expect(expectErr(outcome).code).toBe('asset-geometry.revision-conflict');
		// And the peer's document is still what is stored, which is the consequence the refusal
		// exists to buy rather than a restatement of it.
		const after = expectOk(await sidecar.read(assetId));
		expect(after.document.shape?.clearance).toEqual({ points: [...WIDER] });
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
	 * A READ-BACK that faults is a different question, and the answer is deliberately not the
	 * dispatch's failure: the write LANDED, so reporting a failure would keep the gesture off
	 * the undo stack and badge a save error over data the vault holds. The ledger is left
	 * exactly where it was instead, which is fail-closed — the undo then presents a version the
	 * sidecar has moved past and is REFUSED rather than overwriting a state this adapter cannot
	 * describe.
	 *
	 * Both halves asserted: the forward write is reported as the write it was, AND the undo
	 * refuses. Either alone passes a build that got the other one wrong.
	 */
	it('reports the write it made when the read-back faults, and then refuses the undo', async () => {
		const { reversible, assetId, seed, document, geometryLedger } = await seeded({
			sidecar: (real) => sidecarFailingReadsAfter(real, 2),
		});
		await seed(drawn());
		const written = await document();

		const command = reversible.setFacing({ assetId, facing: 1 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(geometryLedger.lastWritten(assetId)).toBeNull();

		expect(expectErr(await command.undo()).code).toBe('asset-geometry.revision-conflict');
		expect((await document()).shape?.facing).not.toEqual(written.shape?.facing);
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
	 * An asset DELETED between the write and the read-back leaves the ledger alone for the same
	 * reason a fault does, and the consequence is the one worth pinning: the undo refuses
	 * rather than RESURRECTING a catalogue entry somebody deleted.
	 *
	 * The deletion is staged through the command door rather than through a repository
	 * decorator, because the door is what the adapter awaits — a decorator would have to guess
	 * which call to intercept, and a wrong guess is a green test about a different program.
	 */
	it('does not resurrect an asset deleted between the write and the read-back', async () => {
		const seeds = await seeded();
		const { assetId, bundle, stack, noteLedger } = seeds;
		const reversible = seeds.reversibleWith({
			setHeight: {
				execute: async (input): Promise<DispatchResult> => {
					const ran = await bundle.setHeight.execute(input);
					const loaded = present(expectOk(await stack.assets.getById(assetId)));
					expectOk(await stack.assets.delete(assetId, loaded.version));
					return ran;
				},
			},
		});

		const command = reversible.setHeight({ assetId, height: 900 });
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(noteLedger.lastWritten(assetId)).toBeNull();

		expect(await command.undo()).toEqual(expect.objectContaining({ ok: false }));
		expect(expectOk(await stack.assets.getById(assetId))).toBeNull();
	});
});
