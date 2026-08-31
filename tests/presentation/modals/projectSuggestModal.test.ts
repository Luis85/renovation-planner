/**
 * The project picker's three overrides — Obsidian owns the rendering and the fuzzy matching,
 * and a subclass supplies exactly these, so this file is the whole of the class's contract.
 *
 * A file of its own rather than a fifth `describe` in `tests/presentation/editor/units.test.ts`
 * next door, which is where the plan picker's identical contract is asserted: that file is
 * named for the editor's small pieces and this modal belongs to neither the editor nor a plan.
 * The two sets of cases are deliberately the same four, because the two classes make the same
 * four promises.
 */
import { describe, expect, it } from 'vitest';
import { ProjectSuggestModal } from '../../../src/presentation/modals/ProjectSuggestModal';
import type { ProjectIndexEntry } from '../../../src/application/ports/ProjectIndex';
import { t } from '../../../src/presentation/i18n/strings';

/**
 * `placeholder` is the OBSIDIAN MOCK's own member — it records what `setPlaceholder` was
 * given — and `ProjectSuggestModal extends FuzzySuggestModal` resolves against the REAL
 * `obsidian` package's types outside vitest, where the class declares only the setter. One
 * cast, named for what it is, rather than an `as never` at the call site.
 */
function placeholderOf(modal: ProjectSuggestModal): string {
	return (modal as unknown as { placeholder: string }).placeholder;
}

const projects: ProjectIndexEntry[] = [
	{ id: 'project-a' as never, type: 'renovation-project', path: 'Renovation/Kitchen refit/Project.md' },
	{ id: 'project-b' as never, type: 'renovation-project', path: 'Renovation/Loft/Project.md' },
];

describe('the project picker', () => {
	it('offers exactly the projects it was given, and not the array itself', () => {
		const picker = new ProjectSuggestModal({} as never, projects, () => undefined);

		expect(picker.getItems()).toEqual(projects);
		// A COPY: Obsidian holds this list while the picker is open, and a shared reference
		// would let a later index change rewrite what the user is looking at.
		expect(picker.getItems()).not.toBe(projects);
	});

	/** The index holds a path, not a name — labelling a row with anything else is a read. */
	it('labels a row with the note path the index holds', () => {
		const picker = new ProjectSuggestModal({} as never, projects, () => undefined);

		expect(picker.getItemText(projects[1])).toBe('Renovation/Loft/Project.md');
	});

	it('hands the chosen project to its caller and decides nothing itself', () => {
		const chosen: ProjectIndexEntry[] = [];
		const picker = new ProjectSuggestModal({} as never, projects, (one) => chosen.push(one));

		picker.onChooseItem(projects[0]);

		expect(chosen).toEqual([projects[0]]);
	});

	/**
	 * Its OWN command's name, not `open-project`'s — the two commands are the deviation this
	 * slice records, and a placeholder reading "Open renovation project" over a picker that
	 * goes INTO one is the first place that distinction would quietly collapse.
	 */
	it('names itself from the string table', () => {
		const picker = new ProjectSuggestModal({} as never, projects, () => undefined);

		expect(placeholderOf(picker)).toBe(t('en', 'command.open-project-detail'));
	});
});
