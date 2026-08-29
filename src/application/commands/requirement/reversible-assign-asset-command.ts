import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	DomainError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { UNIT_KIND } from '../../../core/units/MeasurementUnit';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { EntityVersion } from '../../ports/versioning';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type { Command } from '../Command';
import type { DispatchOutcome } from '../DispatchOutcome';
import type {
	AssignAssetInput,
	AssignAssetResult,
	AssignAssetErrors,
} from './AssignAsset';

/**
 * Structurally the presentation layer's `UndoableCommand` — application code may not name
 * that interface (the layer ban), and satisfying it structurally is what lets
 * `CommandHistory.run()` hold it without this layer importing downward.
 *
 * PRD §68 names `AssignAssetCommand` undoable; `CommandHistory` takes an undoable and
 * nothing else, so a plain command cannot be dispatched from the Inspector at all.
 */
export interface ReversibleAssignResult {
	readonly requirementId: RequirementId;
	/**
	 * Whether this call touched the vault. **Not derivable from `requirementId`, which is
	 * present either way** — that is the whole reason it is here rather than inferred at the
	 * dispatch site. An assignment of an asset already linked to the zone resolves `ok` from a
	 * read having saved nothing, and design slice 13's save indicator read that `ok` as a
	 * successful write and cleared a `save-error` raised by a real persistence failure.
	 * `DispatchOutcome`'s own header carries the argument.
	 */
	readonly outcome: DispatchOutcome;
}

type AdapterErrors = DomainError | CalculationError | ReferenceError | RepositoryError;

/**
 * The adapter the Inspector's "Assign Asset" control actually dispatches.
 *
 * What it remembers is NOT a previous value but one fact the requirement alone does not
 * carry: whether this call CREATED it or FOUND an existing one. The flag is read from the
 * command's result, never inferred from a read the adapter took itself — two tabs
 * assigning the same pair both see nothing first, then serialize on the locks, and an
 * inference taken before dispatch would make the second tab's undo delete a link its user
 * never made. Undo deletes only what execute created, conditional on the revision execute
 * produced; a conflict (another tab overrode or recalculated since) refuses rather than
 * taking the edit with it.
 *
 * Redo restores under the ORIGINAL ID but revalidates like any create: it re-acquires
 * both endpoint locks and re-runs the existence, project and unit-kind checks against the
 * current world, carrying over only the ID. It can therefore fail, which is correct —
 * slice 6 keeps a refused redo on the redo stack rather than half-applying it.
 */
export interface ReversibleAssignDeps {
	readonly requirements: RequirementRepository;
	readonly zones: ZoneRepository;
	readonly assets: AssetRepository;
	readonly locks: ReferenceLocks;
}

export class ReversibleAssignAssetCommand {
	private outcome:
		| { readonly kind: 'created'; readonly snapshot: Requirement; readonly version: EntityVersion }
		| { readonly kind: 'found' }
		| undefined;

	constructor(
		private readonly assignCommand: Command<AssignAssetInput, Result<AssignAssetResult, AssignAssetErrors>>,
		private readonly deps: ReversibleAssignDeps,
		private readonly input: AssignAssetInput,
	) {}

	async execute(): Promise<Result<ReversibleAssignResult, AdapterErrors>> {
		if (this.outcome?.kind === 'created') {
			return this.redoCreate();
		}
		const result: Result<AssignAssetResult, AdapterErrors> = await this.assignCommand.execute(this.input);
		if (!result.ok) return result;
		this.outcome = result.value.created
			? { kind: 'created', snapshot: result.value.requirement, version: result.value.version }
			: { kind: 'found' };
		// `created` is the command's own answer to "did I write", decided under both endpoint
		// locks — see its declaration on `AssignAssetResult`. Reporting it onward rather than
		// re-deriving it is the same reason this adapter reads it for the undo half.
		return ok({
			requirementId: result.value.requirement.id,
			outcome: result.value.created ? 'wrote' : 'no-write',
		});
	}

	async undo(): Promise<Result<DispatchOutcome, AdapterErrors>> {
		const recorded = this.outcome;
		if (!recorded) {
			return err({ category: 'Domain', code: 'undo.before-execute', message: 'Nothing to undo yet.' });
		}
		// Undo deletes only what execute CREATED, so an execute that found an existing link has
		// nothing to delete — a success that writes nothing, and the second of the two this
		// class contributes to `DispatchOutcome`'s list.
		if (recorded.kind === 'found') return ok('no-write');
		// Conditional on the revision THIS execute() produced: an override or
		// recalculation landed since is a conflict, not a casualty.
		const deleted = await this.deps.requirements.delete(recorded.snapshot.id, recorded.version);
		if (isErr(deleted)) return err(deleted.error);
		return ok('wrote');
	}

	private async redoCreate(): Promise<Result<ReversibleAssignResult, AdapterErrors>> {
		const recorded = this.outcome as { kind: 'created'; snapshot: Requirement; version: EntityVersion };
		const release = await this.deps.locks.acquire([this.input.zoneId, this.input.assetId], []);
		try {
			// Re-run AssignAssetCommand's checks against the CURRENT entities. The gap
			// between undo and redo is ordinary editing time, and the undo itself opened
			// it: with the requirement gone the asset is unreferenced, so a unit change
			// the creation-time guard would have refused is now in force.
			const zone = await this.deps.zones.getById(this.input.zoneId);
			if (isErr(zone) || zone.value === null) {
				return err({ category: 'Reference', code: 'requirement.zone-not-found', message: 'The zone is gone.' });
			}
			const asset = await this.deps.assets.getById(this.input.assetId);
			if (isErr(asset) || asset.value === null) {
				return err({ category: 'Reference', code: 'requirement.asset-not-found', message: 'The asset is gone.' });
			}
			if (zone.value.entity.projectId !== asset.value.entity.projectId) {
				return err({ category: 'Validation', code: 'requirement.cross-project', message: 'Projects no longer match.' });
			}
			if (UNIT_KIND[asset.value.entity.unit] !== 'area') {
				return err({
					category: 'Validation',
					code: 'requirement.unit-not-area',
					message: 'The asset is no longer area-kind.',
				});
			}
			// Only the ID is carried over; validity was just re-established.
			const saved = await this.deps.requirements.save(recorded.snapshot, 'absent');
			if (isErr(saved)) return err(saved.error);
			return ok({ requirementId: saved.value.entity.id, outcome: 'wrote' });
		} finally {
			release();
		}
	}
}
