// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadedPlugin } from '../helpers/plugin';
import { planningStack } from '../helpers/planning';
import { expectDefined, expectOk } from '../helpers/domain';
import { installObsidianDom } from '../helpers/dom';
import { settle } from '../helpers/async';
import { withPlanRenovation } from '../../src/domain/plan/Plan';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
installObsidianDom();
describe('evidence ownership during a host rename', () => {
 it('repairs evidence owned by the renamed Plan that points to its own note', async () => {
  const rig = await planningStack(), read = expectOk(await rig.read());
  const oldPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan path'), newPath = oldPath.replace(/[^/]+$/, 'Moved.md');
  const evidence = { ...rig.evidence, path: oldPath, recordId: '' };
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(read.plan.entity, { ...rig.value, depth: { costs: [], procurement: [], evidence: [evidence] } })), read.plan.version));
  rig.stack.metadataCache.catchUp();
  const host = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, rig.stack); host.workspace.layoutReady();
  const bytes = expectDefined(rig.stack.vault.entries.get(oldPath), 'note bytes');
  rig.stack.vault.entries.delete(oldPath); rig.stack.vault.entries.set(newPath, bytes); rig.stack.metadataCache.catchUp();
  host.triggerVault('rename', rig.stack.vault.getAbstractFileByPath(newPath), oldPath); await settle();
  const persistence = expectDefined(host.plugin.root.persistence, 'persistence');
  const plan = expectDefined(expectOk(await persistence.plans.getById(rig.plan.id)), 'renamed plan');
  expect(plan.entity.renovation?.depth?.evidence[0]).toEqual({ ...evidence, path: newPath });
  host.plugin.onunload();
 });
});
