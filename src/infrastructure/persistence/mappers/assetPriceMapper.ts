import type { ValidationError } from '../../../core/errors/AppError';
import { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import { createMoney } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import { parsePersisted } from './parse';
import { ASSET_PRICE_TYPE, AssetPriceFrontmatterSchemaV1 } from '../dto/assetPriceFrontmatter';

export function assetPriceToPersistence(
	override: AssetPriceOverride,
	revision: number,
): Record<string, unknown> {
	return {
		type: ASSET_PRICE_TYPE,
		'schema-version': 1,
		id: override.id,
		revision,
		project: override.projectId,
		asset: override.assetId,
		'unit-cost': override.unitCost.amount,
		currency: override.unitCost.currency,
	};
}

/**
 * **No project currency, and that is spec Decision 2.** A note that has drifted from its
 * project's currency is READ and SHOWN, not refused: refusing it here would make a file the
 * user can see on disk invisible to the plugin, which is the same trade the duplicate-pair rule
 * already refuses. The pipeline is what stops a wrong-currency figure being computed.
 *
 * **What the section does NOT do is say why**, and an earlier draft of this comment claimed it
 * did — "the section's marker is what tells the user why their price is not being used". No
 * such marker is scheduled: `AssetPriceRowDto` carries no mismatch field, and Tasks 8 and 9 add
 * no copy, no rendering and no case for one. The spec's second and third residuals are where
 * that stands, and they DEFER it while naming the remedy (a mark derived per read from the two
 * currencies, never stored). So the shipped section shows the mismatched price with nothing
 * beside it, and the user learns why at the next assign, from `cost.currency-mismatch`.
 *
 * The sentence is corrected rather than the marker scheduled, because the spec is the authority
 * on what this increment ships and it decided this deliberately — and a comment promising a
 * user-facing explanation nobody built is worse than the gap it papers over: the next reader
 * takes it as covered and never opens the residual.
 */
export function assetPriceFromPersistence(
	rawFrontmatter: unknown,
): Result<AssetPriceOverride, ValidationError> {
	const frontmatter = parsePersisted(
		AssetPriceFrontmatterSchemaV1,
		rawFrontmatter,
		'asset-price.frontmatter-invalid',
		'Asset price note',
	);
	if (!frontmatter.ok) return frontmatter;
	const dto = frontmatter.value;

	const unitCost = createMoney(dto['unit-cost'], dto.currency);
	if (!unitCost.ok) return unitCost;

	const created = AssetPriceOverride.create({
		id: dto.id as AssetPriceOverrideId,
		projectId: dto.project as ProjectId,
		assetId: dto.asset as AssetId,
		unitCost: unitCost.value,
	});
	if (!created.ok) return created;
	return ok(created.value);
}
