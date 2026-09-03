import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { effectiveValue } from '../../../core/derived/DerivedValue';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { Asset } from '../../../domain/asset/Asset';
import { requirementRecalculated } from '../../../domain/requirement/Requirement.events';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { EventBus } from '../../../core/events/EventBus';
import { calculationError } from '../../errors';
import type { Command } from '../Command';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import { loadAsset } from './AssignAsset';
import { loadZone } from '../zone/loadZone';
import { loadRequirement } from './loadRequirement';
import { deriveRequirementFigures } from './deriveRequirementFigures';
import { resolveEffectiveUnitCost } from './resolveEffectiveUnitCost';
import { publishIfEffectiveCostChanged } from './SetRequirementQuantityOverride';

export interface RecalculateRequirementInput {
	readonly requirementId: RequirementId;
}

export type RecalculateRequirementErrors =
	| CalculationError
	| ReferenceError
	| RepositoryError;

/** One bundle instead of six positional collaborators (the max-params budget). */
export interface RecalculateRequirementDeps {
	readonly requirements: RequirementRepository;
	readonly zones: ZoneRepository;
	readonly assets: AssetRepository;
	readonly events: EventBus;
	readonly projects: ProjectRepository;
	/** The precedence's input half: a project may price a shared asset in its own currency. */
	readonly overrides: AssetPriceOverrideRepository;
}

/**
 * Re-runs the derivation pipeline for one Requirement against the CURRENT world and
 * persists quantity, cost, `calculatedFrom` and `recalculationStatus: "current"` in ONE
 * save (§42-style single logical write) — the only writer allowed to clear the stale
 * marker, because it is the only thing that has actually re-derived the figures.
 *
 * A dangling endpoint is a CalculationError, not a crash: the cascade caller treats it as
 * "this requirement stays visibly stale", which is exactly what the marker it persisted a
 * moment ago already says. The save takes the version this command's own read produced —
 * every writer passes an expectation; a blind last-write-wins would be the lost update
 * this repository contract exists to prevent.
 */
export class RecalculateRequirementCommand
	implements
		Command<RecalculateRequirementInput, Result<Requirement, RecalculateRequirementErrors>>
{
	constructor(private readonly deps: RecalculateRequirementDeps) {}

	async execute(
		input: RecalculateRequirementInput,
	): Promise<Result<Requirement, RecalculateRequirementErrors>> {
		const loaded = await loadRequirement(this.deps.requirements, input.requirementId);
		if (isErr(loaded)) return err(loaded.error);
		const requirement = loaded.value.entity;

		if (requirement.origin.kind !== 'zone') {
			return err(
				calculationError(
					'requirement.unsupported-origin',
					`Requirement ${requirement.id} has origin kind "${String(requirement.origin.kind)}", `
						+ 'which no derivation rule covers yet.',
				),
			);
		}
		const zone = await loadZone(this.deps.zones, requirement.origin.zoneId);
		if (isErr(zone)) {
			return err(calculationError('requirement.zone-gone', zone.error.message, zone.error));
		}
		const asset = await loadAsset(this.deps.assets, requirement.assetId);
		if (isErr(asset)) {
			return err(calculationError('requirement.asset-gone', asset.error.message, asset.error));
		}
		// The guard at creation can be bypassed by a hand-edited note or a migration; a
		// recalculation that relabeled an area as a length would be the silent-mislabeling
		// bug the assignment check exists to prevent, so it refuses here too.
		const pricedAgainst: Asset = asset.value;
		if (!pricedAgainst.isAreaKind()) {
			return err(
				calculationError(
					'requirement.unit-not-area',
					`Asset ${asset.value.id} is ${asset.value.unit}; an area cannot re-derive against it.`,
				),
			);
		}
		const area = zone.value.entity.area();
		if (isErr(area)) {
			return err(
				calculationError('requirement.area-failed', area.error.message, area.error),
			);
		}
		const project = await this.deps.projects.getById(requirement.projectId);
		if (isErr(project)) {
			return err(calculationError('requirement.project-gone', project.error.message, project.error));
		}
		if (project.value === null) {
			return err(
				calculationError(
					'requirement.project-gone',
					`Requirement ${requirement.id} names project ${requirement.projectId}, which is not there.`,
				),
			);
		}
		// Resolved from the REQUIREMENT's own `projectId`, never the zone's — one fact, one
		// derivation. The currency increment shipped a defect precisely by letting the read
		// and the write take a project from two different places.
		const unitCost = await resolveEffectiveUnitCost(this.deps.overrides, requirement.projectId, asset.value);
		if (isErr(unitCost)) return unitCost;
		const figures = deriveRequirementFigures({
			zoneAreaMm2: area.value,
			assetUnit: asset.value.unit,
			unitCost: unitCost.value,
			wasteFactor: requirement.wasteFactor,
			expectedCurrency: project.value.entity.currency,
		});
		if (!figures.ok) return figures;

		const updated = requirement.withRecalculation(
			figures.value.quantity,
			figures.value.estimatedCost,
			figures.value.calculatedFrom,
		);
		if (isErr(updated)) {
			return err(calculationError('requirement.update-invalid', updated.error.message));
		}
		const previousEffective = effectiveValue(loaded.value.entity.estimatedCost);
		const saved = await this.deps.requirements.save(updated.value, loaded.value.version);
		if (isErr(saved)) return saved;
		await this.deps.events.publish(
			requirementRecalculated({
				requirementId: saved.value.entity.id,
				projectId: saved.value.entity.projectId,
			}),
		);
		// The chain's last link, published HERE rather than by a separate
		// onRequirementRecalculated subscriber: this is the one place that holds both the
		// pre-save and post-save figures, and a forwarding handler would have to re-read
		// both to reconstruct what its publisher already knew. The order subscribers
		// observe — RequirementRecalculated then CostEstimateChanged — is unchanged.
		await publishIfEffectiveCostChanged(this.deps.events, saved.value.entity, previousEffective);
		return ok(saved.value.entity);
	}
}
