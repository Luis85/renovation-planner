/**
 * What a plan IS in the property, as a LABEL (ADR-0029): it drives the Property tree's icon and
 * level label and nothing else reads it. Not an entity — no Site, Building or Floor identity
 * arrives with it, and ADR-0017's "a Plan presents as Floor" is the default rather than the rule.
 */
export const PLAN_KINDS = ['site', 'building', 'floor', 'room'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const DEFAULT_PLAN_KIND: PlanKind = 'floor';

export function isPlanKind(value: unknown): value is PlanKind {
	return typeof value === 'string' && (PLAN_KINDS as readonly string[]).includes(value);
}

/** The kind a detail plan defaults to under a parent of `parent`'s kind: one step down, and a room's child is a room. */
export function childKindOf(parent: PlanKind): PlanKind {
	const index = PLAN_KINDS.indexOf(parent);
	return PLAN_KINDS[Math.min(index + 1, PLAN_KINDS.length - 1)];
}
