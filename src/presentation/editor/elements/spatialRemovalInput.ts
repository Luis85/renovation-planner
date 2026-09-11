import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { EMPTY_STRUCTURE, type Structure } from '../../../domain/spatial/Structure';

function without(structure: Structure, ids: ReadonlySet<string>): Structure {
 return { ...structure, walls: structure.walls.filter(item => !ids.has(item.id)),
  openings: structure.openings.filter(item => !ids.has(item.id)),
  boundaries: structure.boundaries.filter(item => !item.wallIds.some(id => ids.has(id))),
  ...(structure.elements ? { elements: structure.elements.filter(item => !ids.has(item.id)) } : {}) };
}
/** One proposal removes explicit elements and hosted openings, retaining independent Room outlines. */
export function spatialRemovalInput(baseline: RenovationBaseline, selected: readonly string[]) {
 const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE, intended = baseline.geometry.document.intended;
 const ids = new Set([...selected, ...[current, intended].flatMap(value => value?.openings.filter(item => selected.includes(item.hostId)).map(item => item.id) ?? [])]);
 const input: RenovationInput = { renovation: baseline.plan.entity.renovation,
  intended: intended ? without(intended, ids) : intended,
  spatial: { structure: without(current, ids), metadata: baseline.plan.entity.spatialElements?.filter(item => !ids.has(item.id)) } };
 return { input, ids: [...ids], openings: current.openings.filter(item => ids.has(item.id)).length,
  rooms: current.boundaries.filter(item => item.wallIds.some(id => ids.has(id))).length };
}
