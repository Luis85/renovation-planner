import { Decimal } from 'decimal.js';
import type { ValidationError } from '../../../core/errors/AppError';
import { Asset } from '../../../domain/asset/Asset';
import { createMoney } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import { parsePersisted } from './parse';
import { toKebab } from '../dto/kebab';
import { ASSET_TYPE, AssetFrontmatterSchemaV1 } from '../dto/assetFrontmatter';

/**
 * Markdown ↔ Asset. Every decimal is a quoted STRING on disk (ADR-010): `Decimal` parses
 * the string exactly, and this module is the only place the conversion happens — a YAML
 * float would silently lose money at the one boundary the plugin does not control.
 */
export function assetToPersistence(asset: Asset, revision: number): Record<string, unknown> {
	return {
		type: ASSET_TYPE,
		'schema-version': 1,
		id: asset.id,
		revision,
		name: asset.name,
		category: toKebab(asset.category),
		supplier: asset.supplier,
		sku: asset.sku,
		unit: asset.unit,
		'unit-cost': asset.unitCost.amount,
		currency: asset.unitCost.currency,
		'waste-factor-default': asset.wasteFactorDefault.toString(),
		notes: asset.notes,
	};
}

export function assetFromPersistence(rawFrontmatter: unknown): Result<Asset, ValidationError> {
	const frontmatter = parsePersisted(AssetFrontmatterSchemaV1, rawFrontmatter, 'asset.frontmatter-invalid', 'Asset note');
	if (!frontmatter.ok) return frontmatter;
	const dto = frontmatter.value;

	const unitCost = createMoney(dto['unit-cost'], dto.currency);
	if (!unitCost.ok) return unitCost;
	// The schema above has vouched for these strings being plain decimals, so the
	// remaining validation is the entity's own smart constructor.
	const created = Asset.create({
		id: dto.id as Asset['id'],
		name: dto.name,
		category: dto.category,
		supplier: dto.supplier ?? null,
		sku: dto.sku ?? null,
		unit: dto.unit,
		unitCost: unitCost.value,
		wasteFactorDefault:
			dto['waste-factor-default'] === null ? undefined : new Decimal(dto['waste-factor-default']),
		notes: dto.notes ?? null,
	});
	if (!created.ok) return created;
	return ok(created.value);
}
