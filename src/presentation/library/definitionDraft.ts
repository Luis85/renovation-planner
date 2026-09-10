import { Decimal } from 'decimal.js';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { UpdateAssetInput } from '../../application/commands/asset/UpdateAsset';
import { of as moneyOf } from '../../core/money/Money';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { StringKey } from '../i18n/locales/en';
import { tr } from '../i18n/strings';
import { normalizeDecimalInput } from './decimalInput';

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
		if (key === 'height' && normalizeDecimalInput(draft[key]) === '') continue;
		try {
			const value = new Decimal(normalizeDecimalInput(draft[key]));
			if (key === 'unitCost') moneyOf(normalizeDecimalInput(draft[key]), currency);
			// `lessThan(0)`, not `isNegative()`: decimal.js reports negative ZERO as negative,
			// and a field of zero arrived at by typing "-0" is still a legitimate zero (C6).
			if (!value.isFinite() || value.lessThan(0) || (key === 'waste' && value.gt(100))) {
				errors[key] = tr('view.asset-library.draft.number');
			}
		} catch { errors[key] = tr('view.asset-library.draft.number'); }
	}
	return errors;
}
// `validateDefinition` is the gate: `save()` always runs it first, against the identical
// normalized values and the identical `baseline.currency` this function goes on to use, and
// refuses anything `moneyOf`/`Decimal` cannot parse before this function is ever called.
// No try/catch belt here, and the three parses below are not one identical shape: `unitCost`
// and `waste` are the same `Decimal`/`moneyOf` call the gate already made against the same
// normalized string and currency, so nothing that passed the gate can fail here a second time.
// `height` is not a `Decimal` parse at all — it is `Number()`, which never throws (`NaN` at
// worst) regardless of normalization, so it needs no belt for a different reason than its
// siblings. A caller that skips the gate and hands in unparseable `unitCost`/`waste` gets an
// uncaught throw, which is a caller error a pure diff is not responsible for hiding.
export function definitionChanges(draft: DefinitionDraft, baseline: CatalogueEntryDto): UpdateAssetInput['changes'] {
	const before = definitionDraft(baseline);
	const changes: UpdateAssetInput['changes'] = {};
	if (draft.name !== before.name) changes.name = draft.name.trim();
	for (const key of ['supplier', 'sku', 'notes'] as const) {
		if (draft[key] !== before[key]) changes[key] = draft[key].trim() || null;
	}
	if (draft.category !== before.category) changes.category = draft.category as AssetCategory;
	if (draft.unit !== before.unit) changes.unit = draft.unit as MeasurementUnit;
	const unitCost = normalizeDecimalInput(draft.unitCost);
	const waste = normalizeDecimalInput(draft.waste);
	const height = normalizeDecimalInput(draft.height);
	if (unitCost !== before.unitCost) changes.unitCost = moneyOf(unitCost, baseline.currency);
	if (waste !== before.waste) changes.wasteFactorDefault = new Decimal(waste).div(100);
	if (height !== before.height) changes.height = height === '' ? null : Number(height);
	return changes;
}
