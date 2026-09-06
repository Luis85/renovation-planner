import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { planningStack } from '../../helpers/planning';
import { largePlanningBaseline } from '../../helpers/largePlanning';
import { expectOk } from '../../helpers/domain';
import * as calculation from '../../../src/application/commands/renovation/PlanningServices';
import { planningFindings } from '../../../src/presentation/editor/planning/planningProjection';
describe('large planning projection', () => {
 it('calculates each material once while reviewing every room', async () => {
  const rig = await planningStack(), baseline = largePlanningBaseline(expectOk(await rig.read()));
  const calculationCalls = vi.spyOn(calculation, 'prepareMaterial');
  const start = performance.now(), findings = planningFindings(baseline), elapsed = performance.now() - start;
  console.info(JSON.stringify({ fixture: { rooms: 80, materials: 240, catalogue: 24, photos: 40 }, calculations: calculationCalls.mock.calls.length, reviewMs: elapsed }));
  mkdirSync('harness-shots/recovery', { recursive: true });
  writeFileSync('harness-shots/recovery/performance-after.json', JSON.stringify({ rooms: 80, materials: 240, catalogue: 24, photos: 40, calculations: calculationCalls.mock.calls.length, reviewMs: elapsed }));
  expect(findings).toEqual([]);
  expect(calculationCalls).toHaveBeenCalledTimes(240);
 });
});
