import { renovationReferents, validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { sourceMeasurement, validDecimal, validRequirementSource, type RequirementSource, type QuantityGeometry } from '../../src/domain/requirement/RequirementSource';
import { EMPTY_DEPTH, outstanding, validProcurement, type CostRecord, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import { validatePlanningDepth } from '../../src/domain/renovation/validatePlanningDepth';
import { EMPTY_RENOVATION, validateRenovation } from '../../src/domain/renovation/Renovation';
import { sameRenovation } from '../../src/domain/renovation/sameRenovation';
import { reconcileCosts } from '../../src/domain/cost/reconcileCosts';
import { of } from '../../src/core/money/Money';
import { expectOk } from '../helpers/domain';
import { WALL_LOOP } from '../helpers/structure';

const source: RequirementSource = { planId: 'plan', targetId: 'room', workId: '', outcomeId: '', state: 'current', rule: 'room-area', manual: '0', coverage: '1', lot: '', minimum: '' };
const geometry: QuantityGeometry = { objects: [{ id: 'room', points: WALL_LOOP.walls.map(wall => wall.start) }], structure: { ...WALL_LOOP, openings: [{ id: 'door', hostId: 'wall-a', kind: 'door', offset: 1000, width: 900, height: 2000, sill: 0 }] } };
const link = { id: 'cost', roomId: 'room', targetId: 'room', workId: '' };
const cost: CostRecord = { ...link, title: 'Finish', category: 'material', requirementId: '', planned: of('1000', 'EUR'), facts: [], cancelled: false };
const evidence: Evidence = { ...link, id: 'photo', description: 'Before', type: 'photo', phase: 'before', path: 'wall.jpg', subpath: '', recordId: '', pin: { x: 0.25, y: 1 } };

describe('bounded contextual quantity sources', () => {
 it.each([
 ['room-area', 'room', 'm2', 12000000], ['room-perimeter', 'room', 'm', 14000], ['wall-length', 'wall-a', 'm', 4000],
 ['wall-gross', 'wall-a', 'm2', 9600000], ['wall-net', 'wall-a', 'm2', 7800000], ['opening-area', 'door', 'm2', 1800000],
 ['count', 'door', 'piece', 1], ['count', 'wall-a', 'piece', 1], ['count', 'room', 'piece', 1],
 ] as const)('measures %s without deriving a Room outline from walls', (rule, targetId, unit, expected) => {
 expect(expectOk(sourceMeasurement({ ...source, rule, targetId }, 'room', geometry, unit)).toString()).toBe(String(expected));
 });
 it('keeps current/intended independent and only deducts one face of openings on the selected wall', () => {
 const intended = { ...WALL_LOOP, walls: WALL_LOOP.walls.map(wall => ({ ...wall, height: 3000 })) };
 expect(expectOk(sourceMeasurement({ ...source, state: 'intended', rule: 'wall-net', targetId: 'wall-a' }, 'room', { ...geometry, intended }, 'm2')).toString()).toBe('12000000');
 expect(expectOk(sourceMeasurement({ ...source, state: 'intended', rule: 'wall-net', targetId: 'wall-a' }, 'room', geometry, 'm2')).toString()).toBe('7800000');
 });
 it.each(['m', 'm2', 'piece'] as const)('converts a manual %s source through world units', unit => {
 const result = expectOk(sourceMeasurement({ ...source, rule: 'manual', manual: '2.5' }, 'room', geometry, unit));
 expect(result.toString()).toBe(unit === 'm' ? '2500' : unit === 'm2' ? '2500000' : '2.5');
 });
 it('refuses unavailable, incompatible and invalid measurements', () => {
 for (const patch of [{ targetId: 'missing' }, { rule: 'wall-gross', targetId: 'missing' }, { rule: 'wall-length', targetId: 'missing' }, { rule: 'opening-area', targetId: 'missing' }, { rule: 'count', targetId: 'missing' }, { rule: 'room-perimeter', targetId: 'wall-a' }, { rule: 'opening-area', targetId: 'room' }]) expect(sourceMeasurement({ ...source, ...patch } as RequirementSource, 'room', geometry, 'm2').ok).toBe(false);
 expect(sourceMeasurement(source, 'missing', geometry, 'm2').ok).toBe(false);
 expect(sourceMeasurement(source, 'room', geometry, 'm').ok).toBe(false);
 expect(sourceMeasurement({ ...source, rule: 'wall-gross', targetId: 'wall-a' }, 'room', { objects: [] }, 'm2').ok).toBe(false);
 expect(sourceMeasurement({ ...source, rule: 'room-area' }, 'room', { objects: [{ id: 'room', points: [] }] }, 'm2').ok).toBe(false);
 expect(sourceMeasurement({ ...source, rule: 'manual' }, 'room', geometry, 'hour').ok).toBe(false);
 for (const text of ['-1', 'NaN', 'Infinity', '1e6', '01', '', '1,2']) expect(validDecimal(text)).toBe(false);
 expect(validDecimal('0')).toBe(true); expect(validDecimal('0', true)).toBe(false);
 for (const patch of [{ planId: '' }, { targetId: '' }, { rule: 'bad' }, { state: 'bad' }, { manual: '-1' }, { coverage: '0' }, { lot: '0' }, { minimum: '1' }, { lot: '2', minimum: '-1' }]) expect(validRequirementSource({ ...source, ...patch } as RequirementSource)).toBe(false);
 expect(validRequirementSource({ ...source, lot: '2', minimum: '3' })).toBe(true);
 expect(sourceMeasurement({ ...source, coverage: '0' }, 'room', geometry, 'm2').ok).toBe(false);
 });
});
describe('one obligation with separate financial stages', () => {
 const order = { id: 'order', stage: 'committed' as const, amount: of('600', 'EUR'), description: 'Order', commitmentId: '', cancelled: false };
 const payment = { id: 'payment', stage: 'actual' as const, amount: of('200', 'EUR'), description: 'Deposit', commitmentId: 'order', cancelled: false };
 it('supports partial payments, independent expenses and overruns without double counting', () => {
 const partial = expectOk(reconcileCosts({ ...cost, facts: [order, payment] }, null, 'EUR'));
 expect(Object.fromEntries(Object.entries(partial).map(([key, value]) => [key, value.amount]))).toEqual({ planned: '1000', committed: '600.00', actual: '200.00', openCommitment: '400.00', remaining: '400' });
 const overrun = expectOk(reconcileCosts({ ...cost, facts: [order, { ...payment, amount: of('1100', 'EUR') }] }, null, 'EUR'));
 expect(overrun.openCommitment.amount).toBe('0.00'); expect(overrun.remaining.amount).toBe('-100');
 const independent = expectOk(reconcileCosts({ ...cost, facts: [order, { ...payment, commitmentId: '' }] }, null, 'EUR'));
 expect(independent.remaining.amount).toBe('200');
 });
 it('preserves cancelled facts and uses derived estimates only when the explicit plan is absent', () => {
 expect(expectOk(reconcileCosts({ ...cost, facts: [order, { ...payment, cancelled: true }] }, null, 'EUR')).actual.amount).toBe('0.00');
 expect(expectOk(reconcileCosts({ ...cost, cancelled: true, facts: [order, payment] }, null, 'EUR')).planned.amount).toBe('0');
 expect(expectOk(reconcileCosts({ ...cost, planned: null }, of('12.50', 'EUR'), 'EUR')).planned.amount).toBe('12.5');
 });
 it('refuses missing prices, cross currency, duplicate identities and dangling settlements', () => {
 const invalid: CostRecord[] = [{ ...cost, planned: null }, { ...cost, planned: of('-1', 'EUR') }, { ...cost, planned: of('1', 'USD') },
 { ...cost, facts: [order, order] }, { ...cost, facts: [{ ...order, id: '' }] }, { ...cost, facts: [{ ...order, commitmentId: 'other' }] },
 { ...cost, facts: [payment] }, { ...cost, facts: [{ ...order, cancelled: true }, payment] }, { ...cost, facts: [{ ...order, amount: of('1', 'USD') }] }, { ...cost, facts: [{ ...payment, commitmentId: '', amount: of('-1', 'EUR') }] }];
 for (const record of invalid) expect(reconcileCosts(record, null, 'EUR').ok).toBe(false);
 });
});
describe('depth identity and link validation', () => {
 it('keeps allocation facts distinct from quantity and clamps excess stock at zero', () => {
 const procurement = { ...link, requirementId: 'requirement', unit: 'm2' as const, purchased: '4', reserved: '3' };
 expect(outstanding(new Decimal('10'), procurement).toString()).toBe('3'); expect(outstanding(new Decimal('5'), procurement).toString()).toBe('0'); expect(outstanding(new Decimal('5')).toString()).toBe('5');
 expect(validProcurement(procurement)).toBe(true);
 for (const patch of [{ purchased: '-1' }, { reserved: '-1' }, { requirementId: '' }, { unit: 'hour' as const }]) expect(validProcurement({ ...procurement, ...patch })).toBe(false);
 expect(validatePlanningDepth({ ...EMPTY_DEPTH, procurement: [procurement, { ...procurement, id: 'second' }] }, EMPTY_RENOVATION).ok).toBe(false);
 });
 it('validates complete records and compares mapper order independently', () => {
 const depth = { ...EMPTY_DEPTH, costs: [cost], evidence: [evidence] };
 expect(validatePlanningDepth(depth, EMPTY_RENOVATION).ok).toBe(true);
 expect(validateRenovation({ ...EMPTY_RENOVATION, depth }).ok).toBe(true);
 expect(sameRenovation({ ...EMPTY_RENOVATION, depth }, { ...EMPTY_RENOVATION, depth: { ...depth, evidence: [Object.fromEntries(Object.entries(evidence).toReversed()) as unknown as Evidence], costs: [Object.fromEntries(Object.entries(cost).toReversed()) as unknown as CostRecord] } })).toBe(true);
 for (const patch of [{ path: '' }, { description: '' }, { type: 'unknown' }, { phase: 'unknown' }, { pin: { x: -1, y: 0 } }, { pin: { x: 1, y: Number.NaN } }, { roomId: '' }, { targetId: '' }, { id: '' }, { workId: 'missing' }]) expect(validatePlanningDepth({ ...depth, evidence: [{ ...evidence, ...patch } as Evidence] }, EMPTY_RENOVATION).ok).toBe(false);
 for (const patch of [{ title: '' }, { category: 'unknown' }, { planned: null }, { facts: [{ id: 'bad', stage: 'actual', amount: of('2', 'EUR'), commitmentId: 'missing', description: '', cancelled: false }] }]) expect(validatePlanningDepth({ ...depth, costs: [{ ...cost, ...patch } as CostRecord] }, EMPTY_RENOVATION).ok).toBe(false);
 expect(validatePlanningDepth({ ...depth, costs: [cost, cost] }, EMPTY_RENOVATION).ok).toBe(false);
 expect(validatePlanningDepth({ ...depth, costs: [{ ...cost, requirementId: 'r' }, { ...cost, id: 'c2', requirementId: 'r' }] }, EMPTY_RENOVATION).ok).toBe(false);
 expect(validatePlanningDepth({ ...depth, evidence: [{ ...evidence, recordId: cost.id, roomId: 'other' }] }, EMPTY_RENOVATION).ok).toBe(false);
 });
});

describe('planning references across spatial states', () => {
 it('names each dependent record and refuses missing Rooms or targets while allowing intended-only targets', () => {
 const procurement = { ...link, id: 'stock', requirementId: 'requirement', unit: 'm2' as const, purchased: '1', reserved: '0' };
 const depth = { costs: [cost], evidence: [evidence], procurement: [procurement] }, value = { ...EMPTY_RENOVATION, depth };
 expect(renovationReferents(value, 'room')).toEqual(['Finish', 'Before', 'requirement']); expect(renovationReferents(value, 'absent')).toEqual([]);
 const context = { roomIds: ['room'], structure: geometry.structure };
 expect(validateRenovationTargets(value, context).ok).toBe(true);
 expect(validateRenovationTargets(value, { ...context, roomIds: [] }).ok).toBe(false);
 const target = { ...value, depth: { ...depth, evidence: [{ ...evidence, targetId: 'proposed-wall' }] } };
 expect(validateRenovationTargets(target, context).ok).toBe(false);
 expect(validateRenovationTargets(target, { ...context, intended: { ...WALL_LOOP, walls: [{ ...WALL_LOOP.walls[0], id: 'proposed-wall' }] } }).ok).toBe(true);
 expect(validatePlanningDepth({ ...depth, procurement: [{ ...procurement, reserved: '-1' }] }, EMPTY_RENOVATION).ok).toBe(false);
 expect(validatePlanningDepth({ ...EMPTY_DEPTH, costs: [{ ...cost, planned: null, requirementId: 'requirement' }] }, EMPTY_RENOVATION).ok).toBe(true);
 const unnamed = { ...EMPTY_RENOVATION, subjects: [{ id: 'subject', roomId: 'room', targetId: 'room', kind: 'floor' as const, existing: null, planned: null }] };
 expect(renovationReferents(unnamed, 'room')).toEqual(['subject']);
 });
});
