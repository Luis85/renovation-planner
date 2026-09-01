import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import { assetNotFound } from '../../../domain/asset/Asset.errors';
import type { Command } from '../../commands/Command';
import type { DispatchResult } from '../../commands/DispatchOutcome';
import type { AssetShapeInput } from '../../commands/asset/updateAssetShape';
import type {
	SetAssetFootprintFromDimensionsInput,
	SetAssetFootprintInput,
} from '../../commands/asset/SetAssetFootprint';
import type { SetAssetClearanceInput } from '../../commands/asset/SetAssetClearance';
import type { SetAssetAnchorInput } from '../../commands/asset/SetAssetAnchor';
import type { SetAssetFacingInput } from '../../commands/asset/SetAssetFacing';
import type { SetAssetHeightInput } from '../../commands/asset/SetAssetHeight';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../ports/AssetGeometrySidecar';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { EntityVersion } from '../../ports/versioning';
import type { WriteLedger } from '../WriteLedger';

/**
 * The six design commands this module inverts, as DOORS rather than as classes.
 *
 * Structural on purpose: the composition root hands presentation a GUARDED facade (design
 * slice 11), which is a wrapper object and never an instance, so naming the concrete command
 * classes here would make each one a nominal dependency and quietly put this whole module
 * outside the Error Boundary. `SetRequirementQuantityOverrideDoor` records the same
 * relaxation for the same reason, one adapter over.
 *
 * Six doors and FIVE mechanisms: both footprint commands are inverted by the same geometry
 * adapter, because what an inverse restores is the sidecar's whole document and neither of
 * them writes anything else.
 */
export interface AssetDesignCommandBundle {
	readonly setFootprintFromDimensions: Command<SetAssetFootprintFromDimensionsInput, DispatchResult>;
	readonly setFootprint: Command<SetAssetFootprintInput, DispatchResult>;
	readonly setClearance: Command<SetAssetClearanceInput, DispatchResult>;
	readonly setAnchor: Command<SetAssetAnchorInput, DispatchResult>;
	readonly setFacing: Command<SetAssetFacingInput, DispatchResult>;
	readonly setHeight: Command<SetAssetHeightInput, DispatchResult>;
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
	/** For the five geometry commands, and for Task B6's calibration. */
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
 * Record what a write LEFT BEHIND, having read it back.
 *
 * **The commands do not report the version they wrote**, and this is the whole of the cost.
 * `updateAssetShape` and `SetAssetHeightCommand` both resolve a bare `DispatchResult`, so an
 * adapter wrapping them learns the post-write version by asking the port again. The
 * alternative was a second `executeWithVersion` door on each of six commands — the shape the
 * two Inspector override adapters take — and it is declined HERE rather than deferred: a
 * second door is a second thing the Error Boundary must wrap (`guardBothDoors` exists because
 * a guard on the door nobody dispatches through is a guard nobody has), and this task wires no
 * composition root and so could not discharge that obligation.
 *
 * **A read-back that faults, or that finds the entity gone, leaves the ledger EXACTLY where it
 * was, and that is the safe direction rather than an oversight.** The undo then presents a
 * version the store has moved past and is refused, which is the fail-closed answer; the
 * alternatives are worse in both directions. Returning the fault as the dispatch's failure
 * would keep a gesture whose write LANDED off the undo stack, and — through
 * `markUncompensated` — badge a save error over data the vault holds. Recording a guessed
 * version would let the undo overwrite whatever really is there.
 *
 * **What it cannot close** is the window between the command's write and this read: a third
 * party writing in it is recorded as ours, and an undo would then overwrite that write. Only a
 * version reported by the write itself closes that, which is the `executeWithVersion` door
 * above.
 */
async function recordWritten(
	ledger: WriteLedger,
	assetId: AssetId,
	read: Promise<Result<{ readonly version: EntityVersion } | null, AppError>>,
): Promise<void> {
	const found = await read;
	if (isErr(found) || found.value === null) return;
	ledger.record(assetId, found.value.version);
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
 */
class ReversibleAssetGeometryEdit<TInput extends AssetShapeInput> implements ReversibleAssetDesignEdit {
	private inverse: { readonly document: AssetGeometryDocument; readonly preVersion: EntityVersion } | null = null;

	constructor(
		private readonly deps: ReversibleAssetDesignDeps,
		private readonly command: Command<TInput, DispatchResult>,
		private readonly input: TInput,
	) {}

	async execute(): Promise<DispatchResult> {
		const { sidecar, geometryLedger } = this.deps;
		const assetId = this.input.assetId;
		// BEFORE the forward write, or there is nothing to capture: the command replaces the
		// whole document, so a read taken afterwards describes the state being undone TO
		// nothing at all.
		const before = await sidecar.read(assetId);
		if (isErr(before)) return before;

		const ran = await this.command.execute(this.input);
		// A refusal wrote nothing and a `no-write` wrote nothing: neither has an inverse, and
		// capturing one would let a later undo write a document no gesture had replaced. An
		// earlier inverse from a previous `execute` is deliberately KEPT — the net effect of
		// "wrote, then wrote nothing" is still the first write.
		if (isErr(ran) || ran.value === 'no-write') return ran;

		this.inverse = { document: before.value.document, preVersion: before.value.version };
		await recordWritten(geometryLedger, assetId, sidecar.read(assetId));
		return ran;
	}

	async undo(): Promise<DispatchResult> {
		const inverse = this.inverse;
		// Nothing was written, or the inverse has already been spent. Both are honestly
		// `no-write`: `ok` is not a claim that anything reached the vault, and this is the one
		// answer that keeps the save indicator from clearing a real `save-error`.
		if (inverse === null) return ok('no-write');

		const { sidecar, events, geometryLedger } = this.deps;
		const assetId = this.input.assetId;
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
class ReversibleAssetNoteEdit<TInput extends AssetShapeInput> implements ReversibleAssetDesignEdit {
	private inverse: { readonly entity: Asset; readonly preVersion: EntityVersion } | null = null;

	constructor(
		private readonly deps: ReversibleAssetDesignDeps,
		private readonly command: Command<TInput, DispatchResult>,
		private readonly input: TInput,
	) {}

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

		const ran = await this.command.execute(this.input);
		if (isErr(ran) || ran.value === 'no-write') return ran;

		this.inverse = { entity: before.value.entity, preVersion: before.value.version };
		await recordWritten(noteLedger, assetId, assets.getById(assetId));
		return ran;
	}

	async undo(): Promise<DispatchResult> {
		const inverse = this.inverse;
		if (inverse === null) return ok('no-write');

		const { assets, events, noteLedger } = this.deps;
		const assetId = this.input.assetId;
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
 * **Tasks B6 and B7 extend this module rather than starting a second one.** Their commands
 * (`CalibrateAsset`, `SetAssetBackground`) do not exist yet, which is why their adapters are
 * not here; what this task owes them is the shared design — the two ledgers, the
 * capture-before-write rule, and the structural `UndoableCommand` conformance — so that "one
 * reversible adapter per design command" stays a fact about a file.
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
}
