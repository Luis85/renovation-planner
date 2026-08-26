import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../read-models/PlanDto';

/**
 * Which empty state a view is in — decided from query results that have ALREADY succeeded,
 * and from nothing else.
 *
 * Pure, DOM-free and Obsidian-free on purpose: this is the one piece of judgement in design
 * slice 14, and asking a function rather than a screen is the whole return on the layering.
 * Deliberately NOT a function of editor state either (no `activeToolId` parameter): whether
 * an overlay is currently in the way of an active tool is a rendering rule, and mixing it in
 * here would make "which state is this plan in" unanswerable without a live editor.
 *
 * **An `Err` never reaches either function**, which is why neither input type admits one. A
 * failed read is not an empty state: downgrading it would hide a real, actionable problem
 * behind cheerful onboarding copy telling the user to create something. The composing view
 * branches on the result first.
 */
export type PlanEditorEmptyStateKey = 'noBackground' | 'noZones';

/**
 * `plan === null` is a BROKEN REFERENCE — this leaf's persisted plan id no longer resolves
 * to anything — and returns no key. It is not "no plan yet": the editor was supposed to have
 * something and does not, and `noBackground` would read to the user as "you haven't imported
 * a plan," which may be false. Slice 17 owns what renders there.
 *
 * The precedence is a short-circuit over PRD §93's onboarding order (Import First Plan ->
 * Calibrate -> …), not a re-derivation of which lack is worse: a plan with no background
 * necessarily has no zones either, and the user is asked to do the FIRST missing step.
 */
export function selectPlanEditorEmptyState(
	plan: PlanDto | null,
	zones: readonly ZoneDto[],
): PlanEditorEmptyStateKey | null {
	if (plan === null) return null;
	if (plan.background === null) return 'noBackground';
	if (zones.length === 0) return 'noZones';
	return null;
}

export function selectRenovationProjectEmptyState(
	projects: readonly ProjectSummaryDto[],
): 'noProjects' | null {
	return projects.length === 0 ? 'noProjects' : null;
}
