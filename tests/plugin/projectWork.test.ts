// @vitest-environment jsdom
// Exercises the browser-hosted plugin composition, including its native view imports.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downstreamStack } from '../helpers/downstream';
import { expectDefined, expectOk } from '../helpers/domain';
import { readProjectWork } from '../../src/application/queries/schedule/ProjectWork';
import { planningEditorServices } from '../../src/plugin/planningEditorServices';
import { createTrade, type TradeId } from '../../src/domain/trade/Trade';
import { parseFrontmatter } from '../helpers/vault';
afterEach(() => { vi.restoreAllMocks(); });
describe('project Work over the existing floor registers', () => {
 it('assigns a real Trade and explicit dates through the editor command, preserves IDs on rename and allows unresolved existing assignments to remain', async () => {
  const rig = await downstreamStack();
  try {
   const services = planningEditorServices(rig.root, rig.stack.deps.vault, {} as never), renovation = expectDefined(services.renovation, 'renovation');
   const trade = expectOk(createTrade('trade-plumbing' as TradeId, 'Plumbing')), named = expectOk(await rig.persistence.trades.save(trade, 'absent'));
   const value = { ...rig.value, work: [{ ...rig.value.work[0], responsibility: 'trade' as const, tradeId: trade.id, schedule: { start: '2026-09-07', end: '2026-09-08' } }] };
   const command = renovation.command(expectOk(await renovation.read(rig.plan.id)), { renovation: value, intended: undefined }, rig.ledger); expectOk(await command.execute());
   const path = expectDefined(rig.persistence.index.getPath(rig.plan.id), 'plan path');
   expect(parseFrontmatter(expectDefined(rig.stack.vault.entries.get(path), 'plan bytes')).frontmatter['schema-version']).toBe(7);
   expect(expectOk(await readProjectWork(rig.persistence, rig.plan.projectId)).rows[0].work).toEqual(value.work[0]);
   expectOk(await rig.persistence.trades.save({ ...trade, name: 'Water services' }, named.version));
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].tradeId).toBe(trade.id);
   rig.stack.vault.entries.delete(expectDefined(rig.persistence.index.getPath(trade.id), 'trade path'));
   const next = { ...value, work: [{ ...value.work[0], description: 'Keep unresolved assignment while documenting preparation' }] };
   expectOk(await renovation.command(expectOk(await renovation.read(rig.plan.id)), { renovation: next, intended: undefined }, rig.ledger).execute());
   const missing = { ...next, work: [{ ...next.work[0], tradeId: 'not-a-readable-trade' }] };
   expect(await renovation.command(expectOk(await renovation.read(rig.plan.id)), { renovation: missing, intended: undefined }, rig.ledger).execute()).toMatchObject({ ok: false, error: { code: 'renovation.trade-missing' } });
   expect(expectOk(await renovation.read(rig.plan.id)).plan.entity.renovation).toEqual(next);
  } finally { rig.dispose(); }
 });
 it('refuses a peer edit against a stale schedule baseline and can undo a supported explicit date change', async () => {
  const rig = await downstreamStack();
  try {
   const renovation = expectDefined(planningEditorServices(rig.root, rig.stack.deps.vault, {} as never).renovation, 'renovation');
   const baseline = expectOk(await renovation.read(rig.plan.id));
   const dated = { ...rig.value, work: [{ ...rig.value.work[0], schedule: { end: '2026-10-01' } }] };
   const command = renovation.command(baseline, { renovation: dated, intended: undefined }, rig.ledger); expectOk(await command.execute()); expectOk(await command.undo()); expectOk(await command.execute());
   expect(await renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger).execute()).toMatchObject({ ok: false });
   expect(expectOk(await renovation.read(rig.plan.id)).plan.entity.renovation?.work[0].schedule).toEqual({ end: '2026-10-01' });
  } finally { rig.dispose(); }
 });
});
