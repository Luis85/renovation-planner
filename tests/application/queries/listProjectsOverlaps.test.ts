/**
 * `ListProjects` answers WHICH projects currently overlap the library folder (§83, slice 19).
 *
 * §83 names three sites where a library folder and a project folder must not be equal or
 * contain one another. Two have a door and refuse there — creating a project, moving the
 * library. The THIRD has none: ADR-0013 derives a project's folder from where its
 * `Project.md` sits, so a user moves a project by dragging a folder in Obsidian's file
 * explorer and there is no command to refuse. So the affected project's own row says so.
 *
 * Every case here re-reads through `execute()`, because the whole design rests on the
 * condition being DERIVED PER READ: nothing is recorded, so nothing has to be retracted,
 * counted, capped or expired. The third case is the one that proves it — a folder moved
 * clear is simply absent from the next answer.
 *
 * **Per read is not the same as prompt, and these cases cannot show the difference.** They
 * move a folder by moving its INDEX entry, which is exactly what a real drag in Obsidian's
 * file explorer does NOT do: the vault listeners filter to `TFile`, so the index is never
 * told and only learns at its next rebuild. `IndexLibraryOverlaps`'s docblock carries the
 * mechanism and where closing it belongs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ListProjects } from '../../../src/application/queries/ListProjects';
import { IndexLibraryOverlaps } from '../../../src/infrastructure/obsidian/repositories/IndexLibraryOverlaps';
import { IndexProjectListFacts } from '../../../src/infrastructure/obsidian/repositories/IndexProjectListFacts';
import { InMemoryProjectIndex } from '../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { expectOk } from '../../helpers/domain';
import { makeProject } from '../../helpers/entities';

const LIBRARY = 'Renovation/Library';

/**
 * The REAL index, with the one spelling these cases need. A hand-written double would be a
 * fake thinner than the thing `projectFolderOf` actually reads through; subclassing keeps
 * `getPath`'s own behaviour — including that an unindexed project answers `undefined`.
 */
class TestIndex extends InMemoryProjectIndex {
	setPath(id: ProjectId, path: string): void {
		this.upsert({ id, type: 'renovation-project', path });
	}
}

describe('ListProjects and the library overlap', () => {
	let index: TestIndex;
	let projects: InMemoryProjectRepository;
	let kitchen: ReturnType<typeof makeProject>;
	let query: ListProjects;

	beforeEach(async () => {
		index = new TestIndex();
		projects = new InMemoryProjectRepository();
		kitchen = makeProject({ name: 'Kitchen refit' });
		await projects.save(kitchen, 'absent');
		// Where the user left it: a sibling of the library, which is what §83 asks for.
		index.setPath(kitchen.id, 'Renovation/Kitchen refit/Project.md');
		// The REAL facts adapter over the SAME index these cases move folders in, so this file
		// describes one world rather than two. Its vault answers nothing, which is the truth
		// here: the index holds paths this suite invented and no file sits at any of them.
		query = new ListProjects(
			projects,
			new IndexLibraryOverlaps(index, LIBRARY),
			new IndexProjectListFacts(index, { getAbstractFileByPath: () => null }),
		);
	});

	it('reports nothing when every project is a sibling of the library', async () => {
		expect(expectOk(await query.execute()).overlapping).toEqual([]);
	});

	it('reports a project whose derived folder contains the library', async () => {
		// The drag a user performs in Obsidian's file explorer, which no command can refuse.
		index.setPath(kitchen.id, 'Renovation/Project.md');

		expect(expectOk(await query.execute()).overlapping).toEqual([kitchen.id]);
	});

	/**
	 * The condition is DERIVED, so fixing it is simply absent from the next read — there is
	 * nothing recorded to retract, which is the property the whole design rests on. Both
	 * assertions go through a fresh `execute()`; asserting twice on one cached result would
	 * be true of a design that records and never retracts.
	 */
	it('stops reporting once the folder is moved clear', async () => {
		index.setPath(kitchen.id, 'Renovation/Project.md');
		expect(expectOk(await query.execute()).overlapping).toEqual([kitchen.id]);

		index.setPath(kitchen.id, 'Elsewhere/Kitchen refit/Project.md');

		expect(expectOk(await query.execute()).overlapping).toEqual([]);
	});

	/**
	 * `projectFolderOf` answers `undefined` when the index cannot place the project, and that
	 * is a REFUSAL rather than a prompt to fall back — an unplaceable project has no folder to
	 * compare, so claiming an overlap would mark a row over a path nobody knows. Reached by
	 * removing the entry, which is what an index that never saw the note looks like.
	 */
	it('reports nothing for a project the index cannot place', async () => {
		index.remove(kitchen.id);

		expect(expectOk(await query.execute()).overlapping).toEqual([]);
	});

	/**
	 * The one query, not two. A second query answering the markers would need a policy for
	 * "the list loaded but the markers did not", and an advisory marker is exactly the thing
	 * whose failure mode nobody would think about again — so the two facts travel or fail
	 * together, which is what this asserts.
	 */
	it('carries the markers beside the list rather than in a second answer', async () => {
		index.setPath(kitchen.id, 'Renovation/Project.md');

		const listed = expectOk(await query.execute());

		expect(listed.projects.map((project) => project.id)).toEqual([kitchen.id]);
		expect(listed.unreadable).toBe(0);
		expect(listed.overlapping).toEqual([kitchen.id]);
	});
});
