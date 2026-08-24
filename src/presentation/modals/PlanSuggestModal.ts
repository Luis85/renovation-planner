import { FuzzySuggestModal, type App } from 'obsidian';
import type { ProjectIndexEntry } from '../../application/ports/ProjectIndex';
import { tr } from '../i18n/strings';

/**
 * Pick which Plan to open the editor for.
 *
 * This is what makes the Plan Editor reachable at all. `open-plan-editor` used to require
 * the ACTIVE FILE to be a plan note, which meant that in a vault with no plan notes the
 * command never appeared in the palette — and since nothing in the app could create a plan
 * note either, that was every vault. A picker has no such precondition: it is available
 * from anywhere, and a plan note being open is one fuzzy match away rather than a
 * requirement.
 *
 * The candidate list is passed IN, exactly as `PlanBackgroundSuggestModal` takes its files:
 * this class's whole job is the three methods Obsidian calls, and a modal that also decided
 * which index entries are plans would be a second answer to a question the Project Index
 * already owns.
 *
 * `FuzzySuggestModal` rather than a hand-built dialog, for the reason its sibling states:
 * it is the affordance Obsidian users already know, it is keyboard-first without any work
 * (§85), and slice 15's modal framework has nothing to add to a picker.
 */
export class PlanSuggestModal extends FuzzySuggestModal<ProjectIndexEntry> {
	constructor(
		app: App,
		private readonly plans: readonly ProjectIndexEntry[],
		private readonly choose: (plan: ProjectIndexEntry) => void,
	) {
		super(app);
		this.setPlaceholder(tr('command.open-plan-editor'));
	}

	getItems(): ProjectIndexEntry[] {
		return [...this.plans];
	}

	/**
	 * The note's full path, not a plan NAME, and the reason is what the index holds: an
	 * entry is id, type and path. Reading every plan note to render a picker row would put
	 * a vault-wide read behind opening a palette command, and the path is the more useful
	 * label anyway — two plans called "Ground floor" in different projects is the normal
	 * case, which is the same argument `PlanBackgroundSuggestModal` makes about filenames.
	 */
	getItemText(plan: ProjectIndexEntry): string {
		return plan.path;
	}

	onChooseItem(plan: ProjectIndexEntry): void {
		this.choose(plan);
	}
}
