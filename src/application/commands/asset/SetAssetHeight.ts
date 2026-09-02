import { err, isErr, ok } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { AssetId } from '../../../domain/asset/AssetId';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import { assetNotFound } from '../../../domain/asset/Asset.errors';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { EntityVersion } from '../../ports/versioning';

export interface SetAssetHeightInput {
	readonly assetId: AssetId;
	/** Millimetres, or `null` to say nothing about how tall this asset is. */
	readonly height: number | null;
	readonly expected?: EntityVersion;
}

/**
 * How tall an asset is — the one scalar of its design that lives in the NOTE rather than in
 * the geometry sidecar, and therefore the one design command that does not go through
 * `updateAssetShape`.
 *
 * **Why the boundary falls here.** The sidecar holds a coordinate space: a footprint, a
 * clearance, an anchor, a facing, the calibration that scales them and the provenance flags
 * that say whether they have been scaled yet. A height is none of that — it is one number
 * nobody draws and nothing converts, so putting it in `.rpgeo` would hide it from every
 * reader without this plugin for no gain, while the note's frontmatter is exactly where a
 * plain fact about a catalogue entry belongs. The cost of the split is real and is paid
 * here: this command re-derives, from scratch, the four guarantees `updateAssetShape` holds
 * for its five callers.
 *
 * 1. **Validate through the entity, never beside it.** `withChanges` re-runs the whole smart
 *    constructor, so a height is refused by the same gate that refuses one arriving from a
 *    hand-edited note. A guard written here as well would be a second answer to one question,
 *    and the read boundary's arm would be the one to rot.
 * 2. **`no-write` is a report, not an optimisation.** `ok` is not evidence that anything was
 *    written and the save indicator infers nothing from it, so re-submitting the height an
 *    asset already carries has to say so — otherwise a "Saved" badge claims a write that
 *    never happened, and clears a `save-error` a real persistence failure left behind. It
 *    returns before the repository is reached, which is why a stale `expected` over an
 *    unchanged height is not a conflict: there is no field left to lose.
 * 3. **`expected ?? version` and never `undefined`.** An unconditional save is a lost update
 *    the moment two designer leaves show one asset. The version this command's own read
 *    returned is the weakest honest condition — it refuses exactly the writes that landed
 *    since it looked — and a caller with a stronger one (a reversible adapter's undo) says so.
 * 4. **`AssetDesignChanged`, on the `'wrote'` arm alone**, below the no-write return and
 *    below the repository's own answer: the event means "the stored design changed", not
 *    "somebody pressed something". Deliberately NOT `AssetUpdated`, which slice 10's
 *    recalculation cascade subscribes to — a height is an input to no quantity and no cost
 *    and is absent from `calculatedFrom`, so announcing it there would be a behaviour change
 *    wearing a name's clothes. The same argument `AssetDesignChanged`'s own docblock makes
 *    for a footprint edit, and it is what makes a height a DESIGN change rather than a
 *    catalogue one.
 *
 * A failed READ and an ABSENT asset stay two answers, for the reason `assetNotFound` records:
 * collapsing them tells a user their catalogue entry is gone about a note whose bytes are
 * sitting on disk.
 */
export class SetAssetHeightCommand implements Command<SetAssetHeightInput, DispatchResult> {
	constructor(
		private readonly assets: AssetRepository,
		private readonly events: EventBus,
	) {}

	execute(input: SetAssetHeightInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version the repository minted —
	 * the pair `SetRequirementQuantityOverrideCommand` already spells, and the one thing an
	 * undo cannot rediscover safely afterwards (`VersionedDispatch` carries that account).
	 */
	async executeWithVersion(input: SetAssetHeightInput): Promise<VersionedDispatchResult> {
		const loaded = await this.assets.getById(input.assetId);
		if (isErr(loaded)) return loaded;
		if (loaded.value === null) return err(assetNotFound(input.assetId));
		const { entity: current, version } = loaded.value;

		const candidate = current.withChanges({ height: input.height });
		if (isErr(candidate)) return candidate;
		// Compared on the CANDIDATE rather than on the input, so the question asked is
		// "would this replace what is stored" over two values that have each been through
		// the same constructor — the shape `updateAssetShape`'s `unchanged` callbacks take.
		if (candidate.value.height === current.height) return ok({ outcome: 'no-write' });

		const saved = await this.assets.save(candidate.value, input.expected ?? version);
		if (isErr(saved)) return saved;
		await this.events.publish(assetDesignChanged({ assetId: input.assetId }));
		return ok({ outcome: 'wrote', version: saved.value.version });
	}
}
