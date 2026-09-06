import { Decimal } from 'decimal.js';
import type { Asset } from '../../../domain/asset/Asset';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Money, Currency } from '../../../core/money/Money';
import { err } from '../../../core/result/Result';
import { sourceError, sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import type { PlanGeometrySidecar } from '../../ports/PlanGeometrySidecar';
import { deriveRequirementFigures } from './deriveRequirementFigures';

export async function contextualFigures(deps: { geometry?: PlanGeometrySidecar }, requirement: Requirement, asset: Asset, price: Money, currency: Currency) {
	const source = requirement.source;
	if (!source || !deps.geometry) return err(sourceError());
	const geometry = await deps.geometry.read(source.planId as PlanId);
	if (!geometry.ok) return err(sourceError());
	const raw = sourceMeasurement(source, requirement.origin.zoneId, geometry.value.document, asset.unit);
	if (!raw.ok) return raw;
	return deriveRequirementFigures({ zoneAreaMm2: 0, rawMeasurement: raw.value, assetUnit: asset.unit, unitCost: price,
		expectedCurrency: currency, wasteFactor: requirement.wasteFactor, quantityOverride: requirement.quantity.override,
		coverage: new Decimal(source.coverage), packaging: source.lot ? { lotSize: new Decimal(source.lot), ...(source.minimum ? { minimumOrder: new Decimal(source.minimum) } : {}) } : undefined });
}
