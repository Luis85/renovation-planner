import type { MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { RenovationSubject } from '../../../domain/renovation/Renovation';

export interface MaterialChoice { readonly id: string; readonly name: string; readonly category: string; readonly unit: MeasurementUnit }
const CATEGORIES: Partial<Record<RenovationSubject['kind'], readonly string[]>> = { wall: ['material', 'building-element'], door: ['building-element', 'fixture'], window: ['building-element', 'fixture'] };

export function materialChoices(catalogue: readonly MaterialChoice[], kind: RenovationSubject['kind']): readonly MaterialChoice[] {
	const categories = CATEGORIES[kind] ?? [];
	return catalogue.filter(item => categories.includes(item.category));
}
/** '' clears; a chosen material fills an EMPTY description with its name, so the non-empty description rule is kept, not relaxed. */
export function applyMaterial(facts: { description: string; assetId?: string }, id: string, catalogue: readonly MaterialChoice[]): void {
	if (!id) { delete facts.assetId; return; }
	facts.assetId = id;
	if (!facts.description.trim()) facts.description = catalogue.find(item => item.id === id)?.name ?? '';
}
