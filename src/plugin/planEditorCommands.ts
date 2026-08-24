import type { App, TFile } from 'obsidian';
import { isErr } from '../core/result/Result';
import type { ProjectIndex, ProjectIndexEntry } from '../application/ports/ProjectIndex';
import type { PlanId } from '../domain/plan/PlanId';
import type { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { backgroundKindFor } from '../domain/plan/PlanBackgroundRef';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { PlanBackgroundSuggestModal } from '../presentation/modals/PlanBackgroundSuggestModal';
import { PlanSuggestModal } from '../presentation/modals/PlanSuggestModal';
import { notify } from '../presentation/notices/notify';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../presentation/views/PlanEditorView';
import { tr } from '../presentation/i18n/strings';
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
 * Every Plan the Project Index knows about (§47) — the index rather than the vault,
 * because it is the single answer to where an entity is and a second scan here could
 * disagree with it.
 *
 * A filter over `entries()` because the question is asked once, when a palette command
 * runs: `getIdsByType` would answer ids alone, and a picker needs the PATH to render a row.
 */
function planEntries(index: ProjectIndex | undefined): ProjectIndexEntry[] {
	return (index?.entries() ?? []).filter((entry) => entry.type === 'renovation-plan');
}

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
	// ANNOTATED, not inferred: fallow resolves a class's members through an explicit type
	// annotation, and without one it reports `execute`/`undo` as dead members of a class
	// this file is the only production caller of.
	const command: ReversibleSetPlanBackgroundCommand | undefined =
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
		// The message is the error's own, which is domain text rather than UI copy — slice 17
		// owns turning an `AppError` into a translated sentence, and inventing a second
		// mapping here is what that slice would then have to unpick.
		notify(result.error.message);
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
 */
function openPlanPicker(host: PluginCommandHost): void {
	const plans = planEntries(host.root.persistence?.index);
	if (plans.length === 0) {
		notify(tr('plan.none'));
		return;
	}
	const picker = new PlanSuggestModal(host.app, plans, (plan) => {
		void revealPlanEditor(host.app.workspace, PLAN_EDITOR_VIEW, plan.id);
	});
	picker.open();
}

export function registerPlanEditorCommands(host: PluginCommandHost): void {
	host.addCommand({
		id: 'open-plan-editor',
		name: tr('command.open-plan-editor'),
		callback: () => {
			openPlanPicker(host);
		},
	});

	host.addCommand({
		id: 'set-plan-background',
		name: tr('command.set-plan-background'),
		checkCallback: (checking: boolean) => {
			const view = host.app.workspace.getActiveViewOfType(PlanEditorView);
			const planId = view?.getState()['planId'];
			if (typeof planId !== 'string' || planId.length === 0) return false;
			if (checking) return true;

			const candidates = backgroundCandidates(host.app);
			if (candidates.length === 0) {
				notify(tr('background.unsupported'));
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
