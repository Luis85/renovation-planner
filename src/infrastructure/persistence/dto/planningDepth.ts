import { of } from '../../../core/money/Money';
import { z } from 'zod';
import { EVIDENCE_PHASES, EVIDENCE_TYPES } from '../../../domain/renovation/PlanningDepth';
import { QUANTITY_RULES } from '../../../domain/requirement/RequirementSource';

const id = z.string().min(1), decimal = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/);
const money = z.object({ amount: decimal, currency: z.string().regex(/^[A-Z]{3}$/) }).transform(value => of(value.amount, value.currency));
const context = { id, roomId: id, targetId: id, workId: z.string() };
export const RequirementSourceSchema = z.object({ planId: id, targetId: id, workId: z.string(), outcomeId: z.string(), state: z.enum(['current', 'intended']),
	rule: z.enum(QUANTITY_RULES), manual: decimal, coverage: decimal, lot: z.string(), minimum: z.string() });
export const PlanningDepthSchema = z.object({
	procurement: z.array(z.object({ ...context, requirementId: id, unit: z.enum(['m', 'm2', 'piece']), purchased: decimal, reserved: decimal })),
	costs: z.array(z.object({ ...context, title: z.string(), category: z.enum(['material', 'labor', 'other']), requirementId: z.string(), planned: money.nullable(), cancelled: z.boolean(),
		facts: z.array(z.object({ id, stage: z.enum(['committed', 'actual']), amount: money, description: z.string(), commitmentId: z.string(), cancelled: z.boolean() })) })),
	evidence: z.array(z.object({ ...context, description: z.string(), type: z.enum(EVIDENCE_TYPES), phase: z.enum(EVIDENCE_PHASES), path: id, subpath: z.string(), recordId: z.string(),
		pin: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).nullable() })),
});
