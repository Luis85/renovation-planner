import { Decimal } from 'decimal.js';
import type { Money } from '../../core/money/Money';
import { validDecimal } from '../requirement/RequirementSource';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';

export interface ContextLink {
	readonly id: string;
	readonly roomId: string;
	readonly targetId: string;
	readonly workId: string;
}
/** Exclusive local allocations. Reserved stock is additional stock, never a subset of purchased. */
export interface Procurement extends ContextLink {
	readonly requirementId: string;
	readonly unit: MeasurementUnit;
	readonly purchased: string;
	readonly reserved: string;
}
export interface FinancialFact {
	readonly id: string;
	readonly stage: 'committed' | 'actual';
	readonly amount: Money;
	readonly description: string;
	/** Actuals may settle ONE commitment on the same obligation, partially or beyond its amount. */
	readonly commitmentId: string;
	readonly cancelled: boolean;
}
export interface CostRecord extends ContextLink {
	readonly title: string;
	readonly category: 'material' | 'labor' | 'other';
	readonly requirementId: string;
	/** Null uses the referenced Requirement estimate; a manual record must supply a plan. */
	readonly planned: Money | null;
	readonly facts: readonly FinancialFact[];
	readonly cancelled: boolean;
}
export const EVIDENCE_TYPES = ['document', 'photo', 'note'] as const;
export const EVIDENCE_PHASES = ['before', 'during', 'after', 'hidden-services'] as const;
export interface Evidence extends ContextLink {
	readonly description: string;
	readonly type: typeof EVIDENCE_TYPES[number];
	readonly phase: typeof EVIDENCE_PHASES[number];
	/** Canonical vault-relative path + separate heading/block subpath; filenames are not record IDs. */
	readonly path: string;
	readonly subpath: string;
	readonly recordId: string;
	/** Fraction of Room bounding box. Calibration and Room resize retain this relative location. */
	readonly pin: { readonly x: number; readonly y: number } | null;
}
export interface PlanningDepth {
	readonly procurement: readonly Procurement[];
	readonly costs: readonly CostRecord[];
	readonly evidence: readonly Evidence[];
}
export const EMPTY_DEPTH: PlanningDepth = { procurement: [], costs: [], evidence: [] };
export function outstanding(needed: Decimal, procurement?: Procurement): Decimal {
	return Decimal.max(0, needed.minus(procurement?.purchased ?? '0').minus(procurement?.reserved ?? '0'));
}
export function validProcurement(record: Procurement): boolean {
	return validDecimal(record.purchased) && validDecimal(record.reserved) && ['m', 'm2', 'piece'].includes(record.unit) && !!record.requirementId;
}
export function depthRecords(value: PlanningDepth): readonly ContextLink[] { return [...value.procurement, ...value.costs, ...value.evidence]; }
