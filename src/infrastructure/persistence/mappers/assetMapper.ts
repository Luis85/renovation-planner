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
	const background = asset.background;
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
		height: asset.height,
		'background-path': background?.path ?? null,
		'background-kind': background?.kind ?? null,
		'background-page': background?.page ?? null,
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
		// No `?? null` here, and the difference is not cosmetic: the schema's own
		// `.nullable().catch(null)` has already answered for every absent and unparseable
		// value, so a second coalesce would be a branch nothing can drive.
		height: dto.height,
		// `background-path` and `background-kind` are nullable independently, so a hand-edited
		// note carrying one without the other is possible; treated as "no background" rather
		// than a partial one, since `AssetBackgroundRef` has no representation for a kind with
		// no path or a path with no kind.
		background:
			dto['background-path'] !== null && dto['background-kind'] !== null
				? { path: dto['background-path'], kind: dto['background-kind'], page: dto['background-page'] }
				: null,
	});
	if (!created.ok) return created;
	return ok(created.value);
}
