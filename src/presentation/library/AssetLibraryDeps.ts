import { err, type Result } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import type { Command } from '../../application/commands/Command';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { VersionedDesignCommand } from '../../application/editor/asset/ReversibleAssetDesignCommands';
import type { UpdateAssetInput, UpdateAssetErrors } from '../../application/commands/asset/UpdateAsset';
import type { SetAssetHeightInput } from '../../application/commands/asset/SetAssetHeight';
import type { DeleteAssetInput, DeleteAssetErrors } from '../../application/commands/asset/DeleteAsset';
import type { ResolvedSequence } from '../../application/reference/deleteResolution';
import type { AssetLibraryChange } from '../../application/events/assetLibraryChangeSource';
import type { Logger } from '../../application/ports/Logger';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { BackgroundVault } from '../editor/layers/background/BackgroundRenderModel';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

/**
 * The write side of the Asset library: the three gestures §3.5's inspector offers.
 *
 * THREE, and every one of them already exists — `UpdateAsset` for the definition fields,
 * `SetAssetHeight` for the one field that lives on the design rather than in the catalogue
 * row, and `DeleteAsset` for the resolution flow the *Used in* section is literally the read
 * of. This surface invents no command, which is §2a's scope test applied to the write side: a
 * fact about an asset that existed only here would be a fact Bases could never see.
 *
 * `setAssetHeight` carries BOTH doors. It is `GuardedDesignCommand<SetAssetHeightInput>` as the
 * composition root spells it, written out structurally here because that type lives in
 * `plugin/` and `presentation/` may not import it — the same relaxation
 * `AssetDesignCommandBundle` records one layer down, and for the same reason.
 */
export interface AssetLibraryCommandServices {
	readonly updateAsset: Command<UpdateAssetInput, Result<Asset, UpdateAssetErrors>>;
	readonly setAssetHeight: Command<SetAssetHeightInput, DispatchResult> &
		VersionedDesignCommand<SetAssetHeightInput>;
	readonly deleteAsset: Command<DeleteAssetInput, Result<ResolvedSequence, DeleteAssetErrors>>;
}

/**
 * What a `Open note` click did, as far as the VIEW needs to know.
 *
 * `'missing'` is the member this surface branches on: the row points at a note the vault no
 * longer holds, so the listing it was drawn from is stale and gets re-read. `'failed'` covers
 * an I/O fault — already mapped into a notice by the fault door the composition root hands
 * `openNoteAtPath` — and a session with unrecovered settings, where there is no vault to open
 * through. Neither is a stale row, so neither buys a re-read.
 *
 * Declared here rather than imported from `openNoteAtPath`'s own union, which is where all
 * three members come from: `presentation/` may not import `infrastructure/`, and the
 * composition root is the layer that may see both. `RenovationProjectContext`'s
 * `ProjectOpenOutcome` is the same three members declared for the same reason on the other
 * surface. **This is the THIRD declaration of the union overall and the SECOND in
 * `presentation/`** — `openNote.ts`'s `ProjectNoteOpenOutcome` is where all three members come
 * from — and the count is written down because the argument quoted for the first copy ("a
 * union of three string literals shared across two view folders buys an indirection and saves
 * nothing") was an argument for having ONE copy here. There is no layer ban between two
 * `presentation/` folders, so the third copy is the point at which this stops being a bound
 * imposed by the architecture and becomes a habit: whoever writes it should share instead.
 */
export type NoteOpenOutcome = 'opened' | 'missing' | 'failed';

/**
 * Everything the composition root hands an Asset library leaf.
 *
 * A bundle of its own rather than a widening of `RenovationProjectDeps`: this surface is a
 * sibling of that whole ladder rather than a state inside it (§2, "Why not a state of the
 * Renovation project view"), and the two share no member by accident — the library needs a
 * catalogue read and a change source of its own, and the project view needs neither.
 *
 * `assetId` is deliberately NOT a member: the selected asset lives in Obsidian's per-leaf view
 * state, and the composition root composes services and knows nothing about which leaf this
 * is. `AssetLibraryContext` (Task 11) is where the two are joined.
 */
export interface AssetLibraryDeps {
	readonly queries: AssetLibraryQueryServices;
	readonly commands: AssetLibraryCommandServices;
	/**
	 * Where a THROWN fault on a click-bound dispatch is recorded. Beside the queries rather
	 * than inside them: a door that faulted is not a fact about reading.
	 */
	readonly logger: Logger;
	/**
	 * "What must this surface re-read" — Task 7's four-part payload, wired from the bus by the
	 * root. Takes no id: the library holds every asset, so there is nothing to bind per leaf,
	 * which is what makes this member unlike the designer's `onDesignChanged`.
	 */
	readonly onLibraryChanged: (listener: (change: AssetLibraryChange) => void) => () => void;
	/**
	 * Has the initial index scan RUN — zero entries included — rather than "has it found
	 * anything". Asked per hydration and never captured, because it turns true once per session
	 * and a leaf that snapshotted `false` would decline every authoritative empty answer for
	 * the rest of its life.
	 *
	 * §4 makes this surface the one where the question matters most: `listAll()` enumerates
	 * index ids, so before the rebuild it answers a perfectly legitimate `ok([])` and a view
	 * mapping that to the Empty row draws *no assets yet* over a full catalogue, with a `New
	 * asset` button under it — a renovator who takes that invitation defines the duplicate this
	 * whole feature exists to prevent.
	 */
	readonly indexScanCompleted: () => boolean;
	/**
	 * Opens a note BY PATH, which is the one addressing mode the repair strip can use: two of
	 * §5.1a's three unreadable sources carry no usable id at all — a `no-id` note has none and
	 * a duplicate-id loser is unreachable by the id the winner holds — so an id-keyed door
	 * cannot reach the file the user has to edit. `UnreadableEntry.path` is what this takes,
	 * and it is what that field is FOR.
	 */
	readonly openNote: (path: string) => Promise<NoteOpenOutcome>;
	/** Jumps into the designer for one asset — §3.5's `Open designer` action. */
	readonly openDesigner: (assetId: AssetId) => Promise<void>;
	/**
	 * The three `Vault` members the background pipeline calls, so §3.5's spec-sheet row can
	 * draw the document an asset names. The same slice of Obsidian's `Vault` the Plan Editor
	 * and the designer take, reached through the same `loadBackground`/`BackgroundLayer` pair
	 * rather than a second decode path.
	 */
	readonly vault: BackgroundVault;
}

/**
 * The write side for a session whose settings could not be recovered — the same
 * total-rather-than-nullable shape `unavailableAssetLibraryQueries` gives the read side, so
 * the library stays mounted and a gesture fails through exactly the path any other refused
 * write takes.
 *
 * **Byte-identical to `designerCommands.ts`'s own `persistenceFailure`, which makes eight
 * `settings.unrecovered` literals in `presentation/` — followed rather than shared, and said
 * out loud so the ninth is a decision somebody makes.** Two lines are far under fallow's clone
 * floor, so no gate will ever raise this; the house pattern is one per bundle, and a shared
 * helper would put the write side's refusal code in a module neither bundle owns. Recorded
 * because a habit nobody has noticed is not the same as a convention somebody chose.
 */
function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

export function unavailableAssetLibraryCommands(): AssetLibraryCommandServices {
	const refuse = () => Promise.resolve(err(persistenceFailure()));
	return {
		updateAsset: { execute: refuse },
		// Both doors, written out rather than proxied: a proxy answers a FUNCTION for every
		// property, and `commands.setAssetHeight.executeWithVersion` off one is a property of a
		// function — `undefined`, and a `TypeError` at the one moment this bundle exists to
		// produce a clean refusal. `designerCommands.ts`'s own `refusingCommand` states the
		// same rule for the same shape.
		setAssetHeight: { execute: refuse, executeWithVersion: refuse },
		deleteAsset: { execute: refuse },
	};
}
