import type { ProjectOrigin } from '../application/navigation/ProjectDestination';
import type { App, Vault, Workspace } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
import type { ProjectIndex, ProjectIndexEntry } from '../application/ports/ProjectIndex';
import type { ContinueContext } from '../application/continueContext';
import { openProjectNote, type ProjectNoteOpenOutcome } from '../infrastructure/obsidian/workspace/openNote';
import { planIdOf, revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { PlanSuggestModal } from '../presentation/modals/PlanSuggestModal';
import { tr } from '../presentation/i18n/strings';
import { entriesOfType } from './indexEntries';
import { revealAssetDesigner } from '../infrastructure/obsidian/workspace/revealAssetDesigner';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import { PLAN_EDITOR_VIEW } from '../presentation/views/PlanEditorView';
import { ASSET_DESIGNER_VIEW } from '../presentation/designer/AssetDesignerView';
import { ASSET_LIBRARY_VIEW } from '../presentation/library/AssetLibraryView';
import { notify, notifyFault } from '../presentation/notices/notify';

/**
 * `RenovationProjectDeps.openPlan`, bound to the real `revealPlanEditor` — pulled out of
 * `renovationProjectDeps` for line budget alone: `composition-root.ts` sat at its 400-line
 * cap, and CLAUDE.md's own account of `inspector-wiring.ts` is why the answer is an
 * extraction rather than a second collapsed literal. Same seam, same reasoning, just no
 * longer inline.
 */
export function renovationProjectOpenPlan(workspace: Workspace, logger: Logger): (planId: string, origin?: ProjectOrigin) => Promise<'opened' | 'failed'> {
	return (planId, origin) =>
		revealPlanEditor(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.plan-editor.reveal-failed');
				},
			},
			PLAN_EDITOR_VIEW,
			planId,
			origin,
		);
}

/**
 * Ask which plan, then act on the one picked — ONE picker, and never two of it at once.
 *
 * **The guard is CLAUDE.md's two-activations-in-one-tick shape, one layer up from the one
 * `revealCandidate` already holds.** Everything in the returned function up to `.open()` is
 * synchronous, so a double press of a button bound to it stacked TWO modals: the user picked in
 * the top one, navigated, and a second picker was still on screen. No leaf was ever duplicated —
 * `revealCandidate`'s in-flight map answers for that — but a picker is a surface of its own.
 * `assetPlacementTask.pickPlaceable` spells the same refusal as
 * `if (dialogs.current !== null) return null`; that is a Pinia store and `plugin/` cannot reach
 * one, so the flag is this closure's.
 *
 * **A FACTORY rather than a plain `pickPlanThen(app, index, then)` call, because the flag needs
 * somewhere to live.** Module scope would give every door in the plugin one shared picker slot —
 * coupling callers that have nothing to do with each other, and leaking between cases in a suite
 * file, since a module registry is per FILE and not per case. Rebuilding it per press would guard
 * nothing at all. A closure per seam is the only one of the three that is exactly as wide as the
 * property.
 *
 * **Released through `onClose`**, which `Modal.close()` runs — so BOTH orderings of "the user
 * chose" reach it (`FuzzySuggestModal` in `tests/helpers/obsidian-mock.ts` drives `choose` and
 * `chooseAfterClose` for precisely that reason), and so does Escape. A flag cleared only by a
 * choice would leave the door dead after the first dismissal.
 *
 * **What it does not cover, named rather than implied:** two presses in a vault with NO plans
 * raise two notices. That arm opens no modal for the flag to track, and the notice is the whole
 * of what happens.
 *
 * `openPlanPicker` in `planEditorCommands.ts` is these same three steps — the index entries, the
 * no-plans notice, the modal — and is NOT routed through here, because that file is outside
 * AD13's lease. So the clone `npm run analyze` can see is deliberately half-closed, and closing
 * it is one call-site swap rather than a design question.
 */
export function planPicker(app: App, index: ProjectIndex | undefined, then: (plan: ProjectIndexEntry) => void): () => void {
	let picking = false;
	return () => {
		if (picking) return;
		const plans = entriesOfType(index, 'renovation-plan');
		if (plans.length === 0) {
			notify(tr('plan.none'));
			return;
		}
		picking = true;
		const picker = new PlanSuggestModal(app, plans, then);
		// CHAINED rather than replaced, and the difference is not stylistic. `Modal.onClose` is
		// documented as a subclass hook, but whether `SuggestModal` implements one of its own for
		// teardown is not in `obsidian.d.ts` and cannot be checked from here — the mock's is a
		// no-op, which is exactly the fake-kinder-than-the-real-thing shape. A bare assignment
		// would shadow any real teardown and leak a scope per dismissal; binding first releases
		// the flag IN ADDITION to whatever the base does, whichever that turns out to be.
		const inherited = picker.onClose.bind(picker);
		picker.onClose = (): void => {
			inherited();
			picking = false;
		};
		picker.open();
	};
}

/**
 * `AssetDesignerDeps.usePlan` (AD13): the designer's way INTO a plan.
 *
 * **Which plan, decided by ONE documented rule rather than by whatever the workspace happens to
 * look like** (contract C05's own requirement for an inclusion policy, met here for a
 * destination): exactly one plan open in the Plan Editor means that plan, and every other count
 * — none, or two different ones — asks. Two leaves showing the SAME plan is still one plan, which
 * is why the ids are deduplicated before they are counted; a split pane or a restored layout
 * produces that state and a user with one plan open does not think of it as two.
 *
 * **It reuses `planPicker` above and never builds a second picker.** A second surface answering
 * "which plan did you mean" is two places for that answer to differ — the shape ruling AD08-R1
 * refuses for "which part did you mean". It also reuses `renovationProjectOpenPlan` above rather
 * than composing its own `revealPlanEditor` call, so the palette command, the project surface and
 * this door share one activation and one fault mapping ("one action, every input").
 *
 * **Cancelling the picker writes nothing and opens nothing**, which is not a guard here but a
 * property of the mechanism: `onChooseItem` is the ONLY path out of the modal that calls
 * anything, so a dismissal reaches no reveal and no command.
 *
 * **The Continue context is recorded on the PICKER arm and deliberately not on the other**, which
 * is a behaviour difference worth stating rather than leaving to be discovered. The picked entry
 * carries a `projectId`, so this arm records exactly what `openPlanPicker` records and on the same
 * condition (`'opened'`, and a project id actually present) — a plan reached this way belongs in
 * `ProjectList`'s `Continue` group like any other. The already-open arm has no entry at all: it
 * has a `planId` read off a leaf's view state and nothing else, and `ContinueContext` needs a
 * project. It needs no record either — every door that can open a Plan Editor records one
 * (`ProjectDetailState`, `ViewRoot`, `openPlanPicker`), so a plan already open was reached through
 * one of them and the stored context already names it. Resolving the project from the index here
 * instead would be a second answer to "which project is this plan in".
 *
 * **How far this gesture reaches, written to the check rather than to the label.** It opens the
 * Plan Editor on the chosen plan and stops there; it does NOT arm that editor's placement tool
 * with the asset, because the only channel into an open editor is `ProjectOrigin`, which is
 * `application/`-owned and carries `roomId`/`workId`/`costId` and no asset. `DesignerUsePlan.vue`
 * carries the rest of that account and the change AD13's report requests.
 *
 * **Continuing into an ALREADY OPEN editor preserves that editor's selection and camera**, and
 * that too is the mechanism rather than a promise: `revealCandidate` calls `setViewState` only on
 * a leaf IT created, so revealing an existing one disturbs nothing the user has panned or
 * selected. That is AD13's second acceptance criterion, "as supported by the host state
 * contract".
 */
export function assetDesignerUsePlan(
	app: App,
	index: ProjectIndex | undefined,
	logger: Logger,
	rememberContinue: (context: ContinueContext) => void,
): () => void {
	const openPlan = renovationProjectOpenPlan(app.workspace, logger);
	const pick = planPicker(app, index, (plan) => {
		// Detached, like every other door out of a modal callback, and awaited INSIDE rather than
		// at the call site for `openPlanPicker`'s own reason: the verdict is what decides whether
		// a Continue context is recorded, and `renovationProjectOpenPlan` cannot reject.
		void (async (): Promise<void> => {
			const outcome = await openPlan(plan.id);
			if (outcome === 'opened' && plan.projectId !== undefined) rememberContinue({ projectId: plan.projectId, planId: plan.id });
		})();
	});
	return () => {
		const open = [
			...new Set(
				app.workspace
					.getLeavesOfType(PLAN_EDITOR_VIEW)
					.map((leaf) => planIdOf(leaf))
					.filter((planId): planId is string => planId !== undefined),
			),
		];
		// ONE conditional rather than `open.length === 1 && only !== undefined`: the second half
		// of that pair can never be false when the first is true, and an unreachable guard costs
		// a branch it can never pay back (CLAUDE.md's coverage rule).
		const only = open.length === 1 ? open[0] : undefined;
		if (only !== undefined) {
			void openPlan(only);
			return;
		}
		pick();
	};
}

/**
 * `RenovationProjectDeps.openAsset`, bound to the real `revealAssetDesigner` — the same
 * line-budget extraction as `renovationProjectOpenPlan` above, and the same door Task B9's
 * `open-asset-designer` picker opens through: a just-created asset and a picked one both land
 * in exactly one leaf, because both callers share this one binding rather than each deciding
 * activation for itself.
 */
export function renovationProjectOpenAsset(workspace: Workspace, logger: Logger): (assetId: string) => Promise<void> {
	return (assetId) =>
		revealAssetDesigner(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.asset-designer.reveal-failed');
				},
			},
			ASSET_DESIGNER_VIEW,
			assetId,
		);
}

/**
 * `RenovationProjectDeps.openAssetLibrary`, bound to the real `revealView` — the same
 * line-budget extraction as its two siblings above, and `void` rather than `Promise<void>` for
 * the reason its own docblock gives: a SINGLETON with no id to resolve takes the plain
 * `revealView` every other singleton reveal in this plugin already uses
 * (`RenovationPlannerPlugin.openProject`, and this view's own command into itself), which
 * answers every fault through `reportFault` and cannot reject.
 */
export function renovationProjectOpenAssetLibrary(workspace: Workspace, logger: Logger): () => void {
	return () => {
		void revealView(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.asset-library.reveal-failed');
				},
			},
			ASSET_LIBRARY_VIEW,
		);
	};
}

/**
 * `PlanEditorDeps.openNote`: the SAME `openProjectNote` the project view uses, because that
 * function resolves any entity id through the index — a plan's note needs no second opener.
 * The fault mapping is this door's own event name (`plan-editor.open-note-failed`), so a log
 * line says which of the two callers of `openProjectNote` faulted; the coalescing
 * (`openingByPath`, inside `openProjectNote` itself) is shared with the project view's own
 * binding, which is correct — the two ids never collide, since a plan's note and a project's
 * note are never the same file.
 */
export function planEditorOpenNote(
	workspace: Workspace,
	vault: Vault,
	index: ProjectIndex,
	logger: Logger,
): (entityId: string) => Promise<ProjectNoteOpenOutcome> {
	return (entityId) =>
		openProjectNote(
			{
				workspace,
				vault,
				index,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'plan-editor.open-note-failed');
				},
			},
			entityId,
		);
}

/**
 * `RenovationProjectDeps.openProject`, bound to the real `openProjectNote` — the same
 * line-budget extraction as `renovationProjectOpenPlan` above, and nothing about the
 * behaviour moved: the fault mapping (`view.project.open-failed`) and the coalescing this
 * wraps (`openingByPath`, inside `openProjectNote` itself) are unchanged.
 */
export function renovationProjectOpenProject(
	workspace: Workspace,
	vault: Vault,
	index: ProjectIndex,
	logger: Logger,
): (projectId: string) => Promise<ProjectNoteOpenOutcome> {
	return (projectId) =>
		openProjectNote(
			{
				workspace,
				vault,
				index,
				// The fault answers `'failed'` down there and never `'missing'`: the id DID
				// resolve and the open faulted, so the list behind the row is not stale and a
				// vault-wide re-read would answer a question nobody asked. This notice is what
				// the user acts on.
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.project.open-failed');
				},
			},
			projectId,
		);
}
