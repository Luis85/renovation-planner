// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { planningDraft, materialInput } from '../../../src/presentation/editor/planning/planningDraft';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
it.each(['object', 'path'] as const)('highlights the exact current or intended %s used by each material', async kind => {
 const rig = await renovationEditor(true); mounted.push(rig);
 const points = [{ x: 500, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2000 }, { x: 500, y: 2000 }];
 const element = { id: 'element-source', name: 'Material source', kind, points };
 const seed = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(seed, elementInput(seed, element), rig.runtime.structureTask.ledger)));
 const baseline = expectOk(await rig.renovation.read(rig.plan.id)), current = expectDefined(baseline.geometry.document.structure, 'structure');
 const intendedPoints = points.map(point => ({ x: point.x + 1200, y: point.y + 700 }));
 const intended = { ...current, elements: [{ id: element.id, kind, points: intendedPoints }] };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: expectDefined(baseline.plan.entity.renovation, 'renovation'), intended }, rig.runtime.structureTask.ledger)));
 const planning = expectDefined(rig.deps.commands.planning, 'planning');
 const materials = [];
 for (const state of ['current', 'intended'] as const) {
  const read = expectOk(await planning.read(rig.plan.id)), draft = planningDraft('material', read, rig.room.id, '', { targetId: element.id });
  draft.assetId = expectDefined(read.catalogue.find(item => item.asset.unit === 'm2'), 'area asset').asset.id;
  draft.source = { ...draft.source, state, rule: 'manual', manual: '2' };
  expectOk(await rig.runtime.dispatcher.run(planning.material(read, materialInput(draft), rig.runtime.structureTask.ledger))); materials.push({ id: draft.id, state });
 }
 for (const material of materials) {
  rig.runtime.renovation.focus(rig.room.id, 'materials', material.id); await settle();
  const source = expectDefined(rig.stage?.findOne('.material-source'), 'source highlight');
  expect(source.getAttr('points')).toEqual((material.state === 'current' ? points : intendedPoints).flatMap(point => [point.x, point.y]));
  expect(source.getAttr('closed')).toBe(kind === 'object'); expect(rig.stage?.find('.material-marker')).toHaveLength(2);
  expect(rig.session.targetId).toBe(rig.room.id); expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.session.focusedId).toBe(material.id);
 }
 expect(rig.project.structure).toEqual(current); expect(rig.project.intended).toEqual(intended);
});
