import type { MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { RenovationSubject } from '../../../domain/renovation/Renovation';
import { materialTargetExists } from '../../../domain/renovation/renovationTargets';
import type { Structure } from '../../../domain/spatial/Structure';

/** A Material or Product select only where a choice can be saved: a wall subject on a wall, a door or window subject on an opening — `renovation.material-target`'s own rule. */
export function takesMaterial(subject: Pick<RenovationSubject, 'kind' | 'targetId'>, structure: Structure): boolean {
	return ['wall', 'door', 'window'].includes(subject.kind) && materialTargetExists(subject, [structure]);
}

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
