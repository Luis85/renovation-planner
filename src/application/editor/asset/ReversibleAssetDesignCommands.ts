import { err, isErr, ok } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Asset } from '../../../domain/asset/Asset';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import { assetNotFound } from '../../../domain/asset/Asset.errors';
import { markUncompensated, type DispatchResult, type VersionedDispatchResult } from '../../commands/DispatchOutcome';
import type { AssetShapeInput } from '../../commands/asset/updateAssetShape';
import type {
	SetAssetFootprintFromDimensionsInput,
	SetAssetFootprintInput,
} from '../../commands/asset/SetAssetFootprint';
import type { SetAssetClearanceInput } from '../../commands/asset/SetAssetClearance';
import type { SetAssetAnchorInput } from '../../commands/asset/SetAssetAnchor';
import type { SetAssetFacingInput } from '../../commands/asset/SetAssetFacing';
import type { SetAssetHeightInput } from '../../commands/asset/SetAssetHeight';
import type { CalibrateAssetInput } from '../../commands/asset/CalibrateAsset';
import type { SetAssetBackgroundInput } from '../../commands/asset/SetAssetBackground';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../ports/AssetGeometrySidecar';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { EntityVersion } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../WriteLedger';

/**
 * One design command as this module reaches it: the VERSIONED door alone.
 *
 * `executeWithVersion` rather than `execute`, and that is the fix for a lost update rather
 * than a preference. An adapter that dispatches `execute` learns nothing about the write, so
 * it has to rediscover the version by reading the port back — and a peer writing between the
 * command's write and that read is then recorded as this gesture's own, after which the undo
 * presents the PEER's version, matches, and restores the pre-gesture state over their edit.
 * The command is the only thing that can answer without a window, and this is the door it
 * answers through — `SetRequirementQuantityOverrideDoor` is the same shape one adapter over.
 */
export interface VersionedDesignCommand<TInput> {
	executeWithVersion(input: TInput): Promise<VersionedDispatchResult>;
}

/**
 * The eight design commands this module inverts, as DOORS rather than as classes.
 *
 * Structural on purpose: the composition root hands presentation a GUARDED facade (design
 * slice 11), which is a wrapper object and never an instance, so naming the concrete command
 * classes here would make each one a nominal dependency and quietly put this whole module
 * outside the Error Boundary. `SetRequirementQuantityOverrideDoor` records the same
 * relaxation for the same reason, one adapter over.
 *
 * **Naming `executeWithVersion` is what puts `guardBothDoors` on the hook**, and that
 * obligation is written here because nothing else will say it: these commands leave the
 * composition root as a guarded facade, a guard on the door nobody dispatches through is a
 * guard nobody has, and this module IS the second dispatcher. `guardAssetDesign` guards both
 * doors for that reason, and `tests/plugin/guardCategory.test.ts` drives every door the root
 * hands out rather than trusting anyone to remember.
 *
 * EIGHT doors and SIX mechanisms: both footprint commands and Task B6's calibration are
 * inverted by the same geometry adapter, because what an inverse restores is the sidecar's
 * whole document and none of the three writes anything else. Task B7's background is its
 * own mechanism, `ReversibleAssetBackgroundEdit`, being the one door that spans both resources.
 */
export interface AssetDesignCommandBundle {
	readonly setFootprintFromDimensions: VersionedDesignCommand<SetAssetFootprintFromDimensionsInput>;
	readonly setFootprint: VersionedDesignCommand<SetAssetFootprintInput>;
	readonly setClearance: VersionedDesignCommand<SetAssetClearanceInput>;
	readonly setAnchor: VersionedDesignCommand<SetAssetAnchorInput>;
	readonly setFacing: VersionedDesignCommand<SetAssetFacingInput>;
	readonly setHeight: VersionedDesignCommand<SetAssetHeightInput>;
	readonly calibrate: VersionedDesignCommand<CalibrateAssetInput>;
	/** Task B7's, the eighth door and the first that writes both resources in one gesture. */
	readonly setBackground: VersionedDesignCommand<SetAssetBackgroundInput>;
}

/**
 * What the adapters reach, and the reason there are TWO ledgers.
 *
 * **An asset is two resources under one `EntityId`.** Its design lives partly in the geometry
 * sidecar (footprint, clearance, anchor, facing, and the calibration that scales them) and
 * partly in the note (its height, and — from Task B7 — its background reference).
 * `SessionWriteLedger` holds ONE `EntityVersion` per id, so a single ledger has the two
 * overwrite each other: set a footprint, then a height, then undo the height, and the ledger
 * holds the NOTE's version — which the footprint's undo then presents to the SIDECAR, where
 * it is refused as stale and the undo stack is stuck with no way forward. Each adapter records
 * into the ledger its own write went to, and `reversibleAssetDesign.test.ts` drives exactly
 * that sequence through a real `CommandHistory`.
 *
 * Two ledgers rather than one ledger keyed by `(resource, id)`, because the key would be a
 * convention every future adapter has to remember and a wrong one is silent; two objects make
 * the choice a constructor argument the compiler asks for.
 */
export interface ReversibleAssetDesignDeps {
	readonly sidecar: AssetGeometrySidecar;
	readonly assets: AssetRepository;
	readonly events: EventBus;
	/** For `SetAssetHeight`, and for Task B7's background — every adapter that writes the NOTE. */
	readonly noteLedger: WriteLedger;
	/** For the five geometry commands and for Task B6's calibration — every sidecar write. */
	readonly geometryLedger: WriteLedger;
}

/**
 * One reversible design gesture.
 *
 * Structurally the presentation layer's `UndoableCommand` — an `execute()` and an `undo()`
 * resolving a `DispatchResult` — and it deliberately does not name that interface, which lives
 * in `presentation/` and may not be imported from here (the layer ban). `CommandHistory.run()`
 * accepts it structurally at every dispatch site, exactly as slice 8's zone adapters and
 * `ReversibleCalibratePlanCommand` are accepted.
 *
 * Exported so the factory below has a return type its own module exports: an un-exported one
 * is a `private-type-leak`, which `npm run analyze` fails on.
 */
export interface ReversibleAssetDesignEdit {
	execute(): Promise<DispatchResult>;
	undo(): Promise<DispatchResult>;
}

/**
 * What both adapters share: the wrapped command, its input, and the rule deciding which
 * version each forward write is conditioned on.
 *
 * A base class rather than a free function because the rule has STATE — whether this gesture
 * has run before — and `ReversibleOverrideBase` is the shape this repository already uses for
 * exactly that. Not exported: nothing outside this module extends it, and exporting it would
 * trade two `private-type-leak` findings for an `unused-exports` one.
 *
 * **The rule lives here once because it is subtle enough that two copies would drift.** Both
 * halves of it were reported as defects against the first version of this module:
 *
 * - **Condition on the snapshot this gesture kept**, or the undo performs a lost update. The
 *   wrapped command does its own read, so the two reads straddle a window; a peer writing in
 *   it is MERGED by the command while this adapter still holds the pre-peer state as the
 *   inverse, and the undo — conditioned on the ledger — then succeeds and puts the pre-peer
 *   state back, with the peer's edit gone and no refusal anywhere.
 * - **Capture it PER EXECUTE**, or redo refuses deterministically. The caller's own `expected`
 *   is an optimistic claim about what IT read, honoured on the first execute and spent there:
 *   by the time a redo asks, the undo has advanced the resource and that claim names a version
 *   two writes back.
 *
 * `ran` is set AFTER the command resolves rather than before, so a THROWN fault leaves the
 * gesture in the state it was in — a technical fault is not a gesture that ran.
 */
abstract class ReversibleAssetEdit<TInput extends AssetShapeInput> {
	private ran = false;

	constructor(
		protected readonly deps: ReversibleAssetDesignDeps,
		private readonly command: VersionedDesignCommand<TInput>,
		protected readonly input: TInput,
	) {}

	protected async runForward(version: EntityVersion): Promise<VersionedDispatchResult> {
		const expected = this.ran ? version : (this.input.expected ?? version);
		const ran = await this.command.executeWithVersion({ ...this.input, expected });
		this.ran = true;
		return ran;
	}

	/**
	 * Refuse an undo whose premise a foreign write has already destroyed — the SECOND of the
	 * three windows a design gesture straddles, and the one no conditional write can see.
	 *
	 * The generation this gesture executed under travels beside its inverse; if the ledger's
	 * has moved since, something outside this history wrote after that inverse was captured,
	 * and every write below this one on the stack is describing a state that no longer
	 * happened. Restoring a whole document or a whole entity cannot merge, so refusing is the
	 * only answer that does not discard somebody's edit. `WriteLedger` walks the five steps.
	 */
	protected supersededSince(ledger: WriteLedger, generation: number): boolean {
		return ledger.generation(this.input.assetId) !== generation;
	}
}

/**
 * The inverse of any command that writes an asset's geometry sidecar.
 *
 * **The pre-state is the whole DOCUMENT, captured from what the read actually FOUND.** Not the
 * one attribute the command owns: a footprint edit that also cleared a pending flag, and Task
 * B7's background change that also erases the calibration, are both undone by putting back the
 * bytes that were there — a snapshot rule narrowed to one field restores an old value over a
 * neighbour the same write moved, which is precisely what the undo advertises it will not do.
 * `ReversibleCalibratePlanCommand` restores its sidecar the same way and for the same reason.
 *
 * **Captured on every `execute`, not once.** A redo re-reads, so the next undo restores what
 * THAT execute replaced rather than a document two rounds old; and the inverse is dropped once
 * spent, so a second undo re-writes nothing.
 *
 * **The restore is CONDITIONAL** on the version this history last wrote for the sidecar
 * (`geometryLedger`), never on this adapter's own captured one — after footprint, clearance,
 * undo-the-clearance, the sidecar sits two writes past the footprint's, and a per-adapter
 * expectation would refuse the exact sequence undo/redo exists to make work. A sidecar edited
 * OUTSIDE this history since still refuses: its version left the ledger's behind.
 *
 * **And that condition answers about the TIP, so the GENERATION answers about the chain.** A
 * peer writing between two of this history's gestures leaves the tip perfectly current by the
 * time the earlier gesture's undo asks — the later gesture wrote past the peer and its own
 * undo advanced the ledger — so the conditional write above waves it through and restores a
 * pre-peer document. The generation this execute ran under travels with the inverse and is
 * compared again at `undo`; `WriteLedger` walks all five steps.
 *
 * **And the FORWARD write is conditional on the snapshot this gesture kept**, which closes a
 * lost update the undo would otherwise perform. The wrapped command does its own read, so
 * without this the two reads straddle a window: a peer designer writing in it is MERGED by the
 * command — its document is what the command read — while this adapter still holds the
 * pre-peer document as the inverse. The undo is then conditioned on the ledger, which holds
 * the version the forward write produced, so it succeeds and puts the pre-peer document back.
 * The peer's edit is gone with no refusal anywhere. Passing the snapshot's own version makes
 * the command refuse instead, which is the answer a user can act on.
 *
 * **Captured PER EXECUTE, which is what keeps redo working.** The caller's own `expected` — an
 * optimistic claim about what it read — is honoured on the first execute and spent there: a
 * redo re-reads and conditions on what it finds, because by then the caller has already seen
 * this gesture land and its claim describes a version two writes ago. Holding the caller's
 * value across every execute makes redo refuse deterministically, which is the defect this
 * split exists to avoid.
 */
class ReversibleAssetGeometryEdit<TInput extends AssetShapeInput>
	extends ReversibleAssetEdit<TInput>
	implements ReversibleAssetDesignEdit
{
	private inverse: {
		readonly document: AssetGeometryDocument;
		readonly preVersion: EntityVersion;
		/**
		 * The ledger generation this execute ran under, captured WITH the document it belongs
		 * to rather than beside it — an inverse and the premise it rests on are one fact, and a
		 * separate field is one a later edit can forget to refresh on a redo.
		 */
		readonly generation: number;
	} | null = null;

	async execute(): Promise<DispatchResult> {
		const { sidecar, geometryLedger } = this.deps;
		const assetId = this.input.assetId;
		// BEFORE the forward write, or there is nothing to capture: the command replaces the
		// whole document, so a read taken afterwards describes the state being undone TO
		// nothing at all.
		const before = await sidecar.read(assetId);
		if (isErr(before)) return before;

		// The one place this adapter can SEE a foreign write: two readings of the same
		// resource, one of them this history's own. Asked before the forward write, so the
		// inverse captured below is known to post-date whatever it finds.
		const generation = geometryLedger.observe(assetId, before.value.version);

		const ran = await this.runForward(before.value.version);
		// A refusal wrote nothing and a `no-write` wrote nothing: neither has an inverse, and
		// capturing one would let a later undo write a document no gesture had replaced. An
		// earlier inverse from a previous `execute` is deliberately KEPT — the net effect of
		// "wrote, then wrote nothing" is still the first write.
		if (isErr(ran)) return ran;
		if (ran.value.outcome === 'no-write') return ok('no-write');

		this.inverse = { document: before.value.document, preVersion: before.value.version, generation };
		// The version the command's own write produced. A read-back here would straddle the
		// third window — a peer landing in it is recorded as ours, and the undo then presents
		// their version, matches, and restores over their edit.
		geometryLedger.record(assetId, ran.value.version);
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const inverse = this.inverse;
		// Nothing was written, or the inverse has already been spent. Both are honestly
		// `no-write`: `ok` is not a claim that anything reached the vault, and this is the one
		// answer that keeps the save indicator from clearing a real `save-error`.
		if (inverse === null) return ok('no-write');

		const { sidecar, events, geometryLedger } = this.deps;
		const assetId = this.input.assetId;
		if (this.supersededSince(geometryLedger, inverse.generation)) return err(undoSuperseded(assetId));
		const expected = geometryLedger.lastWritten(assetId) ?? inverse.preVersion;
		const written = await sidecar.write(assetId, inverse.document, expected);
		if (isErr(written)) return written;

		// The restore is a write like any other, so it records — or the next undo down the
		// stack presents a revision the sidecar no longer has (`WriteLedger` states that rule
		// once for every adapter). It records the version the write ITSELF returned, so unlike
		// the forward path there is no read-back and no window to lose.
		geometryLedger.record(assetId, written.value);
		this.inverse = null;
		await events.publish(assetDesignChanged({ assetId }));
		return ok('wrote');
	}
}

/**
 * The inverse of a command that writes the asset's NOTE — `SetAssetHeight` today, and Task
 * B7's background alongside it.
 *
 * It captures the whole `Asset`, not its height: an inverse built from one field would have to
 * be re-derived per command, and the entity is what the repository takes anyway. Restoring the
 * whole entity cannot revert a neighbour's edit, because the write is conditional — anybody
 * else's write moves the version and the restore is refused rather than applied.
 *
 * **The restore goes through the repository rather than back through
 * `SetAssetHeightCommand`.** Both were available and this one is the symmetric half of the
 * geometry adapter above: a whole-snapshot conditional write that hands back the version it
 * produced, so the ledger records what the store really minted rather than what a read-back
 * happened to find afterwards.
 */
class ReversibleAssetNoteEdit<TInput extends AssetShapeInput>
	extends ReversibleAssetEdit<TInput>
	implements ReversibleAssetDesignEdit
{
	private inverse: {
		readonly entity: Asset;
		readonly preVersion: EntityVersion;
		/** See the geometry adapter's field of this name: an inverse and its premise are one fact. */
		readonly generation: number;
	} | null = null;

	async execute(): Promise<DispatchResult> {
		const { assets, noteLedger } = this.deps;
		const assetId = this.input.assetId;
		const before = await assets.getById(assetId);
		// A failed READ and an ABSENT asset stay two answers, for the reason `assetNotFound`
		// records: collapsing them tells a user their catalogue entry is gone about a note
		// whose bytes are sitting on disk. The wrapped command asks the same question — it has
		// to, it writes the note — and this asks it again because the SNAPSHOT is what it needs
		// and a snapshot of nothing is not one.
		if (isErr(before)) return before;
		if (before.value === null) return err(assetNotFound(assetId));

		// The note half of the same observation the geometry adapter makes, and it catches more
		// than a peer designer: `UpdateAssetCommand` renaming this asset moves the note's
		// version too, and this inverse restores the WHOLE entity — so an undo past a rename
		// would revert the name. Refusing is the right answer there rather than a cautious one.
		const generation = noteLedger.observe(assetId, before.value.version);

		// `SetAssetHeightCommand` reads the note itself, so this adapter straddles the same
		// two-read window the geometry one does — `runForward` states that rule for both.
		const ran = await this.runForward(before.value.version);
		if (isErr(ran)) return ran;
		if (ran.value.outcome === 'no-write') return ok('no-write');

		this.inverse = { entity: before.value.entity, preVersion: before.value.version, generation };
		noteLedger.record(assetId, ran.value.version);
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const inverse = this.inverse;
		if (inverse === null) return ok('no-write');

		const { assets, events, noteLedger } = this.deps;
		const assetId = this.input.assetId;
		if (this.supersededSince(noteLedger, inverse.generation)) return err(undoSuperseded(assetId));
		const expected = noteLedger.lastWritten(assetId) ?? inverse.preVersion;
		const saved = await assets.save(inverse.entity, expected);
		if (isErr(saved)) return saved;

		noteLedger.record(assetId, saved.value.version);
		this.inverse = null;
		// A restore that announced nothing would leave every OTHER designer leaf on the forward
		// state until something unrelated woke it — the staleness Task B3a closed for the
		// forward path, re-entering through the inverse.
		await events.publish(assetDesignChanged({ assetId }));
		return ok('wrote');
	}
}

/**
 * The inverse of `SetAssetBackground` (Task B7) — the first inverse in this file that spans
 * BOTH resources, because the command it wraps writes both: the note's reference and the
 * sidecar's calibration, cleared in the same gesture (Decision 5).
 *
 * **A snapshot narrowed to the background field would restore the old REFERENCE over an
 * erased calibration**, which is not the pre-command state — the exact half of Decision 5 a
 * re-derived snapshot rule misses, and the reason B3b's own relocated case seeds a CALIBRATED
 * asset before dispatching. So the inverse captures the whole NOTE entity and the whole
 * SIDECAR document, exactly as `ReversibleAssetNoteEdit` and `ReversibleAssetGeometryEdit`
 * each capture their own resource, and restores both on undo.
 *
 * **Two ledgers, two generations, one inverse** — the pair travels together because both
 * reads happen before the same forward write, and a caller undoing this gesture is undoing
 * ONE thing the user did, not two independently supersedable ones.
 *
 * **`expected` names the NOTE version**, matching `SetAssetBackgroundInput`'s own field: the
 * sidecar clear is a housekeeping side effect of this gesture that no caller versions
 * independently, exactly as the wrapped command itself conditions the sidecar write on
 * whatever its own read found rather than on anything the caller supplied.
 *
 * **The GEOMETRY version this adapter needs to condition its own restore on is not the one
 * `runForward` returns, and the first draft of this class got that wrong — measured, not
 * assumed: the relocated case failed with `asset-geometry.revision-conflict` on every run.**
 * `VersionedDispatch.version` names the NOTE (this command's primary resource, per
 * `SetAssetBackgroundInput.expected`'s own docblock), so recording only it left the geometry
 * ledger holding the PRE-clear version forever — undo then presented that stale version to a
 * sidecar the clear write had already moved past, refusing every time. A read-back after the
 * forward write would reopen exactly the peer-write window `VersionedDispatch`'s own docblock
 * describes and this file already paid to close once; the fix is what that same docblock calls
 * for instead — the command reports the second version it produced.
 * `VersionedDispatch.secondaryVersion` is that report, `SetAssetBackground.ts` is its one
 * writer, and this is its one reader.
 *
 * **Undo restores in the REVERSE of the forward order** — the note first, then the sidecar —
 * mirroring `deleteResolution.ts`'s "undo is the same compensated sequence run backwards".
 * A failure restoring the sidecar AFTER the note has already been put back is a genuinely
 * half-undone state — the note points at the OLD reference again, but the calibration that
 * reference implies is still gone — so it is reported the same way the forward command's own
 * compensation failure is: `markUncompensated`, not swallowed. The inverse is kept rather
 * than cleared in that case, so a retry re-attempts the (idempotent) note write and the
 * still-outstanding sidecar restore rather than losing the gesture's inverse outright.
 */
class ReversibleAssetBackgroundEdit
	extends ReversibleAssetEdit<SetAssetBackgroundInput>
	implements ReversibleAssetDesignEdit
{
	private inverse: {
		readonly entity: Asset;
		readonly notePreVersion: EntityVersion;
		readonly noteGeneration: number;
		readonly document: AssetGeometryDocument;
		readonly geometryPreVersion: EntityVersion;
		readonly geometryGeneration: number;
	} | null = null;

	async execute(): Promise<DispatchResult> {
		const { assets, sidecar, noteLedger, geometryLedger } = this.deps;
		const assetId = this.input.assetId;

		const beforeNote = await assets.getById(assetId);
		if (isErr(beforeNote)) return beforeNote;
		if (beforeNote.value === null) return err(assetNotFound(assetId));
		const noteGeneration = noteLedger.observe(assetId, beforeNote.value.version);

		const beforeGeometry = await sidecar.read(assetId);
		if (isErr(beforeGeometry)) return beforeGeometry;
		const geometryGeneration = geometryLedger.observe(assetId, beforeGeometry.value.version);

		// The NOTE's pre-write version is what this gesture's own `expected` claim is about —
		// `runForward` states the rule; `SetAssetBackgroundCommand` reads the sidecar itself
		// and conditions that half of its write on nothing this adapter supplies.
		const ran = await this.runForward(beforeNote.value.version);
		if (isErr(ran)) return ran;
		if (ran.value.outcome === 'no-write') return ok('no-write');

		this.inverse = {
			entity: beforeNote.value.entity,
			notePreVersion: beforeNote.value.version,
			noteGeneration,
			document: beforeGeometry.value.document,
			geometryPreVersion: beforeGeometry.value.version,
			geometryGeneration,
		};
		noteLedger.record(assetId, ran.value.version);
		// `secondaryVersion` is the SIDECAR's — the version the command's own calibration-clear
		// write produced. Without recording it, the geometry ledger stays at its PRE-clear
		// entry and the undo below conditions the restore on a version the store has already
		// moved past, refusing every time. `VersionedDispatch`'s own docblock states why this
		// is a reported value rather than a read-back.
		if (ran.value.secondaryVersion !== undefined) {
			geometryLedger.record(assetId, ran.value.secondaryVersion);
		}
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const inverse = this.inverse;
		if (inverse === null) return ok('no-write');

		const { assets, sidecar, events, noteLedger, geometryLedger } = this.deps;
		const assetId = this.input.assetId;
		if (this.supersededSince(noteLedger, inverse.noteGeneration)) return err(undoSuperseded(assetId));
		if (this.supersededSince(geometryLedger, inverse.geometryGeneration)) return err(undoSuperseded(assetId));

		const noteExpected = noteLedger.lastWritten(assetId) ?? inverse.notePreVersion;
		const savedNote = await assets.save(inverse.entity, noteExpected);
		if (isErr(savedNote)) return savedNote;
		noteLedger.record(assetId, savedNote.value.version);

		const geometryExpected = geometryLedger.lastWritten(assetId) ?? inverse.geometryPreVersion;
		const savedGeometry = await sidecar.write(assetId, inverse.document, geometryExpected);
		if (isErr(savedGeometry)) {
			// The note IS restored; the calibration it implies is not. Reported rather than
			// swallowed, for `DispatchOutcome`'s reason: a "Saved" badge here would claim a
			// vault as safe as it was before, which it is not.
			return err(markUncompensated(savedGeometry.error));
		}
		geometryLedger.record(assetId, savedGeometry.value);

		this.inverse = null;
		await events.publish(assetDesignChanged({ assetId }));
		return ok('wrote');
	}
}

/**
 * One reversible adapter per asset design command (Task B3b, PRD §88).
 *
 * Each method mints a PER-GESTURE adapter — the shape `inspector-wiring.ts` already uses —
 * rather than one long-lived object per command: an inverse belongs to the one write it
 * inverts, and `CommandHistory` holds a stack of gestures rather than of commands.
 *
 * **Why this exists at all.** Task B3a wired `CommandHistory` and the designer's toolbar
 * advertises undo and redo; until these adapters, both buttons had nothing to reverse. Every
 * design command is a read-merge-write against one document, so the inverse is the same write
 * with the document as it was — and "as it was" has to be captured BEFORE the forward write,
 * by the gesture itself, because a later reader cannot reconstruct it.
 *
 * **NONE of the eight factories below carries a `fallow-ignore-next-line unused-class-member`
 * mark any longer — it was four, then one, and Task B8's `setFootprintFromDimensions` call is
 * what cleared the last of them, exactly the exit condition this paragraph documented three
 * tasks early.** Fallow resolves a class's members through the annotation where the CONSUMING
 * expression sits. All six were once reached only from the test suite; four of them only
 * through `tests/helpers/assetDesignHarness.ts` — an inferred object property, which it does
 * not follow — while `setFootprint` and `setHeight` were also called on a local the
 * silent-ledger cases build with a bare `new ReversibleAssetDesignCommands(…)`, which it does.
 *
 * There were no marks at all while every case lived in one file beside an annotated
 * `const reversible: ReversibleAssetDesignCommands`; the 450-line test budget split those
 * cases into two files and all six were reported at once. Measured, not guessed, and in three
 * steps: an annotated local at ONE consuming site clears exactly the doors that site calls, an
 * annotation on a DESTRUCTURING pattern (`const { reversible }: AssetDesignHarness = …`)
 * clears none, and a `new` expression assigned to an inferred local clears the doors called on
 * it — which is what turned two of these marks stale and is a finding of the gate rather than
 * of a reader.
 *
 * The last mark was on `setFootprintFromDimensions`, whose only caller was still a test:
 * design slice B5's `registerDesignerTools` reaches `setFootprint`, `setClearance`,
 * `setAnchor` and `setFacing` from `src/`, so those four marks went STALE the moment it landed
 * and fallow reported all three of the ones it had left. That is what this paragraph said
 * would happen — "the marks go the day something in `src/` constructs this class" — and it was
 * the day. `setFootprintFromDimensions` kept its mark until Task B8's dimensions dialog called
 * it, which was the last consumer this class was missing.
 *
 * **Task B6 took that invitation, Task B7 took the next, and Task B8 has now taken the last of
 * it.** This paragraph read "Tasks B6 and B7 extend this module rather than starting a second
 * one" through B7, and all three have: B6's `calibrate` is one more factory over the geometry
 * adapter already here; B7's `setBackground` is `ReversibleAssetBackgroundEdit` — the NOTE
 * adapter and the geometry one together, since it writes the reference and clears the
 * calibration, the first inverse in this file that spans both resources; and B8's
 * `setFootprintFromDimensions` above needed no new mechanism, only a caller — `runtime.ts`'s
 * `setFootprintFromDimensions` reaches it through the same annotated
 * `edits: ReversibleAssetDesignCommands` local that already cleared `setBackground`'s mark in
 * Task B7. Neither carries a `fallow-ignore-next-line` mark now: each got a real `src/` caller
 * in the same task that added its factory (B7's `noBackground` empty-state action, B8's
 * `asset-dimensions` dialog).
 */
export class ReversibleAssetDesignCommands {
	constructor(
		private readonly deps: ReversibleAssetDesignDeps,
		private readonly commands: AssetDesignCommandBundle,
	) {}

	setFootprintFromDimensions(input: SetAssetFootprintFromDimensionsInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setFootprintFromDimensions, input);
	}

	setFootprint(input: SetAssetFootprintInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setFootprint, input);
	}

	setClearance(input: SetAssetClearanceInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setClearance, input);
	}

	setAnchor(input: SetAssetAnchorInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setAnchor, input);
	}

	setFacing(input: SetAssetFacingInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setFacing, input);
	}

	setHeight(input: SetAssetHeightInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetNoteEdit(this.deps, this.commands.setHeight, input);
	}

	/**
	 * Task B6's calibration, through the GEOMETRY adapter like every other sidecar write.
	 *
	 * It needs no mechanism of its own, and that is the payoff of capturing the whole document
	 * rather than the one attribute a command owns: a calibration moves the calibration, three
	 * coordinate groups and three pending flags in one write, and putting the previous bytes
	 * back undoes all seven of those without this adapter naming any of them.
	 */
	calibrate(input: CalibrateAssetInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.calibrate, input);
	}

	/**
	 * Task B7's background, through the ONE adapter that spans both resources — see
	 * `ReversibleAssetBackgroundEdit`'s own docblock for why neither of the other two shapes
	 * fits.
	 */
	setBackground(input: SetAssetBackgroundInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetBackgroundEdit(this.deps, this.commands.setBackground, input);
	}
}
