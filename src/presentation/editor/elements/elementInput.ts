import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';

/** Geometry and its Markdown label travel in the existing conditional two-document command. */
export function elementInput(baseline: RenovationBaseline, element: NamedSpatialElement, remove = false): RenovationInput {
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
	const remaining = current.elements?.filter(item => item.id !== element.id) ?? [];
	const labels = baseline.plan.entity.spatialElements?.filter(item => item.id !== element.id) ?? [];
	const { name, ...geometry } = element;
	return {
		renovation: baseline.plan.entity.renovation ?? EMPTY_RENOVATION,
		intended: remove && baseline.geometry.document.intended ? { ...baseline.geometry.document.intended, elements: baseline.geometry.document.intended.elements?.filter(item => item.id !== element.id) } : baseline.geometry.document.intended,
		spatial: { structure: { ...current, elements: remove ? remaining : [...remaining, geometry] }, metadata: remove ? labels : [...labels, { id: element.id, name }] },
	};
}
