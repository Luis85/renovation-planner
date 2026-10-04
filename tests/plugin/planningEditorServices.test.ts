// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from 'obsidian';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { planningEditorServices } from '../../src/plugin/planningEditorServices';
import { evidenceRenamed } from '../../src/plugin/evidenceRename';
import { err } from '../../src/core/result/Result';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { planningStack } from '../helpers/planning';
import { renovationStack } from '../helpers/renovation';
import { expectDefined, expectOk } from '../helpers/domain';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { installObsidianDom } from '../helpers/dom';
import { SessionStores } from '../../src/plugin/sessionStores';
import { createPlanId } from '../../src/domain/plan/PlanId';
import { activeWriteIncidentRegistry, installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
installObsidianDom();
async function setup() {
 const rig = await planningStack(); rig.stack.metadataCache.catchUp();
 const root = createCompositionRoot(DEFAULT_SETTINGS, rig.stack.logger, rig.stack.deps);
 const persistence = expectDefined(root.persistence, 'persistence');
 const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: persistence.vaultDeps.echo }); persistence.index.rebuild(scan.entries, scan.exclusions);
 const openLinkText = vi.fn<Workspace['openLinkText']>().mockResolvedValue(undefined);
 const services = planningEditorServices(root, rig.stack.deps.vault, { openLinkText } as never);
 return { ...rig, root, persistence, services, openLinkText };
}
describe('production planning composition and fresh-stack hydration', () => {
 afterEach(() => installWriteIncidentRegistry(null));
 it('creates the first renovation register through composition and removes it again on undo', async () => {
  const rig = await renovationStack(); rig.stack.metadataCache.catchUp();
  const root = createCompositionRoot(DEFAULT_SETTINGS, rig.stack.logger, rig.stack.deps);
  const persistence = expectDefined(root.persistence, 'persistence');
  try {
   const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: persistence.vaultDeps.echo }); persistence.index.rebuild(scan.entries, scan.exclusions);
   const renovation = expectDefined(planningEditorServices(root, rig.stack.deps.vault, {} as never).renovation, 'composed renovation');
   const baseline = expectOk(await renovation.read(rig.plan.id)); expect(baseline.plan.entity.renovation).toBeUndefined();
   const command = renovation.command(baseline, { renovation: rig.value, intended: baseline.geometry.document.intended }, rig.ledger);
   expectOk(await command.execute());
   expect(expectOk(await renovation.read(rig.plan.id)).plan.entity.renovation).toEqual(rig.value);
   expectOk(await command.undo());
   const undone = expectOk(await renovation.read(rig.plan.id));
   expect(undone.plan.entity.renovation).toBeUndefined(); expect(undone.geometry.document).toEqual(baseline.geometry.document);
   expectOk(await command.execute());
   const restored = expectOk(await renovation.read(rig.plan.id));
   expect(restored.plan.entity.renovation).toEqual(rig.value); expect(restored.geometry.document).toEqual(baseline.geometry.document);
  } finally { for (const subscription of persistence.subscriptions) subscription.dispose(); }
 });
 it('drives guarded material and linked plan commands, then hydrates fresh repositories from bytes', async () => {
 const rig = await setup(), planning = expectDefined(rig.services.planning, 'planning'), renovation = expectDefined(rig.services.renovation, 'renovation');
 const baseline = expectOk(await planning.read(rig.plan.id)); const command = planning.material(baseline, rig.input, rig.ledger);
 expectOk(await command.execute()); expectOk(await command.undo()); expectOk(await command.execute());
 const read = expectOk(await planning.read(rig.plan.id)); const relation = renovation.command(read, { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger); expectOk(await relation.execute());
 expectOk(await expectDefined(rig.services.shoppingNote, 'shopping')(rig.plan.id, 'Shopping')); expect(rig.openLinkText).toHaveBeenCalledOnce();
 rig.stack.metadataCache.catchUp(); const fresh = createCompositionRoot(DEFAULT_SETTINGS, rig.stack.logger, rig.stack.deps), persistence = expectDefined(fresh.persistence, 'fresh');
 const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: persistence.vaultDeps.echo }); persistence.index.rebuild(scan.entries, scan.exclusions);
 const again = planningEditorServices(fresh, rig.stack.deps.vault, { openLinkText: rig.openLinkText } as never);
 const hydrated = expectOk(await expectDefined(again.planning, 'fresh planning').read(rig.plan.id)); expect(hydrated.materials[0].entity.source).toEqual(rig.input.source); expect(hydrated.plan.entity.renovation?.depth).toEqual(rig.depth);
 await evidenceRenamed(fresh, 'Evidence', 'Archive'); expect(expectOk(await persistence.plans.getById(rig.plan.id))?.entity.renovation?.depth?.evidence[0].path).toBe('Archive/invoice.pdf');
 for (const subscription of [...rig.persistence.subscriptions, ...persistence.subscriptions]) subscription.dispose();
 });
 it('maps faults from read, execute and undo and refuses missing links through the guarded factory', async () => {
 const rig = await setup(), planning = expectDefined(rig.services.planning, 'planning');
 vi.spyOn(rig.persistence.plans, 'getById').mockRejectedValueOnce(new Error('vault')); expect(await planning.read(rig.plan.id)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
 const baseline = expectOk(await planning.read(rig.plan.id)), command = planning.material(baseline, rig.input, rig.ledger);
 vi.spyOn(rig.persistence.locks, 'acquire').mockRejectedValueOnce(new Error('locks')); expect(await command.execute()).toMatchObject({ ok: false, error: { code: 'material.write-failed' } });
 const second = planning.material(baseline, rig.input, rig.ledger); expectOk(await second.execute()); vi.spyOn(rig.persistence.locks, 'acquire').mockRejectedValueOnce(new Error('locks')); expect(await second.undo()).toMatchObject({ ok: false, error: { code: 'material.write-failed' } });
 const renovation = expectDefined(rig.services.renovation, 'renovation'), read = expectOk(await renovation.read(rig.plan.id));
 expect((await renovation.command(read, { renovation: { ...rig.value, work: [] }, intended: undefined }, rig.ledger).execute()).ok).toBe(false);
 vi.spyOn(rig.persistence.plans, 'getById').mockRejectedValueOnce(new Error('rename')); await evidenceRenamed(rig.root, 'a', 'b'); expect(rig.stack.logged.some(line => line.event === 'evidence.rename-failed')).toBe(true);
 for (const subscription of rig.persistence.subscriptions) subscription.dispose();
 });
 it('does not advertise unavailable persistence', async () => {
 const rig = await setup(), root = createCompositionRoot(null, rig.stack.logger);
 expect(planningEditorServices(root, rig.stack.deps.vault, {} as never)).toEqual({}); await evidenceRenamed(root, 'a', 'b');
 for (const subscription of rig.persistence.subscriptions) subscription.dispose();
 });
 it('propagates late planning reads and link refusals through renovation, and returned rename failures', async () => {
 const rig = await setup(), planning = expectDefined(rig.services.planning, 'planning'), renovation = expectDefined(rig.services.renovation, 'renovation'), fault = { category: 'Persistence' as const, code: 'test.read', message: 'offline' };
 expectOk(await planning.material(expectOk(await planning.read(rig.plan.id)), rig.input, rig.ledger).execute());
 const baseline = expectOk(await planning.read(rig.plan.id));
 const command = renovation.command(baseline, { renovation: { ...rig.value, depth: { ...rig.depth, costs: [{ ...rig.cost, requirementId: 'missing' }] } }, intended: undefined }, rig.ledger);
 expect((await command.execute()).ok).toBe(false);
 const read = rig.persistence.plans.getById.bind(rig.persistence.plans); vi.spyOn(rig.persistence.plans, 'getById').mockImplementationOnce(read).mockResolvedValueOnce(err(fault));
 expect(await renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger).execute()).toEqual(err(fault));
 vi.spyOn(rig.persistence.plans, 'getById').mockResolvedValueOnce(err(fault)); await evidenceRenamed(rig.root, 'a', 'b');
 expect(expectOk(await planning.read(rig.plan.id)).plan.entity.renovation).toEqual(rig.value);
 for (const subscription of rig.persistence.subscriptions) subscription.dispose();
 });

 /**
  * The rename listener is outside both doors `WriteIncidentRegistry.hold()` names, and its stamp is
  * recorded at the end of its work: a rename relocating evidence when a clean session disposed used to
  * find the record released and lose its half-write. A second plan that refuses to read makes the
  * rename a refusal after a landed save.
  */
 it('holds the write-incident record while a rename relocates evidence, so a half-write outliving unload is recorded', async () => {
 const rig = await setup(), planning = expectDefined(rig.services.planning, 'planning'), renovation = expectDefined(rig.services.renovation, 'renovation');
 expectOk(await planning.material(expectOk(await planning.read(rig.plan.id)), rig.input, rig.ledger).execute());
 expectOk(await renovation.command(expectOk(await renovation.read(rig.plan.id)), { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger).execute());
 const read = rig.persistence.plans.getById.bind(rig.persistence.plans), broken = createPlanId();
 vi.spyOn(rig.persistence.index, 'getIdsByType').mockReturnValueOnce([rig.plan.id, broken]);
 vi.spyOn(rig.persistence.plans, 'getById').mockImplementation(id => id === broken ? Promise.resolve(err({ category: 'Persistence', code: 'test.read', message: 'offline' })) : read(id));
 const stores = await renamingAtDispose(rig, 'Evidence');
 expect(stores.writeIncidents.anyOpen()).toBe(true); expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);
 });
 it('releases a clean record once the rename in flight at dispose settles', async () => {
 await renamingAtDispose(await setup(), 'Nothing');
 expect(activeWriteIncidentRegistry()).toBeNull();
 });
});

/** Starts a rename whose first plan read waits, disposes a clean session under it, then lets it finish. */
async function renamingAtDispose(rig: Awaited<ReturnType<typeof setup>>, oldPath: string) {
 const files = { exists: () => Promise.resolve(false), read: () => Promise.resolve(''), write: () => Promise.resolve(), remove: () => Promise.resolve() };
 const stores = new SessionStores(files, 'plugins/renovation-planner', rig.stack.logger), read = rig.persistence.plans.getById.bind(rig.persistence.plans);
 let proceed!: () => void; const paused = new Promise<void>(resolve => { proceed = resolve; });
 vi.spyOn(rig.persistence.plans, 'getById').mockImplementationOnce(async id => { await paused; return read(id); });
 try {
  const renaming = evidenceRenamed(rig.root, oldPath, 'Archive'); stores.dispose();
  expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);
  proceed(); await renaming;
  return stores;
 } finally { for (const subscription of rig.persistence.subscriptions) subscription.dispose(); }
}
