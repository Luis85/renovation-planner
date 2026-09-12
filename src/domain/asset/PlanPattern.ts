/** How an asset draws when it is a wall's material (ADR-0031) — a closed list drawn in theme colours, never a colour. */
export type PlanPattern = 'brick' | 'stone' | 'concrete' | 'timber' | 'insulation' | 'drywall' | 'glass';

export const PLAN_PATTERNS: readonly PlanPattern[] = ['brick', 'stone', 'concrete', 'timber', 'insulation', 'drywall', 'glass'];

export function isPlanPattern(value: unknown): value is PlanPattern {
	return typeof value === 'string' && (PLAN_PATTERNS as readonly string[]).includes(value);
}
