import type { ProjectOpenOutcome } from '../views/RenovationProjectContext';
import { err, type Result } from '../../core/result/Result';
import type { AppError, PersistenceError } from '../../core/errors/AppError';
import { currencyOf, type Currency } from '../../core/money/Money';
import type { Command } from '../../application/commands/Command';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { VersionedDesignCommand } from '../../application/editor/asset/ReversibleAssetDesignCommands';
import type { UpdateAssetInput, UpdateAssetErrors } from '../../application/commands/asset/UpdateAsset';
import type { SetAssetHeightInput } from '../../application/commands/asset/SetAssetHeight';
import type { DeleteAssetInput, DeleteAssetErrors } from '../../application/commands/asset/DeleteAsset';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { ResolvedSequence } from '../../application/reference/deleteResolution';
import type { AssetLibraryChange } from '../../application/events/assetLibraryChangeSource';
import type { Logger } from '../../application/ports/Logger';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

/**
 * The write side of the Asset library: the three gestures §3.5's inspector offers, plus the
 * three §3.1's toolbar needs for `New asset`.
 *
 * **SIX now, not three** — this section used to say "three, and every one of them already
 * exists", true of the Inspector alone. §3.1 hands off to the identical `NewAssetForm` /
 * `CreateAssetCommand` / `SetAssetFootprintFromDimensionsCommand` sequence
 * `RenovationProjectCommandServices` already carries for its own `New asset` door (Task B9),
 * and this bundle had no way to reach any of the three: a hand-off the plan named
 * ("New asset opens the existing NewAssetForm … unchanged") without widening the bundle the
 * form actually needs, the same shape CLAUDE.md records for `ProjectFolderLookup`. Copied
 * rather than shared with `RenovationProjectCommandServices` — each bundle's own module
 * assembles its slice of the SAME guarded services the composition root composed once, and a
 * shared bundle type would couple two independent view surfaces (§2's "a sibling of that whole
 * ladder rather than a state inside it") to one shape.
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
	/** §3.1's `New asset` door — `NewAssetForm`'s own sequence, unchanged. */
	readonly createAsset: Command<CreateAssetInput, Result<Asset, AppError>>;
	readonly setAssetFootprintFromDimensions: Command<SetAssetFootprintFromDimensionsInput, DispatchResult>;
	/** The creation form's currency prefill — `RenovationProjectCommandServices`'s own field. */
	readonly defaultCurrency: Currency;
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
	/**
	 * Opens an asset's OWN note, addressed by id — §3.5's `Open note`, which the inspector needs
	 * and `openNote` above cannot serve.
	 *
	 * A second door rather than a widening, because the two have different addressing modes for
	 * a stated reason. §5.1a's repair strip reaches notes that carry no usable id at all (a
	 * `no-id` note has none; a duplicate-id loser is unreachable by the id the winner holds), so
	 * that door must take a PATH. The inspector's subject is an id and `CatalogueEntryDto`
	 * carries no path — the note's location is the Project Index's answer, one layer this view
	 * may not reach. **The same shape §3.5 records twice already** (`ProjectFolderLookup`, and
	 * the sidecar path on the port's own refusal): a surface needing a value the read model does
	 * not carry is a COLLABORATOR change, not something a component can derive.
	 *
	 * `'missing'` therefore covers one more cause than the path door's: the index holds no note
	 * for that id at all, which is the honest answer for an asset that has just been deleted.
	 */
	readonly openAssetNote: (assetId: AssetId) => Promise<NoteOpenOutcome>;
	/** Opens a referencing project; missing targets require a fresh usage query. */
	readonly openProject: (projectId: string) => Promise<ProjectOpenOutcome>;
	/** Jumps into the designer for one asset — §3.5's `Open designer` action. */
	readonly openDesigner: (assetId: AssetId) => Promise<void>;
	/**
	 * §3.6's status bar folder half — `54 assets · Renovation/Library` — a plain settings echo
	 * rather than a query, exactly as `RenovationProjectCommandServices.defaultCurrency` mirrors
	 * `defaultCurrency` from the same settings object: nothing here computes it, so a query
	 * seam would answer a value this bundle already has for free at composition time.
	 */
	readonly libraryFolder: string;
}

/**
 * The write side for a session whose settings could not be recovered — the same
 * total-rather-than-nullable shape `unavailableAssetLibraryQueries` gives the read side, so
 * the library stays mounted and a gesture fails through exactly the path any other refused
 * write takes.
 *
 * **Byte-identical to `designerCommands.ts`'s own `persistenceFailure`, which makes NINE
 * `settings.unrecovered` code literals across eight modules in `presentation/` — followed
 * rather than shared, and said out loud so the tenth is a decision somebody makes.** Measured
 * in the edit that wrote this sentence rather than carried from a review that said eight:
 * `grep -rnE "'settings[.]unrecovered'" src/presentation/` prints twelve lines over eleven
 * files, of which two are locale KEYS (`en.ts`, `de.ts`) and one is `errorSurfacePolicy.ts`'s
 * named constant rather than a raised code. Read the number as a fact about that grep and
 * re-run it before quoting it.
 *
 * **The `[.]` is why twelve is now TRUE, and it was not.** The sentence claimed twelve while the
 * pattern as written printed thirteen, for two tasks, and the extra line was this docblock
 * itself. The pattern used to be written with a bare dot, so this very line — which quotes it
 * — was one of the lines it counted: *an instrument written inside the text it measures counts
 * itself*, which CLAUDE.md records against a `MIGRATION_SET` grep that printed ten for an array
 * of nine, and which this branch has now produced four times. A bracketed dot is the same regex
 * to `grep -E` and a different STRING in this comment, so the quotation is no longer a match —
 * the fix being an instrument that cannot count itself rather than a sentence explaining the
 * extra line, because the first survives the next edit to this paragraph and the second does
 * not. Two lines are far under fallow's clone floor, so no gate will ever raise this; the house pattern is one per bundle, and a shared
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
		// The `New asset` pair, refused for `renovationProjectCommands.ts`'s own reason: without
		// settings there is no library folder for the note to land in.
		createAsset: { execute: refuse },
		setAssetFootprintFromDimensions: { execute: refuse },
		// The refusal bundle writes nothing, so its prefill is never persisted; a valid code is
		// all the form needs — `renovationProjectCommands.ts`'s own identical default.
		defaultCurrency: currencyOf('EUR'),
	};
}
