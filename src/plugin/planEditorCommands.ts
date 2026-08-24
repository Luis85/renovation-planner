import type { App, Command, TFile } from 'obsidian';
import { isErr } from '../core/result/Result';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { PlanId } from '../domain/plan/PlanId';
import type { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { backgroundKindFor } from '../domain/plan/PlanBackgroundRef';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { PlanBackgroundSuggestModal } from '../presentation/modals/PlanBackgroundSuggestModal';
import { notify } from '../presentation/notices/notify';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../presentation/views/PlanEditorView';
import { tr } from '../presentation/i18n/strings';
import type { CompositionRoot } from './composition-root';

/**
 * The Plan Editor's two commands, kept out of the plugin shell so that file stays what it
 * says it is: registration and nothing else. What is here is the BEHAVIOUR behind two
 * `addCommand` calls; the calls themselves still happen in `onload`.
 */
export interface PlanEditorCommandHost {
	readonly app: App;
	readonly root: CompositionRoot;
	addCommand(command: Command): unknown;
}

/**
 * Which Plan a note IS, if it is one.
 *
 * Through the Project Index (§47) rather than by reading the note's frontmatter: the index
 * is the single answer to "where is entity X", and asking the vault again here would be a
 * second, slower one that can disagree with it. A linear scan because the index is keyed
 * id → path and this is the one place the question is asked in reverse — a reverse map
 * maintained for a single command palette check would be state to keep correct for no gain.
 */
function planIdForPath(index: ProjectIndex, path: string): PlanId | null {
	for (const entry of index.entries()) {
		if (entry.type === 'renovation-plan' && entry.path === path) return entry.id as PlanId;
	}
	return null;
}

/**
 * The active Plan note, or `null`. Both halves have to hold: a file has to be open, and it
 * has to be one of ours.
 */
function activePlanId(host: PlanEditorCommandHost): PlanId | null {
	const index = host.root.persistence?.index;
	const file = host.app.workspace.getActiveFile();
	if (index === undefined || file === null) return null;
	return planIdForPath(index, file.path);
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
async function applyBackground(host: PlanEditorCommandHost, planId: PlanId, file: TFile): Promise<void> {
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

export function registerPlanEditorCommands(host: PlanEditorCommandHost): void {
	// `checkCallback`, not `callback`: a command that is only meaningful with a Plan note
	// open should not APPEAR in the palette otherwise. Obsidian calls it twice — once to
	// ask, once to do — and the `checking` early return is that contract.
	host.addCommand({
		id: 'open-plan-editor',
		name: tr('command.open-plan-editor'),
		checkCallback: (checking: boolean) => {
			const planId = activePlanId(host);
			if (planId === null) return false;
			if (!checking) void revealPlanEditor(host.app.workspace, PLAN_EDITOR_VIEW, planId);
			return true;
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
