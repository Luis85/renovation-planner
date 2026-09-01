import { err } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import type { WriteLedger } from '../../application/editor/WriteLedger';
import type { Command } from '../../application/commands/Command';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import {
	ReversibleAssetDesignCommands,
	type AssetDesignCommandBundle,
	type ReversibleAssetDesignDeps,
	type VersionedDesignCommand,
} from '../../application/editor/asset/ReversibleAssetDesignCommands';

/**
 * The write side of the asset designer, as design slice B5 consumes it — the mirror of
 * `planEditorCommands.ts` for the surface that edits ONE asset.
 *
 * `AssetDesignerDeps` reserved this member in writing from the day it was created: *"Task B3b
 * the reversible adapters — the guarded command bundle arrives with the first thing that
 * builds a command out of it, which Task B3a is not."* This slice's four tools are that first
 * thing.
 */

/**
 * One leaf's two write ledgers.
 *
 * TWO, because an asset is two resources under one `EntityId` — its geometry sidecar and its
 * note — and `SessionWriteLedger` holds one `EntityVersion` per id, so a single ledger has the
 * two overwrite each other and an undo then presents the NOTE's revision to the SIDECAR.
 * `ReversibleAssetDesignDeps` states the whole argument; this type exists so the seam below
 * can ask a leaf for both without spelling the pair at each call site.
 */
export interface DesignWriteLedgers {
	readonly noteLedger: WriteLedger;
	readonly geometryLedger: WriteLedger;
}

/**
 * A FACTORY over the leaf's ledgers, and not a bundle of ready-made commands.
 *
 * The reason is the one `PlanEditorCommandServices` gives for `calibratePlan`, one seam over:
 * what crosses a composition boundary is exactly what has no per-transaction state, and an
 * adapter set is bound to the two ledgers of ONE leaf's history. Two designer leaves on two
 * assets each need their own, and a shared instance would let one leaf's undo condition its
 * restore on the other leaf's last write.
 *
 * It answers the CONCRETE `ReversibleAssetDesignCommands` rather than a structural interface,
 * unlike every other member of either surface's command services. That is deliberate and
 * narrow: the class is application-layer, it is constructed only from ports the root already
 * holds, and there is exactly one implementation of it — where the guarded facades this
 * plugin hands out are wrappers that could never be instances of the classes they wrap.
 */
export interface AssetDesignerCommandServices {
	readonly designEdits: (ledgers: DesignWriteLedgers) => ReversibleAssetDesignCommands;
}

/**
 * What the composition root builds the factory from: the three ports every design command and
 * every one of their inverses reaches. It is `ReversibleAssetDesignDeps` minus the two ledgers,
 * which is precisely the half the ROOT can supply, and it is stated as an `Omit` so a fourth
 * port added there arrives here rather than being forgotten.
 */
export type AssetDesignPorts = Omit<ReversibleAssetDesignDeps, keyof DesignWriteLedgers>;

export function createAssetDesignerCommands(
	ports: AssetDesignPorts,
	commands: AssetDesignCommandBundle,
): AssetDesignerCommandServices {
	return {
		designEdits: (ledgers) => new ReversibleAssetDesignCommands({ ...ports, ...ledgers }, commands),
	};
}

/**
 * The write side for a session whose settings could not be recovered — the same total-rather-
 * than-nullable shape `unavailableAssetDesignerQueries` gives the read side, so the designer
 * stays mounted and a gesture fails through exactly the path any other refused write takes.
 */
function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

/**
 * A PORT whose every method refuses with `settings.unrecovered`. One proxy rather than a dozen
 * hand-written members, exactly as `planEditorCommands.ts`'s `refusingPort` does it: a member
 * this version does not even know about refuses too, rather than answering `undefined`.
 */
function refusingPort<T>(): T {
	return new Proxy(
		{},
		{
			get: () => () => Promise.resolve(err(persistenceFailure())),
		},
	) as T;
}

/**
 * One design command, both of its doors refusing.
 *
 * **Both are unreachable in this session and are written anyway**, which is a cost worth
 * naming rather than a gap: every reversible adapter reads its pre-state through the sidecar
 * BEFORE it dispatches, and in this bundle that port refuses first — so no gesture ever gets as
 * far as a command. What these two buy is that the bundle is a real one whatever reaches it: a
 * future adapter that dispatched without a pre-state read, or a caller holding the bundle
 * directly, gets the same coded refusal rather than `undefined`.
 *
 * That is also why the doors are spelled out rather than proxied — see `refusingBundle` — and
 * the two together are the reason this pair shows as uncovered functions on a coverage report.
 * They are the same category as `editorViewportAdapter`'s `setPan`/`setZoom`: a contract met
 * where nothing yet calls it.
 */
function refusingCommand<TInput>(): VersionedDesignCommand<TInput> & Command<TInput, DispatchResult> {
	return {
		execute: () => Promise.resolve(err(persistenceFailure())),
		executeWithVersion: () => Promise.resolve(err(persistenceFailure())),
	};
}

/**
 * The six doors, written out rather than proxied, and the asymmetry with the ports above is
 * deliberate. A proxy answers a FUNCTION for every property, which is right for a port whose
 * members are called directly and wrong for a bundle whose members are OBJECTS each carrying a
 * door — `commands.setFootprint.executeWithVersion` off a proxy is a property of a function,
 * which is `undefined`, and the failure would be a `TypeError` at the one moment this bundle
 * exists to produce a clean refusal. Total over `AssetDesignCommandBundle`, so a seventh design
 * command is a build error here rather than an `undefined` door.
 */
function refusingBundle(): AssetDesignCommandBundle {
	return {
		setFootprintFromDimensions: refusingCommand(),
		setFootprint: refusingCommand(),
		setClearance: refusingCommand(),
		setAnchor: refusingCommand(),
		setFacing: refusingCommand(),
		setHeight: refusingCommand(),
	};
}

/**
 * The REAL adapters over refusing ports, rather than a hand-written refusing factory.
 *
 * Every adapter reads its pre-state before it writes anything, and that read is the first thing
 * to refuse — so a gesture in an unrecovered session is declined at exactly the step it would
 * be declined at by a vault that could not be read, with no branch anywhere pretending
 * otherwise. `unavailablePlanEditorCommands` composes real command classes over refusing ports
 * for the identical reason.
 */
export function unavailableAssetDesignerCommands(): AssetDesignerCommandServices {
	return createAssetDesignerCommands(
		{ sidecar: refusingPort(), assets: refusingPort(), events: refusingPort() },
		refusingBundle(),
	);
}
