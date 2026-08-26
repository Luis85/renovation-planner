import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	DomainError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import { UNIT_KIND } from '../../../core/units/MeasurementUnit';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { EntityVersion } from '../../ports/versioning';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type {
	AssignAssetCommand,
	AssignAssetInput,
	AssignAssetResult,
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
}

type AdapterErrors = DomainError | ValidationError | CalculationError | ReferenceError | PersistenceError;

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
		private readonly assignCommand: AssignAssetCommand,
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
		return ok({ requirementId: result.value.requirement.id });
	}

	async undo(): Promise<Result<void, AdapterErrors>> {
		const recorded = this.outcome;
		if (!recorded) {
			return err({ category: 'Domain', code: 'undo.before-execute', message: 'Nothing to undo yet.' });
		}
		if (recorded.kind === 'found') return ok(undefined);
		// Conditional on the revision THIS execute() produced: an override or
		// recalculation landed since is a conflict, not a casualty.
		const deleted = await this.deps.requirements.delete(recorded.snapshot.id, recorded.version);
		if (isErr(deleted)) return err(deleted.error);
		return ok(undefined);
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
			return ok({ requirementId: saved.value.entity.id });
		} finally {
			release();
		}
	}
}
