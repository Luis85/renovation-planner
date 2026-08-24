import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import { tr } from '../i18n/strings';

/**
 * Pick the Vault file a Plan is drawn over (SDD §54).
 *
 * The file is one **already in the Vault** and nothing is copied: a user who wants a PDF
 * in their vault puts it there, and Obsidian's own import affordances handle getting it
 * in. Importing from outside the Vault is deliberately out of scope for every slice — it
 * needs file-system access this plugin does not otherwise take, and the Vault-file path
 * covers the flow the PRD states.
 *
 * The candidate list is passed IN rather than gathered here. This class's whole job is the
 * three methods Obsidian calls, and a modal that also decided what counts as a background
 * would be the second place that question is answered — the first being
 * `backgroundKindFor`.
 *
 * `FuzzySuggestModal` rather than a hand-built dialog: it is the affordance Obsidian users
 * already know, it is keyboard-first without any work (§85), and slice 15's modal
 * framework has nothing to add to a file picker.
 */
export class PlanBackgroundSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private readonly files: readonly TFile[],
		private readonly choose: (file: TFile) => void,
	) {
		super(app);
		this.setPlaceholder(tr('command.set-plan-background'));
	}

	getItems(): TFile[] {
		return [...this.files];
	}

	/** The full path, not the basename: two plans called `ground.pdf` are the normal case. */
	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.choose(file);
	}
}
