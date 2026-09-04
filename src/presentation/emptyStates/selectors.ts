import type { PlanDto, PlanSummaryDto, ProjectSummaryDto, ZoneDto } from '../read-models/PlanDto';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';

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
	unreadable: number,
): PlanEditorEmptyStateKey | null {
	if (plan === null) return null;
	if (plan.background === null) return 'noBackground';
	// The third argument, and the LAST of the three selectors to get it — which is the thing
	// worth remembering rather than the rule. Both siblings guard on `unreadable`, and this one
	// was left out of the increment that added the guard to `selectProjectDetailEmptyState`,
	// on the surface that increment is named for: a plan whose zones all refused drew "No rooms
	// yet / Add a room" over the canvas, beside a strip saying three of them could not be
	// read. Two answers to "why is this canvas empty", and the actionable one is the wrong one.
	//
	// It goes BELOW the background check rather than above it, and that ordering is the
	// short-circuit this file's own header describes: a plan with no background cannot have
	// been asked for its zones in a way the user can act on, so the first missing step of
	// PRD §93's sequence still wins.
	if (unreadable > 0) return null;
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

/**
 * A project with no plans yet (design slice 21). A function of QUERY RESULTS, like its two
 * siblings — `status` is the store's structural gate above it, never a further argument here,
 * which is what keeps "which state is this project in" answerable by a node test.
 *
 * `unreadable` is here for exactly the reason it is on `selectRenovationProjectEmptyState`
 * above, and it arrived later only because the state it guards against was UNREACHABLE until
 * the plan listing learned to skip and count: one bad plan note used to fail the whole listing,
 * so a project with zero readable plans and a refusal behind them drew the failure screen and
 * never this. Now it draws the plans it has — none — and "Create your first plan" beside "1
 * plan could not be read" is two sentences contradicting each other about one project.
 */
export function selectProjectDetailEmptyState(
	plans: readonly PlanSummaryDto[],
	unreadable: number,
): 'noPlans' | null {
	if (unreadable > 0) return null;
	return plans.length === 0 ? 'noPlans' : null;
}

/**
 * Which empty state the asset designer is in (design slice B3, ADR-0015; widened by Task B7).
 *
 * A function of a design that has ALREADY succeeded, like its three siblings — an `Err` never
 * reaches it, because a failed read is not an empty state and telling a user to draw their
 * first footprint because the vault could not be read is the misleading onboarding slice 14
 * refuses.
 *
 * It reads `shape` and not `dimensions`, which are DERIVED from the footprint by
 * `GetAssetDesign` and would be a second answer to one question: what the canvas has to draw is
 * the outline, and a measurement is a thing the inspector prints about it.
 *
 * **Once a shape exists, neither overlay draws — the same "nothing to say once there is
 * something to look at" rule slice 14 states for the other two selectors.** A background nag
 * kept alive over a typed footprint would be nagging over real content for no reason a user
 * asked for: `AssetShape.footprintOrigin` can be `'typed'`, which needs no background at all,
 * so an asset with a shape and no spec sheet is not a gap this selector treats as one.
 *
 * **Among the shapeless states, `noBackground` outranks `noShape`** — the same "first missing
 * step of the sequence" ordering `selectPlanEditorEmptyState` states for its own pair, read from
 * the asset designer's side: `noShape`'s hand-off (Task B8's dimensions form) works with no
 * background at all, but a user who has picked nothing yet is offered the more foundational
 * action first. `selectors.test.ts` pins both halves of the ordering as behaviour.
 *
 * **That ordering is a matter of which action is OFFERED FIRST and no longer one of what is
 * reachable at all**, which it was until a review bot pointed out that it was: with the
 * dimensions gesture living only on `noShape`, a shapeless asset with no sheet could not type
 * a width and a depth without first choosing an unrelated file. `DesignerInspector` is mounted
 * in every state and offers that gesture unconditionally now, so this selector decides
 * prominence rather than access — which is the only thing an empty state should be deciding.
 */
export function selectAssetDesignerEmptyState(design: AssetDesignDto): 'noBackground' | 'noShape' | null {
	if (design.shape !== null) return null;
	return design.background === null ? 'noBackground' : 'noShape';
}
