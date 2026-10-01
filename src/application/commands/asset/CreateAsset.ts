import { isErr, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Decimal } from 'decimal.js';
import type { EventBus } from '../../../core/events/EventBus';
import { Asset } from '../../../domain/asset/Asset';
import { createAssetId } from '../../../domain/asset/AssetId';
import type { AssetCategory } from '../../../domain/asset/AssetCategory';
import { assetCreated } from '../../../domain/asset/Asset.events';
import { of as moneyOf } from '../../../core/money/Money';
import type { MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { Command } from '../Command';
import type { AssetRepository } from '../../ports/AssetRepository';

export interface CreateAssetInput {
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
	/**
	 * Millimetres (ADR-009), or absent/`null` for an asset that says nothing about how tall it
	 * is — AD07 implementation item 3's "optional descriptive height", the field that made that
	 * item deliverable at all. DESCRIPTIVE only: contract C07 reads "Height remains
	 * stored/shown/exported but is not an input to vertical clash checks", and `Asset.height`'s
	 * own docblock records that nothing computes with it.
	 *
	 * Handed to `Asset.create` unchanged rather than coerced here, so `checkHeight` stays the
	 * ONE rule about what a height may be. Measured with this whole change in the tree, not
	 * before it: `grep -rn "checkHeight" src/` prints ten lines today and exactly ONE of them
	 * is a call — `Asset.ts`'s `checkHeight(props.height ?? null)` inside `create`. Every other
	 * hit is the declaration or prose (two in `Asset.ts`, one in `DesignerInspector.vue`, three
	 * in `NewAssetForm.vue`, three here), so the count of LINES will drift and the count of call
	 * sites is the claim. `withChanges` reaches it by rebuilding through `create`, not by
	 * calling it.
	 *
	 * A `?? null` at this seam would read as a second answer to "what does an absent height
	 * mean" while `create`'s own `props.height ?? null` already decides it — and it would cost
	 * a branch that can never refuse anything.
	 */
	readonly height?: number | null;
}

/**
 * §29 names `CreateAssetCommand` explicitly. The catalog item is created through
 * `Asset.create`'s validation and saved with `'absent'` — an id collision is a conflict,
 * never an overwrite.
 */
export class CreateAssetCommand
	implements
		Command<CreateAssetInput, Result<Asset, RepositoryError>>
{
	constructor(
		private readonly assets: AssetRepository,
		private readonly events: EventBus,
	) {}

	async execute(
		input: CreateAssetInput,
	): Promise<Result<Asset, RepositoryError>> {
		const unitCost = moneyOf(input.unitCostAmount, input.currency);
		const asset = Asset.create({
			id: createAssetId(),
			name: input.name,
			category: input.category,
			supplier: input.supplier ?? null,
			sku: input.sku ?? null,
			unit: input.unit,
			unitCost,
			wasteFactorDefault: input.wasteFactorDefault ?? undefined,
			notes: input.notes ?? null,
			height: input.height,
		});
		if (isErr(asset)) return asset;

		const saved = await this.assets.save(asset.value, 'absent');
		if (isErr(saved)) return saved;
		await this.events.publish(
			assetCreated({ assetId: saved.value.entity.id }),
		);
		return ok(saved.value.entity);
	}
}
