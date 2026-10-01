import {
	createAssetDesignerCommands,
	type AssetDesignerCommandServices,
} from '../../src/presentation/designer/designerCommands';
import {
	createAssetDesignerQueries,
	type AssetDesignerQueryServices,
} from '../../src/presentation/read-models/assetDesignerQueries';
import { GetAssetDesignQuery } from '../../src/application/queries/GetAssetDesign';
import { createAssetDesignChangeSource } from '../../src/application/events/assetDesignChangeSource';
import { SetAssetAnchorCommand } from '../../src/application/commands/asset/SetAssetAnchor';
import { SetAssetClearanceCommand } from '../../src/application/commands/asset/SetAssetClearance';
import { SetAssetFacingCommand } from '../../src/application/commands/asset/SetAssetFacing';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
} from '../../src/application/commands/asset/SetAssetFootprint';
import { SetAssetShapeCommand } from '../../src/application/commands/asset/SetAssetShape';
import { SetAssetHeightCommand } from '../../src/application/commands/asset/SetAssetHeight';
import { CalibrateAssetCommand } from '../../src/application/commands/asset/CalibrateAsset';
import { SetAssetBackgroundCommand } from '../../src/application/commands/asset/SetAssetBackground';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import type { VaultFileProbe } from '../../src/application/ports/VaultFileProbe';
import type { AssetShapeDeps } from '../../src/application/commands/asset/updateAssetShape';
import type { AssetDesignCommandBundle } from '../../src/application/editor/asset/ReversibleAssetDesignCommands';
import type { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryStore } from '../../src/infrastructure/obsidian/repositories/AssetGeometryStore';
import { createEventBus } from '../../src/core/events/EventBus';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import { createRepositoryStack, type FakeVault } from './vault';
import { makeAsset } from './entities';
import { expectOk } from './domain';

/**
 * The asset designer's persistence side, composed ONCE for the two things that mount a writable
 * designer: `designerRig` (the suite) and `tests/harness/assetDesigner.ts`'s `&writable` knob (a
 * real browser). One definition rather than two copies, because fallow reads `tests/helpers/` and
 * a second copy of this wiring would be a clone nothing else could see drift.
 *
 * **It imports nothing from `vitest`**, and every module below it is browser-safe under
 * `vite.harness.config.ts` — the in-memory stack is plain classes over the `obsidian` alias to
 * `tests/helpers/obsidian-mock.ts`, the same mock the suite resolves. `expectOk` THROWS on a
 * refused seed rather than asserting, so a harness page fails loudly on the console instead of
 * drawing a design nobody wrote.
 *
 * Everything below the view is genuine: `ObsidianAssetGeometrySidecar` over the fake vault's bytes,
 * `ObsidianAssetRepository` for the note, the real design commands, `createAssetDesignerCommands`
 * minting the real reversible adapters per leaf, and `GetAssetDesignQuery` joining the two back for
 * the read. `onDesignChanged` is the SAME source the composition root binds, over a bus that really
 * dispatches, so a committed write publishes `AssetDesignChanged` and a leaf re-reads because of it.
 *
 * **The nine-command `AssetDesignCommandBundle` — and `SPEC_SHEETS`/`specSheetProbe` beside it —
 * is `createAssetDesignCommandBundle` below, and that IS the one definition now**: this file's own
 * `composeDesigner` calls it, and so does `tests/helpers/assetDesignHarness.ts`'s `seeded`, over
 * ITS OWN `commandDeps` (which may wrap `sidecar`/`assets` in a fault-injecting knob `seeded`'s
 * options take — this function never sees that wrapping, only the port interfaces). `seeded` keeps
 * only what this shared shape does not carry: the two concrete `SetAssetFacingCommand` /
 * `SetAssetHeightCommand` instances its own cases dispatch the plain `execute()` a peer leaf's
 * gesture would, beside the bundle's `executeWithVersion` door onto the same instances.
 */

/**
 * `SetAssetBackground`'s file probe, over the paths the cases driving `designerRig` AND
 * `tests/helpers/assetDesignHarness.ts`'s `seeded` pick as spec sheets. A LIST rather than the
 * real probe over the fake vault, because the probe answers a question those entries cannot: a
 * spec sheet is a PNG or a PDF, and this fake vault holds note text. A case that invents a fourth
 * path is refused at the file check, loudly, which is the failure this list is allowed to have.
 */
const SPEC_SHEETS: readonly string[] = ['Specs/oven.pdf', 'Specs/other.png', 'Specs/a.png'];
const specSheetProbe: VaultFileProbe = { fileExists: (path) => SPEC_SHEETS.includes(path) };

/** What `createAssetDesignCommandBundle` hands back — declared rather than inferred, for the
 * same reason `AssetDesignHarness`'s own return type is: the consuming expression for
 * `setFacing`/`setHeight`'s `execute()` sits in a different file again, over a property read
 * of whatever this function returns, never a destructure of it (a destructuring pattern is the
 * one shape fallow's `unused-class-members` scan does not resolve through, per
 * `ReversibleAssetDesignCommands.ts`'s own measured account of the same trap).
 */
export interface AssetDesignCommandSet {
	readonly bundle: AssetDesignCommandBundle;
	/** The concrete door beside the bundle's `executeWithVersion` one — see this module's header. */
	readonly setFacing: SetAssetFacingCommand;
	readonly setHeight: SetAssetHeightCommand;
}

/**
 * Every asset design command, built once from whatever port instances the caller hands in —
 * `composeDesigner`'s own stack, or `seeded`'s, wrapped or not. `deps` is `AssetShapeDeps`, the
 * shape seven of the nine commands already share; `setHeight` and `setBackground` take a narrower
 * or wider slice of the same fields, exactly as they did before this was one function instead of
 * two copies.
 */
export function createAssetDesignCommandBundle(deps: AssetShapeDeps): AssetDesignCommandSet {
	const setFacing = new SetAssetFacingCommand(deps);
	const setHeight = new SetAssetHeightCommand(deps.assets, deps.events);
	const bundle: AssetDesignCommandBundle = {
		setFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand(deps),
		setFootprint: new SetAssetFootprintCommand(deps),
		setShape: new SetAssetShapeCommand(deps),
		setClearance: new SetAssetClearanceCommand(deps),
		setAnchor: new SetAssetAnchorCommand(deps),
		setFacing,
		setHeight,
		calibrate: new CalibrateAssetCommand(deps),
		setBackground: new SetAssetBackgroundCommand(deps, specSheetProbe),
	};
	return { bundle, setFacing, setHeight };
}

export interface DesignerComposition<S extends ObsidianAssetGeometrySidecar> {
	readonly assetId: AssetId;
	readonly sidecar: S;
	readonly vault: FakeVault;
	readonly queries: AssetDesignerQueryServices;
	readonly commands: AssetDesignerCommandServices;
	readonly onDesignChanged: (assetId: string, listener: () => void) => () => void;
	/**
	 * Held as a CONCRETE instance beside the bundle: the bundle's members are
	 * `VersionedDesignCommand`s, the door the reversible adapters take, while a PEER's gesture
	 * dispatches the plain `execute` a user's own would.
	 */
	readonly setFacing: SetAssetFacingCommand;
}

export async function composeDesigner<S extends ObsidianAssetGeometrySidecar>(
	options: {
		/** The shape the sidecar starts with. `null` is an asset nobody has drawn on. */
		readonly shape: AssetShape | null;
		/** Give the asset a spec sheet (`designerRig`'s `background` knob carries why it matters). */
		readonly background?: boolean;
		/** The sidecar over the stack's geometry store — `designerRig` passes a subclass that can fault. */
		readonly sidecar: (store: AssetGeometryStore) => S;
		/** The usage-scope arm, which each caller answers for its own reason. */
		readonly usage: AssetDesignerQueryServices['listPlansUsingAsset'];
	},
): Promise<DesignerComposition<S>> {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const sidecar = options.sidecar(stack.assetGeometry);
	const written = expectOk(
		await stack.assets.save(
			makeAsset({
				height: 700,
				...(options.background === true
					? { background: { path: 'Specs/oven.png', kind: 'image' as const, page: null } }
					: {}),
			}),
			'absent',
		),
	);
	const assetId = written.entity.id;
	expectOk(await sidecar.write(assetId, { calibration: null, shape: options.shape }));

	const commandDeps = { sidecar, assets: stack.assets, events, locks: new ReferenceLocks() };
	// The REAL bundle, every door of it — `createAssetDesignCommandBundle`'s one definition,
	// shared with `tests/helpers/assetDesignHarness.ts`'s `seeded` (this module's own header).
	const commandSet: AssetDesignCommandSet = createAssetDesignCommandBundle(commandDeps);

	return {
		assetId,
		sidecar,
		vault: stack.vault,
		queries: createAssetDesignerQueries({ get: new GetAssetDesignQuery(stack.assets, sidecar) }, { execute: options.usage }),
		commands: createAssetDesignerCommands(commandDeps, commandSet.bundle),
		onDesignChanged: createAssetDesignChangeSource(events),
		setFacing: commandSet.setFacing,
	};
}
