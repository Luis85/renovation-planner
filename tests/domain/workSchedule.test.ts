import { describe, expect, it } from 'vitest';
import { sameRenovation } from '../../src/domain/renovation/sameRenovation';
import { isCalendarDate, validWorkSchedule } from '../../src/domain/schedule/WorkSchedule';
import { EMPTY_RENOVATION, validateRenovation, type WorkPackage } from '../../src/domain/renovation/Renovation';
import { createTrade, type TradeId } from '../../src/domain/trade/Trade';
import { createSupplier, type SupplierId } from '../../src/domain/supplier/Supplier';

const work: WorkPackage = { id: 'work', roomId: 'room', targetId: 'room', title: 'Prepare', description: '', order: 0, responsibility: 'diy', progress: 'pending', outcomes: [], dependencies: [] };
describe('explicit calendar dates and stable Work responsibility', () => {
 it.each(['2026-09-07', '2024-02-29', '0001-01-01', '9999-12-31'])('accepts the calendar date %s without timezone conversion', value => {
  expect(isCalendarDate(value)).toBe(true);
 });
 it.each(['', '2026-2-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-09-00', '0000-01-01', '2026-09-07T00:00:00Z', ' 2026-09-07'])('rejects partial or impossible date %s', value => {
  expect(isCalendarDate(value)).toBe(false);
 });
 it('supports unknown dates, a single explicit endpoint, and equal-day work', () => {
  for (const schedule of [undefined, { start: '2026-09-07' }, { end: '2026-09-08' }, { start: '2026-09-07', end: '2026-09-07' }]) {
   expect(validWorkSchedule(schedule)).toBe(true);
   expect(validateRenovation({ ...EMPTY_RENOVATION, work: [{ ...work, schedule }] }).ok).toBe(true);
  }
 });
 it.each([{}, { start: '' }, { end: 'bad' }, { start: '2026-09-09', end: '2026-09-08' }])('refuses invalid schedule %j at the domain write boundary', schedule => {
  expect(validWorkSchedule(schedule)).toBe(false);
  expect(validateRenovation({ ...EMPTY_RENOVATION, work: [{ ...work, schedule }] })).toMatchObject({ ok: false, error: { code: 'renovation.work' } });
 });
 it('requires the referenced Trade identity only for Trade responsibility', () => {
  expect(validateRenovation({ ...EMPTY_RENOVATION, work: [{ ...work, responsibility: 'trade', tradeId: 'plumbing' }] }).ok).toBe(true);
  for (const patch of [{ responsibility: 'trade' as const }, { responsibility: 'trade' as const, tradeId: ' ' }, { tradeId: 'plumbing' }]) {
   expect(validateRenovation({ ...EMPTY_RENOVATION, work: [{ ...work, ...patch }] }).ok).toBe(false);
  }
 });
 it('creates separate shared category and party identities with trimmed custom names', () => {
  expect(createTrade('trade' as TradeId, ' Custom craft ')).toEqual({ ok: true, value: { id: 'trade', name: 'Custom craft' } });
  expect(createSupplier('supplier' as SupplierId, ' Local business ')).toEqual({ ok: true, value: { id: 'supplier', name: 'Local business' } });
  for (const [id, name] of [['', 'Valid'], ['   ', 'Valid'], ['valid', ' ']]) {
   expect(createTrade(id as TradeId, name).ok).toBe(false);
   expect(createSupplier(id as SupplierId, name).ok).toBe(false);
  }
 });
});

it('treats a changed Trade identity or date endpoint as changed owned renovation facts', () => {
 const first = { ...EMPTY_RENOVATION, work: [{ ...work, responsibility: 'trade' as const, tradeId: 'trade-a', schedule: { start: '2026-09-07', end: '2026-09-08' } }] };
 for (const patch of [{ tradeId: 'trade-b' }, { schedule: { start: '2026-09-06', end: '2026-09-08' } }, { schedule: { start: '2026-09-07', end: '2026-09-09' } }, { schedule: undefined }]) expect(sameRenovation(first, { ...first, work: [{ ...first.work[0], ...patch }] })).toBe(false);
 expect(sameRenovation(first, { ...first, work: [{ ...first.work[0], schedule: { end: '2026-09-08', start: '2026-09-07' } }] })).toBe(true);
});
