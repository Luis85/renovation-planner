import { FuzzySuggestModal, type App } from 'obsidian';
import type { ProjectIndexEntry } from '../../application/ports/ProjectIndex';
import { tr } from '../i18n/strings';

/**
 * Pick which Project the Renovation Project view should open INTO — design slice 21's
 * detail state, reached from the palette rather than from a row already on screen.
 *
 * The sibling of `PlanSuggestModal` in every respect, and deliberately not a generalisation
 * of it: what the two share is the three methods Obsidian calls, and a single modal
 * parameterised by an entity type would still need a placeholder key and a callback per
 * caller, which is the whole of what differs. The shared part — "every entry of this kind
 * the index holds" — is `plugin/indexEntries.ts`, where the CALLERS meet it.
 *
 * The candidate list is passed IN, exactly as both siblings take theirs: this class's job is
 * the three methods, and a modal that also decided which index entries are projects would be
 * a second answer to a question the Project Index already owns.
 */
export class ProjectSuggestModal extends FuzzySuggestModal<ProjectIndexEntry> {
	constructor(
		app: App,
		private readonly projects: readonly ProjectIndexEntry[],
		private readonly choose: (project: ProjectIndexEntry) => void,
	) {
		super(app);
		this.setPlaceholder(tr('command.open-project-detail'));
	}

	getItems(): ProjectIndexEntry[] {
		return [...this.projects];
	}

	/**
	 * The note's full path, not a project NAME, and the reason is what the index holds: an
	 * entry is id, type and path. Reading every project note to render a picker row would
	 * put a vault-wide read behind a palette command — and it is the same argument
	 * `PlanSuggestModal` makes, so the two rows read alike in the palette.
	 */
	getItemText(project: ProjectIndexEntry): string {
		return project.path;
	}

	onChooseItem(project: ProjectIndexEntry): void {
		this.choose(project);
	}
}
