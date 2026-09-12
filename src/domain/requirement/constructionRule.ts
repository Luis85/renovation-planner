import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { QUANTITY_RULES } from './RequirementSource';

export type ConstructionTarget = 'wall' | 'opening';

/** How a construction material is measured from its target, by the asset's own unit (ADR-0031); null where no rule measures that unit. */
export function constructionRule(target: ConstructionTarget, unit: MeasurementUnit): typeof QUANTITY_RULES[number] | null {
	if (target === 'wall') return unit === 'm2' ? 'wall-net' : unit === 'm' ? 'wall-length' : unit === 'm3' ? 'wall-volume' : null;
	return unit === 'piece' ? 'count' : unit === 'm2' ? 'opening-area' : null;
}
