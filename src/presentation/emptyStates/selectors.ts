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
 * Calibrate -> …), not a re-derivation of which lack is worse: the user is asked to do the
 * FIRST missing step of that sequence.
 *
 * It is NOT because a background-less plan has no zones — it very often does.
 * `create-sample-project` seeds five zones on a plan with no background, and the browser
 * harness refuses a background outright on SDD §55 grounds, so the two scenes this project
 * ships are both exactly that case. An earlier version of this paragraph asserted the
 * opposite and read as correct for a whole slice, because the ORDER it justifies is right
 * either way. The order is load-bearing; the premise was decoration, and wrong.
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

/**
 * `unreadable` is why this takes a second argument rather than reading a length.
 *
 * Zero projects with a refusal behind them is not an empty state: the vault may hold several
 * this build cannot parse, and the onboarding copy would tell the user to create their first
 * project while their existing ones sit unparseable on disk — wrong, and unactionable. The
 * view renders the refusal notice instead, and `EMPTY_STATE_CONTENT` gains nothing.
 *
 * This stays a function of QUERY RESULTS, so slice 14's rule holds: `unreadable` is part of
 * what `listProjects` answered, unlike the `activeToolId` that rule refused — which was
 * live editor state and would have made this question unanswerable without a `ToolManager`.
 */
export function selectRenovationProjectEmptyState(
	projects: readonly ProjectSummaryDto[],
	unreadable: number,
): 'noProjects' | null {
	if (unreadable > 0) return null;
	return projects.length === 0 ? 'noProjects' : null;
}
