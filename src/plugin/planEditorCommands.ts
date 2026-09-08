import { Platform, type App, type TFile } from 'obsidian';
import { isErr, type Result } from '../core/result/Result';
import type { PlanId } from '../domain/plan/PlanId';
import type { Command } from '../application/commands/Command';
import type {
	SetPlanBackgroundError,
	SetPlanBackgroundInput,
	SetPlanBackgroundOutcome,
} from '../application/commands/plan/SetPlanBackground';
import type { ContinueContext } from '../application/continueContext';
import { backgroundKindFor } from '../domain/plan/PlanBackgroundRef';
import { renovationProjectOpenPlan } from './renovationProjectOpenSeams';
import { PlanBackgroundSuggestModal } from '../presentation/modals/PlanBackgroundSuggestModal';
import { PlanSuggestModal } from '../presentation/modals/PlanSuggestModal';
import {
	noticeOnlySinks,
	notify,
	notifyWarning,
} from '../presentation/notices/notify';
import { surfaceError } from '../presentation/errors/surfaceError';
import { PlanEditorView } from '../presentation/views/PlanEditorView';
import { tr } from '../presentation/i18n/strings';
import { entriesOfType } from './indexEntries';
import type { PluginCommandHost } from './commandHost';

/**
 * The Plan Editor's two commands, kept out of the plugin shell so that file stays what it
 * says it is: registration and nothing else. What is here is the BEHAVIOUR behind two
 * `addCommand` calls; the calls themselves still happen in `onload`.
 *
 * `sampleProject.ts` is the sibling module with the same shape, and both take the same
 * `PluginCommandHost` — which is why that interface is its own file rather than declared
 * here.
 */

/**
 * Everything the plugin can currently offer as a background: the Vault's own file list,
 * narrowed by the one function that decides what a background can be.
 */
function backgroundCandidates(app: App): TFile[] {
	return app.vault.getFiles().filter((file) => backgroundKindFor(file.path) !== null);
}

/**
 * Dispatch through the REVERSIBLE adapter, not the plain command, even though slice 6 owns
 * `CommandHistory` and there is nothing to press undo with yet. The adapter is the thing
 * that history will hold, so routing the only caller through it now means slice 6 wires a
 * history rather than also re-pointing this call — and the snapshot it records is correct
 * from the first import either way.
 */
async function applyBackground(host: PluginCommandHost, planId: PlanId, file: TFile): Promise<void> {
	// ANNOTATED, not inferred, and the annotation is the STRUCTURAL command shape rather
	// than the concrete adapter class: what leaves the composition root is guarded (SDD
	// §66), a wrapper with the same `execute`, which a parameter typed as the class would
	// refuse.
	//
	// What this annotation does NOT do — and an earlier version of this comment claimed it
	// did — is keep `undo` alive for fallow. `Command` declares `execute` and nothing else,
	// and `guardCommand` hands back only `{ execute }`, so `undo` is invisible from here.
	// Both members are kept by the `fallow-ignore-next-line unused-class-member` marks
	// inside `ReversibleSetPlanBackground.ts`, where the reason is written down. `undo` has
	// no production caller at all: it is driven by tests, and it exists because
	// `CommandHistory` is what will hold this adapter once a background import becomes
	// undoable.
	const command: Command<SetPlanBackgroundInput, Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>> | undefined =
		host.root.persistence?.reversibleSetPlanBackground;
	const kind = backgroundKindFor(file.path);
	if (command === undefined || kind === null) return;

	const result = await command.execute({
		planId,
		// `page` only for a pdf: the reference type says a page is meaningful only there,
		// and writing one for an image would put a key in frontmatter the mapper then drops.
		background: kind === 'pdf' ? { path: file.path, kind, page: 1 } : { path: file.path, kind },
	});

	if (isErr(result)) {
		// Through the surface policy (SDD §66's last step): a translated sentence keyed by the
		// error's code, never the error's own `message`, which is developer text.
		//
		// **This is the change the older comment here predicted**, in the words it used: "slices
		// 13 and 17 change what an error notice IS, once, at that function." Slice 17 landed and
		// this site needed only its ORIGIN — picking a background file is an explicit operation
		// the user invoked from a modal — because the decision moved out of the call site
		// entirely. `noticeOnlySinks` is what a plugin command has: no view, no form, no
		// indicator.
		surfaceError(result.error, { kind: 'explicit-operation' }, noticeOnlySinks);
	}
	// Nothing else to do on success: the command published `PlanBackgroundChanged`, and the
	// open Plan Editor re-hydrates off that. This code does not know a canvas exists.
}

/**
 * Ask which Plan, then open it.
 *
 * A plain `callback` and a picker, where this used to be a `checkCallback` requiring the
 * ACTIVE FILE to be a plan note. That precondition made the command invisible in the
 * palette for any vault without plan notes — which, with nothing in the app able to create
 * one, was every vault. One activation rule instead of two, available from anywhere, and a
 * plan note being open is a fuzzy match rather than a requirement.
 *
 * The command ID is unchanged on purpose: Obsidian binds a user's hotkey to it, so it is
 * DATA. What changed is behaviour behind the same name.
 *
 * Routes through `renovationProjectOpenPlan` rather than its own `revealPlanEditor` call
 * (design slice 22, Task 3), so the palette and the project surface share one door and one
 * fault mapping. `rememberContinue` is called on `'opened'` only, and only when the picked
 * entry carries a `projectId` — the requirement note's main-flow step 1 names a palette open
 * as a Resume-recording open, and "opened" here means a confirmed leaf open, not the
 * asynchronous hydration the note still leaves out of scope.
 */
function openPlanPicker(host: PluginCommandHost, rememberContinue: (context: ContinueContext) => void): void {
	const plans = entriesOfType(host.root.persistence?.index, 'renovation-plan');
	if (plans.length === 0) {
		notify(tr('plan.none'));
		return;
	}
	const picker = new PlanSuggestModal(host.app, plans, (plan) => {
		// A modal callback returns nothing, so this activation has no awaiter — and a fault in
		// it was reaching neither the user nor the log. It is answered inside `revealCandidate`
		// now rather than here: two picks of the same plan before the first settles are one
		// activation, and answering at the CALL SITE reported one failure once per pick. Awaiting
		// the seam's own verdict adds no second fault path — `renovationProjectOpenPlan` cannot
		// reject, only resolve `'opened'` or `'failed'`.
		//
		// The seam is built HERE rather than at picker-open time, so `host.root.logger` is read
		// per pick: `saveSettings` replaces the composition root, and a picker left open across
		// one would otherwise go on writing through a replaced logger. `RenovationPlannerPlugin`
		// states the same convention where it binds `rememberContinue`.
		void (async (): Promise<void> => {
			const outcome = await renovationProjectOpenPlan(host.app.workspace, host.root.logger)(plan.id);
			if (outcome === 'opened' && plan.projectId !== undefined) {
				rememberContinue({ projectId: plan.projectId, planId: plan.id });
			}
		})();
	});
	picker.open();
}

/**
 * `rememberContinue` is a parameter here rather than a member of `PluginCommandHost`
 * (the brief's smaller-diff choice): that interface is structural and shared by
 * `sampleProject.ts` and `assetDesignerCommands.ts`, each with its own test fixture — widening
 * it would hand every one of those a Continue-recording capability none of them uses, and
 * break every fixture that builds a `PluginCommandHost` literal until it grew the member too.
 */
export function registerPlanEditorCommands(
	host: PluginCommandHost,
	rememberContinue: (context: ContinueContext) => void,
): void {
	host.addCommand({
		id: 'open-plan-editor',
		name: tr('command.open-plan-editor'),
		/**
		 * A `checkCallback` again, and for the OPPOSITE reason to the one that took the first one
		 * away. The old check asked whether a plan note was the ACTIVE FILE — a precondition
		 * something else in the app has to satisfy first, which kept this command invisible in
		 * every vault that had none. This one asks about the DEVICE, which nothing in the vault can
		 * change: the Plan Editor draws no canvas on mobile at all (`PlanEditorView.sync`), so a
		 * palette entry there would open a leaf that says it cannot be used. `new-project` states
		 * the same argument at length; the picker over the Project Index is untouched.
		 *
		 * The command id is unchanged, because a user's hotkey is bound to it.
		 */
		checkCallback: (checking: boolean) => {
			if (Platform.isMobile) return false;
			if (!checking) openPlanPicker(host, rememberContinue);
			return true;
		},
	});

	host.addCommand({
		id: 'set-plan-background',
		name: tr('command.set-plan-background'),
		checkCallback: (checking: boolean) => {
			// The mobile refusal FIRST, before the active-view question: the editor mounts nothing
			// there, so there is never an active one to find and the answer would be the same —
			// stating it here is what makes the reason readable rather than incidental.
			if (Platform.isMobile) return false;
			const view = host.app.workspace.getActiveViewOfType(PlanEditorView);
			const planId = view?.getState()['planId'];
			if (typeof planId !== 'string' || planId.length === 0) return false;
			if (checking) return true;

			const candidates = backgroundCandidates(host.app);
			if (candidates.length === 0) {
				// WARNING, not the `info` default: this reports that something the user
				// explicitly asked for did not happen, and the remedy is OUTSIDE the plugin —
				// add a supported file to the vault. A notice gone in six seconds can be gone
				// before they have worked out what to do. `plan.none` above stays at `notify`
				// for the opposite reason: it states a fact about an empty vault with no
				// failed action behind it, which is what the `info` tier is for.
				notifyWarning(tr('background.unsupported'));
				return true;
			}
			const picker = new PlanBackgroundSuggestModal(host.app, candidates, (file) => {
				void applyBackground(host, planId as PlanId, file);
			});
			picker.open();
			return true;
		},
	});
}
