import { isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { Decimal } from 'decimal.js';
import type { EventBus } from '../../../core/events/EventBus';
import { Asset } from '../../../domain/asset/Asset';
import { createAssetId } from '../../../domain/asset/AssetId';
import type { AssetCategory } from '../../../domain/asset/AssetCategory';
import { assetCreated } from '../../../domain/asset/Asset.events';
import { of as moneyOf } from '../../../core/money/Money';
import type { MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Command } from '../Command';
import type { AssetRepository } from '../../ports/AssetRepository';

export interface CreateAssetInput {
	readonly projectId: ProjectId;
	readonly name: string;
	readonly category: AssetCategory;
	readonly unit: MeasurementUnit;
	/** Plain decimal string (ADR-010), e.g. `"45.00"`. */
	readonly unitCostAmount: string;
	readonly currency: string;
	readonly wasteFactorDefault?: Decimal | null;
	readonly supplier?: string | null;
	readonly sku?: string | null;
	readonly notes?: string | null;
}

/**
 * §29 names `CreateAssetCommand` explicitly. The catalog item is created through
 * `Asset.create`'s validation and saved with `'absent'` — an id collision is a conflict,
 * never an overwrite.
 */
export class CreateAssetCommand
	implements
		Command<CreateAssetInput, Result<Asset, ValidationError | PersistenceError>>
{
	constructor(
		private readonly assets: AssetRepository,
		private readonly events: EventBus,
	) {}

	async execute(
		input: CreateAssetInput,
	): Promise<Result<Asset, ValidationError | PersistenceError>> {
		const unitCost = moneyOf(input.unitCostAmount, input.currency);
		const asset = Asset.create({
			id: createAssetId(),
			projectId: input.projectId,
			name: input.name,
			category: input.category,
			supplier: input.supplier ?? null,
			sku: input.sku ?? null,
			unit: input.unit,
			unitCost,
			wasteFactorDefault: input.wasteFactorDefault ?? undefined,
			notes: input.notes ?? null,
		});
		if (isErr(asset)) return asset;

		const saved = await this.assets.save(asset.value, 'absent');
		if (isErr(saved)) return saved;
		await this.events.publish(
			assetCreated({ assetId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
		);
		return ok(saved.value.entity);
	}
}
