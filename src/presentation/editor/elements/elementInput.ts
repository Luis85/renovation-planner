import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';

function replaceOrAppend<T extends { readonly id: string }>(items: readonly T[], replacement: T): T[] {
	return items.some(item => item.id === replacement.id) ? items.map(item => item.id === replacement.id ? replacement : item) : [...items, replacement];
}

/** Geometry and its Markdown label travel in the existing conditional two-document command. */
export function elementInput(baseline: RenovationBaseline, element: NamedSpatialElement, remove = false): RenovationInput {
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
	const remaining = current.elements?.filter(item => item.id !== element.id) ?? [];
	const labels = baseline.plan.entity.spatialElements?.filter(item => item.id !== element.id) ?? [];
	const { name, ...geometry } = element;
	return {
		renovation: baseline.plan.entity.renovation ?? EMPTY_RENOVATION,
		intended: remove && baseline.geometry.document.intended ? { ...baseline.geometry.document.intended, elements: baseline.geometry.document.intended.elements?.filter(item => item.id !== element.id) } : baseline.geometry.document.intended,
		spatial: { structure: { ...current, elements: remove ? remaining : replaceOrAppend(current.elements ?? [], geometry) }, metadata: remove ? labels : replaceOrAppend(baseline.plan.entity.spatialElements ?? [], { id: element.id, name }) },
	};
}

