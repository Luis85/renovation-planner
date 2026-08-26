import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	DomainError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import type { Zone } from '../../../domain/zone/Zone';
import type { Asset } from '../../../domain/asset/Asset';
import { Requirement } from '../../../domain/requirement/Requirement';
import { createRequirementId } from '../../../domain/requirement/RequirementId';
import { requirementCreated } from '../../../domain/requirement/Requirement.events';
import { UNIT_KIND } from '../../../core/units/MeasurementUnit';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { AssetId } from '../../../domain/asset/AssetId';
import { referenceError } from '../../errors';
import { loadZone } from '../zone/loadZone';
import type { Command } from '../Command';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import { deriveRequirementFigures } from './deriveRequirementFigures';
import type { EntityVersion } from '../../ports/versioning';

export async function loadAsset(
	assets: AssetRepository,
	assetId: AssetId,
): Promise<Result<Asset, ReferenceError | RepositoryError>> {
	const loaded = await assets.getById(assetId);
	if (isErr(loaded)) return loaded;
	if (loaded.value === null) {
		return err(referenceError('requirement.asset-not-found', `Asset ${assetId} not found.`));
	}
	return ok(loaded.value.entity);
}

export interface AssignAssetInput {
	readonly zoneId: ZoneId;
	readonly assetId: AssetId;
}

/** `created` is reported BY the command — only it holds both endpoint locks when it decides. */
export interface AssignAssetResult {
	readonly requirement: Requirement;
	readonly created: boolean;
	/**
	 * What THIS command's save produced — the expectation an undo presents when it
	 * deletes what it created. Pre-state revisions are stale by the time the command
	 * returns; an undo left to discover the current one by reading is back to
	 * check-then-act.
	 */
	readonly version: EntityVersion;
}

export type AssignAssetErrors =
	| DomainError
	| ReferenceError
	| CalculationError
	| RepositoryError;

/**
 * Links one Asset into one Zone by creating (or finding) the Requirement between them.
 * Idempotent on the (zoneId, assetId) pair. The invariants a link must satisfy are owned
 * HERE, not by any picker or panel — a script or a later epic's caller is exactly as bound
 * as the Inspector is (§3.3: a handler is not a trusted caller):
 *
 * - both endpoints exist;
 * - `zone.projectId === asset.projectId` — nothing in the input's SHAPE stops a caller
 *   pairing across projects, and a cross-project requirement would leak one project's unit
 *   costs into another's estimates while being unfindable by `ListAssets`;
 * - the Asset is of AREA kind (`UNIT_KIND[asset.unit]`, never a literal `'m2'`) — a zone's
 *   polygon area is not an identity input for a length, volume, piece, hour, day or fixed
 *   asset, and accepting one would silently relabel an area figure.
 *
 * Both endpoint level-1 locks are held for the whole create, taken as ONE sorted batch:
 * either endpoint being deleted concurrently produces the same dangling reference. The
 * locks are also what make `created` true exactly for the window it was decided in — two
 * tabs assigning concurrently serialize here, the second taking the idempotent path.
 */
export class AssignAssetCommand
	implements Command<AssignAssetInput, Result<AssignAssetResult, AssignAssetErrors>>
{
	constructor(
		private readonly zones: ZoneRepository,
		private readonly assets: AssetRepository,
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
		private readonly locks: ReferenceLocks,
	) {}

	async execute(input: AssignAssetInput): Promise<Result<AssignAssetResult, AssignAssetErrors>> {
		const release = await this.locks.acquire([input.zoneId, input.assetId], []);
		try {
			const loadedZone = await loadZone(this.zones, input.zoneId);
			if (!loadedZone.ok) return loadedZone;
			const loadedAsset = await loadAsset(this.assets, input.assetId);
			if (!loadedAsset.ok) return loadedAsset;
			const zone = loadedZone.value.entity;
			const asset = loadedAsset.value;

			if (zone.projectId !== asset.projectId) {
				return err({
					category: 'Validation',
					code: 'requirement.cross-project',
					message: `A requirement cannot pair zone ${zone.id} (project ${zone.projectId}) `
						+ `with asset ${asset.id} from project ${asset.projectId}.`,
				});
			}
			// Dimension check, not symbol check — see the header.
			if (UNIT_KIND[asset.unit] !== 'area') {
				return err({
					category: 'Validation',
					code: 'requirement.unit-not-area',
					message: `A zone's area cannot drive a ${UNIT_KIND[asset.unit]}-kind asset `
						+ `(${asset.unit}); assign an area-kind asset.`,
				});
			}

			const existing = await this.requirements.listByZone(zone.id);
			if (isErr(existing)) return existing;
			const found = existing.value.find((r) => r.entity.assetId === asset.id);
			if (found) {
				return ok({ requirement: found.entity, created: false, version: found.version });
			}

			return await this.createAndSave(zone, asset);
		} finally {
			release();
		}
	}

	private async createAndSave(
		zone: Zone,
		asset: Asset,
	): Promise<Result<AssignAssetResult, AssignAssetErrors>> {
		const area = zone.area();
		if (isErr(area)) {
			return err({
				category: 'Calculation',
				code: 'requirement.area-failed',
				message: `Zone ${zone.id} geometry could not be measured.`,
				cause: area.error,
			});
		}
		const figures = deriveRequirementFigures({
			zoneAreaMm2: area.value,
			assetUnit: asset.unit,
			unitCost: asset.unitCost,
			wasteFactor: asset.wasteFactorDefault,
		});
		if (!figures.ok) return figures;

		const requirement = Requirement.create({
			id: createRequirementId(),
			projectId: zone.projectId,
			assetId: asset.id,
			origin: { kind: 'zone', zoneId: zone.id },
			unit: asset.unit,
			wasteFactor: asset.wasteFactorDefault,
			quantity: { calculated: figures.value.quantity },
			estimatedCost: { calculated: figures.value.estimatedCost },
			calculatedFrom: figures.value.calculatedFrom,
		});
		if (isErr(requirement)) return requirement;

		const saved = await this.requirements.save(requirement.value, 'absent');
		if (isErr(saved)) return saved;
		await this.events.publish(
			requirementCreated({ requirementId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
		);
		return ok({ requirement: saved.value.entity, created: true, version: saved.value.version });
	}
}

