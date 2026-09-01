/**
 * The asset design adapters' shared harness — every command, both ledgers and every fixture
 * constructed in ONE place.
 *
 * It lives here rather than beside the cases because it now serves TWO files:
 * `reversibleAssetDesign.test.ts` and `reversibleAssetDesignWindows.test.ts`, which the
 * 450-line test budget split apart. The comment that used to sit on `seeded` still governs and
 * is the reason this is a helper rather than a copy in each file — "a command built beside a
 * case is a command a mutation run silently leaves un-mutated, which this epic has already
 * paid for", and two harnesses would be two chances for a mutation to miss one.
 *
 * Everything here is driven through the REAL `ObsidianAssetGeometrySidecar` and the REAL
 * `ObsidianAssetRepository` over the in-memory vault: what these cases are about is the
 * DOCUMENT and the NOTE that end up on disk, and every property they assert — which revision a
 * write was conditioned on, which document a restore put back, whether a `no-write` bumped
 * anything — is a property of a store that really keeps a revision and really replaces a whole
 * document. A hand-written fake would have answered whatever it was told to. The bus is the
 * REAL one for the same reason: `RecordingEventBus` discards its handler, so a case built on it
 * asserts an empty list in both worlds.
 */
import {
	ReversibleAssetDesignCommands,
	type AssetDesignCommandBundle,
} from '../../src/application/editor/asset/ReversibleAssetDesignCommands';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { SetAssetAnchorCommand } from '../../src/application/commands/asset/SetAssetAnchor';
import { SetAssetClearanceCommand } from '../../src/application/commands/asset/SetAssetClearance';
import { SetAssetFacingCommand } from '../../src/application/commands/asset/SetAssetFacing';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
} from '../../src/application/commands/asset/SetAssetFootprint';
import { SetAssetHeightCommand } from '../../src/application/commands/asset/SetAssetHeight';
import { CalibrateAssetCommand } from '../../src/application/commands/asset/CalibrateAsset';
import { SetAssetBackgroundCommand } from '../../src/application/commands/asset/SetAssetBackground';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../src/application/ports/AssetGeometrySidecar';
import type { AssetRepository } from '../../src/application/ports/AssetRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import { createEventBus, type EventBus } from '../../src/core/events/EventBus';
import type { Point } from '../../src/core/geometry/Point';
import { err, isErr } from '../../src/core/result/Result';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../src/domain/asset/Asset.events';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import type { Calibration } from '../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { expectOk } from './domain';
import { makeAsset } from './entities';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from './vault';

export const SQUARE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
];

export const TRIANGLE: readonly Point[] = [
	{ x: -20, y: -20 },
	{ x: 140, y: -20 },
	{ x: 140, y: 140 },
];

export const WIDER: readonly Point[] = [
	{ x: -50, y: -50 },
	{ x: 150, y: -50 },
	{ x: 150, y: 150 },
	{ x: -50, y: 150 },
];

/** A calibration Task B7's `seedCalibration` seeds, so every case has one to lose. */
export const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/** A shape somebody has already drawn on, so every adapter has a pre-state to restore. */
export const drawn = (): AssetShape => ({
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
export function present<T>(value: T | null): T {
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
export function sidecarFailingReadsAfter(real: AssetGeometrySidecar, reads: number): AssetGeometrySidecar {
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
export function sidecarWritingBetweenReads(
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
 * A sidecar that lets a peer write land AFTER the wrapped command's write has succeeded and
 * BEFORE the adapter learns what version it produced — the third of the three windows a
 * gesture straddles, and the one no read-back can see past: the adapter's own read finds the
 * PEER's version and, without the command reporting its own, records it as this gesture's.
 *
 * Fires ONCE, on the first successful write, so an undo's restore in the same case is an
 * ordinary write with nobody interfering.
 */
export function sidecarWritingAfterWrite(
	real: AssetGeometrySidecar,
	peer: () => Promise<unknown>,
): AssetGeometrySidecar {
	let fired = false;
	return {
		read: (assetId) => real.read(assetId),
		write: async (assetId, document, expected) => {
			const written = await real.write(assetId, document, expected);
			if (!fired && !isErr(written)) {
				fired = true;
				await peer();
			}
			return written;
		},
	};
}

/** The NOTE half of the same window, through the repository the height command writes. */
export function repositoryWritingAfterSave(
	real: AssetRepository,
	peer: () => Promise<unknown>,
): AssetRepository {
	let fired = false;
	return {
		getById: (id) => real.getById(id),
		listAll: () => real.listAll(),
		delete: (id, expected) => real.delete(id, expected),
		save: async (asset, expected) => {
			const saved = await real.save(asset, expected);
			if (!fired && !isErr(saved)) {
				fired = true;
				await peer();
			}
			return saved;
		},
	};
}

/**
 * Every command and both ledgers are constructed HERE, once. A command built beside a case is
 * a command a mutation run silently leaves un-mutated, which this epic has already paid for.
 */
/**
 * What `seeded` hands back. DECLARED rather than inferred, and the reason is the comment
 * inside `seeded` beside `reversible`: a class's members are resolved through the annotation
 * where the consuming expression sits, and the consuming expressions now live in two other
 * files that reach this object through an inferred property type.
 */
export interface AssetDesignHarness {
	readonly stack: ReturnType<typeof createRepositoryStack>;
	readonly events: EventBus;
	readonly assetId: AssetId;
	readonly sidecar: AssetGeometrySidecar;
	readonly noteLedger: SessionWriteLedger;
	readonly geometryLedger: SessionWriteLedger;
	readonly bundle: AssetDesignCommandBundle;
	/** The plain doors, for staging a peer leaf's own gesture. */
	readonly plain: {
		readonly setFacing: SetAssetFacingCommand;
		readonly setHeight: SetAssetHeightCommand;
	};
	readonly designChanges: AssetId[];
	readonly reversible: ReversibleAssetDesignCommands;
	/** The adapters over a bundle a case has replaced one door of. */
	reversibleWith(overrides: Partial<AssetDesignCommandBundle>): ReversibleAssetDesignCommands;
	seed(shape: AssetShape | null): Promise<void>;
	/** A calibration to lose — Task B7's cases each seed one before clearing it. */
	seedCalibration(): Promise<void>;
	document(): Promise<AssetGeometryDocument>;
	geometryVersion(): Promise<EntityVersion>;
	height(): Promise<number | null | undefined>;
	/** A hand edit no schema would accept, so the next read of this NOTE fails. */
	corrupt(): void;
}

export async function seeded(
	options: {
		readonly sidecar?: (real: AssetGeometrySidecar) => AssetGeometrySidecar;
		/**
		 * The NOTE half of the same knob. `stack.assets` stays the raw repository the case's
		 * own assertions read through, so a wrapper that intercepts a write cannot also
		 * silently intercept the reading that checks what it did.
		 */
		readonly assets?: (real: AssetRepository) => AssetRepository;
	} = {},
): Promise<AssetDesignHarness> {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const real = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const sidecar = options.sidecar?.(real) ?? real;
	const written = expectOk(await stack.assets.save(makeAsset({ height: 700 }), 'absent'));
	const assetId = written.entity.id;
	const path = stack.index.getPath(assetId) ?? '';
	const assets = options.assets?.(stack.assets) ?? stack.assets;

	const commandDeps = { sidecar, assets, events };
	const noteLedger = new SessionWriteLedger();
	const geometryLedger = new SessionWriteLedger();
	// Typed as the BUNDLE rather than as the concrete classes, so a case that replaces one door
	// with a stand-in is replacing a door and not narrowing to a class the compiler then wants
	// every private field of.
	// Held as CONCRETE instances beside the annotated bundle, because the two doors are what
	// a case needs to keep apart: the adapters dispatch `executeWithVersion`, and a PEER leaf
	// — which is what several cases below stage — dispatches the plain `execute` a user's own
	// gesture would. Naming only the bundle here would leave `execute` unreachable and turn
	// every peer into a second versioned dispatcher, which is not the input being modelled.
	const setFacingCommand = new SetAssetFacingCommand(commandDeps);
	const setHeightCommand = new SetAssetHeightCommand(assets, events);
	const bundle: AssetDesignCommandBundle = {
		setFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand(commandDeps),
		setFootprint: new SetAssetFootprintCommand(commandDeps),
		setClearance: new SetAssetClearanceCommand(commandDeps),
		setAnchor: new SetAssetAnchorCommand(commandDeps),
		setFacing: setFacingCommand,
		setHeight: setHeightCommand,
		calibrate: new CalibrateAssetCommand(commandDeps),
		setBackground: new SetAssetBackgroundCommand(commandDeps),
	};

	// ANNOTATED, and constructed here rather than inline in the returned literal: fallow
	// resolves a class's members through the annotation where the consuming expression sits,
	// and six factory methods whose only callers are the test files are reported as
	// `unused-class-members` when the `new` expression's result reaches them through an
	// inferred object property. Measured both ways rather than guessed.
	//
	// **The annotation on this local stopped being enough the moment the cases moved to
	// another file**, which is why `seeded`'s RETURN TYPE is declared too: the consuming
	// expression is `w.reversible.setFootprint(…)` over there, so the annotation fallow
	// resolves through is `AssetDesignHarness.reversible` rather than this one. Measured, by
	// splitting the file and watching `npm run analyze` report all six.
	const reversible: ReversibleAssetDesignCommands = new ReversibleAssetDesignCommands(
		{ sidecar, assets, events, noteLedger, geometryLedger },
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
		/** The plain doors, for staging a peer leaf's own gesture. */
		plain: { setFacing: setFacingCommand, setHeight: setHeightCommand },
		designChanges: designChangesHeardOn(events),
		reversible,
		/** The adapters over a bundle a case has replaced one door of. */
		reversibleWith(overrides: Partial<AssetDesignCommandBundle>): ReversibleAssetDesignCommands {
			return new ReversibleAssetDesignCommands(
				{ sidecar, assets, events, noteLedger, geometryLedger },
				{ ...bundle, ...overrides },
			);
		},
		async seed(shape: AssetShape | null): Promise<void> {
			expectOk(await real.write(assetId, { calibration: null, shape }));
		},
		/**
		 * Adds `CALIBRATION` to whatever the sidecar already holds, rather than replacing the
		 * document — Task B7's cases seed a SHAPE and a calibration together (`seedShape` then
		 * `seedCalibration`), and a document-replacing seed here would silently drop the shape
		 * the case just wrote.
		 */
		async seedCalibration(): Promise<void> {
			const current = expectOk(await real.read(assetId));
			expectOk(await real.write(assetId, { ...current.document, calibration: CALIBRATION }, current.version));
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
