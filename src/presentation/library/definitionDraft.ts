import { Decimal } from 'decimal.js';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { UpdateAssetInput } from '../../application/commands/asset/UpdateAsset';
import { of as moneyOf } from '../../core/money/Money';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { StringKey } from '../i18n/locales/en';
import { tr } from '../i18n/strings';

export interface DefinitionDraft {
	name: string; category: string; unit: string; unitCost: string;
	waste: string; supplier: string; sku: string; notes: string; height: string;
}
export const DEFINITION_LABELS: Record<keyof DefinitionDraft, StringKey> = {
	name: 'form.new-asset.name', category: 'view.asset-library.category',
	unit: 'view.asset-library.unit', unitCost: 'view.asset-library.unit-cost',
	waste: 'view.asset-library.waste', supplier: 'view.asset-library.supplier',
	sku: 'view.asset-library.sku', notes: 'view.asset-library.notes', height: 'view.asset-library.height',
};
export const DEFINITION_ERRORS: Record<string, keyof DefinitionDraft> = {
	'asset.empty-name': 'name', 'asset.unknown-category': 'category',
	'asset.unit-kind-referenced': 'unit', 'asset.negative-unit-cost': 'unitCost',
	'asset.negative-waste-factor-default': 'waste', 'asset.waste-factor-default-above-one': 'waste',
	'asset.invalid-height': 'height', 'asset.negative-height': 'height',
};
export function definitionDraft(entry: CatalogueEntryDto): DefinitionDraft {
	return { name: entry.name, category: entry.category, unit: entry.unit,
		unitCost: entry.unitCostAmount, waste: new Decimal(entry.wasteFactorDefault).mul(100).toString(),
		supplier: entry.supplier ?? '', sku: entry.sku ?? '', notes: entry.notes ?? '',
		height: entry.height === null ? '' : String(entry.height) };
}
export function validateDefinition(draft: DefinitionDraft, currency: string): Partial<Record<keyof DefinitionDraft, string>> {
	const errors: Partial<Record<keyof DefinitionDraft, string>> = {};
	if (!draft.name.trim()) errors.name = tr('view.asset-library.draft.required');
	for (const key of ['unitCost', 'waste', 'height'] as const) {
		if (key === 'height' && draft[key].trim() === '') continue;
		try {
			const value = new Decimal(draft[key].trim());
			if (key === 'unitCost') moneyOf(draft[key].trim(), currency);
			if (!value.isFinite() || value.isNegative() || (key === 'waste' && value.gt(100))) {
				errors[key] = tr('view.asset-library.draft.number');
			}
		} catch { errors[key] = tr('view.asset-library.draft.number'); }
	}
	return errors;
}
export function definitionChanges(draft: DefinitionDraft, baseline: CatalogueEntryDto): UpdateAssetInput['changes'] {
	const before = definitionDraft(baseline);
	const changes: UpdateAssetInput['changes'] = {};
	if (draft.name !== before.name) changes.name = draft.name.trim();
	for (const key of ['supplier', 'sku', 'notes'] as const) {
		if (draft[key] !== before[key]) changes[key] = draft[key].trim() || null;
	}
	if (draft.category !== before.category) changes.category = draft.category as AssetCategory;
	if (draft.unit !== before.unit) changes.unit = draft.unit as MeasurementUnit;
	if (draft.unitCost !== before.unitCost) changes.unitCost = moneyOf(draft.unitCost.trim(), baseline.currency);
	if (draft.waste !== before.waste) changes.wasteFactorDefault = new Decimal(draft.waste).div(100);
	if (draft.height !== before.height) changes.height = draft.height.trim() === '' ? null : Number(draft.height);
	return changes;
}
