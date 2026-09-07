import { inRenovationScope } from '../renovation/renovationSummary';
import { createRequirementId } from '../../../domain/requirement/RequirementId';
import { Decimal } from 'decimal.js';
import { createEntityId } from '../../../core/identity/generateId';
import { of } from '../../../core/money/Money';
import { EMPTY_DEPTH, type CostRecord, type Evidence, type Procurement } from '../../../domain/renovation/PlanningDepth';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementSource } from '../../../domain/requirement/RequirementSource';
import type { MaterialInput, PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import type { RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import { planningSelectionContext } from './planningSelectionContext';

export type PlanningKind = 'material' | 'procurement' | 'cost' | 'evidence';
export interface PlanningDraft {
	kind: PlanningKind; id: string; roomId: string; targetId: string; workId: string; recordId: string;
	title: string; assetId: string; requirementId: string; waste: string; override: string;
	source: RequirementSource; purchased: string; reserved: string;
	category: CostRecord['category']; planned: string; facts: { id: string; stage: 'committed' | 'actual'; amount: string; description: string; commitmentId: string; cancelled: boolean }[];
	date?: string; cancelled: boolean; path: string; subpath: string; type: Evidence['type']; phase: Evidence['phase']; pin: boolean; pinX: string; pinY: string;
}
function materialDraft(baseline: PlanningBaseline, roomId: string, id: string, focusedId: string, targetId: string) {
 const material = baseline.materials.find(item => item.entity.id === id && inRenovationScope({ roomId: item.entity.origin.zoneId, targetId: item.entity.source?.targetId ?? item.entity.origin.zoneId }, roomId, targetId))?.entity;
 const context = planningSelectionContext(baseline, roomId, focusedId, targetId);
 const source: RequirementSource = material?.source ?? { planId: baseline.plan.entity.id, targetId: context.targetId, workId: context.workId, outcomeId: context.outcomeId, state: 'current', rule: 'room-area', manual: '0', coverage: '1', lot: '', minimum: '' };
 return { source, ...materialValues(material) };
}
function materialValues(material: Requirement | undefined) {
 return { assetId: material?.assetId ?? '', requirementId: material?.id ?? '', waste: material?.wasteFactor.mul(100).toString() ?? '10', override: material?.quantity.override?.value.toString() ?? '' };
}
function costDraft(cost: CostRecord | undefined) {
 return { category: cost?.category ?? 'material' as const, planned: cost?.planned?.amount ?? '', facts: cost?.facts.map(fact => ({ ...fact, amount: fact.amount.amount })) ?? [], cancelled: cost?.cancelled ?? false };
}
function evidenceDraft(evidence: Evidence | undefined) {
 const current: Partial<Evidence> = evidence ?? {};
 const { date = '', path = '', subpath = '', type = 'document', phase = 'before', pin } = current;
 return { date, path, subpath, type, phase, pin: !!pin, pinX: String(pin?.x ?? 0.5), pinY: String(pin?.y ?? 0.5) };
}
function procurementDraft(procurement: Procurement | undefined) { return { purchased: procurement?.purchased ?? '0', reserved: procurement?.reserved ?? '0' }; }
type PlanningFocus = string | { focusedId?: string; targetId?: string };
function focusContext(focus: PlanningFocus, roomId: string) {
 return typeof focus === 'string' ? { focusedId: focus, targetId: roomId } : { focusedId: focus.focusedId ?? '', targetId: focus.targetId ?? roomId };
}
export function planningDraft(kind: PlanningKind, baseline: PlanningBaseline, roomId: string, id = '', focus: string | { focusedId?: string; targetId?: string } = ''): PlanningDraft {
 const { focusedId, targetId } = focusContext(focus, roomId);
 const depth = baseline.plan.entity.renovation?.depth ?? EMPTY_DEPTH;
 const material = materialDraft(baseline, roomId, id, focusedId, targetId);
 const context = planningSelectionContext(baseline, roomId, focusedId, targetId);
 const cost = depth.costs.find(item => item.id === id && inRenovationScope(item, roomId, targetId)), evidence = depth.evidence.find(item => item.id === id && inRenovationScope(item, roomId, targetId));
 const procurement = depth.procurement.find(item => item.requirementId === id);
 const existing = kind === 'material' ? material.requirementId : kind === 'procurement' ? procurement?.id : '';
 return { kind, id: existing || (kind === 'material' ? createRequirementId() : createEntityId('record')), roomId, targetId: material.source.targetId, workId: material.source.workId,
 recordId: context.recordId, title: '', ...material, requirementId: material.requirementId || (kind === 'cost' ? context.requirementId : ''), ...procurementDraft(procurement), ...costDraft(cost), ...evidenceDraft(evidence),
 ...(material.requirementId ? { roomId: baseline.materials.find(item => item.entity.id === material.requirementId)?.entity.origin.zoneId ?? roomId } : {}), ...recordDraft(cost, evidence) };
}
function recordDraft(cost: CostRecord | undefined, evidence: Evidence | undefined): Partial<PlanningDraft> {
 if (cost) return { id: cost.id, roomId: cost.roomId, targetId: cost.targetId, workId: cost.workId, title: cost.title, requirementId: cost.requirementId };
 if (evidence) return { id: evidence.id, roomId: evidence.roomId, targetId: evidence.targetId, workId: evidence.workId, title: evidence.description, recordId: evidence.recordId };
 return {};
}
/** Inputs accept a decimal comma or point, with no thousands separators. */
function decimalInput(value: string): string { return value.trim().replace(',', '.'); }
export function materialInput(draft: PlanningDraft): MaterialInput {
	return { id: draft.id, roomId: draft.roomId, assetId: draft.assetId, waste: new Decimal(decimalInput(draft.waste)).div(100).toString(), override: decimalInput(draft.override),
		source: { ...draft.source, manual: decimalInput(draft.source.manual), coverage: decimalInput(draft.source.coverage), lot: decimalInput(draft.source.lot), minimum: decimalInput(draft.source.minimum), targetId: draft.targetId, workId: draft.workId } };
}
function replace<T extends { id: string }>(values: readonly T[], record: T): T[] { return [...values.filter(item => item.id !== record.id), record]; }
export function planningInput(draft: PlanningDraft, baseline: PlanningBaseline): RenovationInput {
	const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION, depth = renovation.depth ?? EMPTY_DEPTH;
	const link = { id: draft.id, roomId: draft.roomId, targetId: draft.targetId, workId: draft.workId };
	if (draft.kind === 'procurement') {
		const material = baseline.materials.find(item => item.entity.id === draft.requirementId)?.entity;
		const record: Procurement = { ...link, requirementId: draft.requirementId, purchased: decimalInput(draft.purchased), reserved: decimalInput(draft.reserved), unit: material?.unit ?? 'piece' };
		return { renovation: { ...renovation, depth: { ...depth, procurement: replace(depth.procurement, record) } }, intended: baseline.geometry.document.intended };
	}
	if (draft.kind === 'cost') {
		const record: CostRecord = { ...link, title: draft.title, category: draft.category, requirementId: draft.requirementId,
			planned: draft.planned ? of(decimalInput(draft.planned), baseline.currency) : null, cancelled: draft.cancelled,
			facts: draft.facts.map(fact => ({ ...fact, amount: of(decimalInput(fact.amount), baseline.currency) })) };
		return { renovation: { ...renovation, depth: { ...depth, costs: replace(depth.costs, record) } }, intended: baseline.geometry.document.intended };
	}
	const original = depth.evidence.find(item => item.id === draft.id);
	const record: Evidence = { ...original, ...link, description: draft.title, date: draft.date?.trim() || undefined, type: draft.type, phase: draft.phase, path: draft.path, subpath: draft.subpath,
		recordId: draft.recordId, pin: draft.pin ? { x: Number(decimalInput(draft.pinX)), y: Number(decimalInput(draft.pinY)) } : null };
	return { renovation: { ...renovation, depth: { ...depth, evidence: replace(depth.evidence, record) } }, intended: baseline.geometry.document.intended };
}
