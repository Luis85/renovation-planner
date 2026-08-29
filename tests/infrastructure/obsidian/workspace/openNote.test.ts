/**
 * Opening a project's own note (Task 5's seam).
 *
 * The path comes from the Project Index, never from a convention: since ADR-0013 a
 * project's folder is wherever its `Project.md` currently sits, so the only honest lookup
 * is the one the index answers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { openProjectNote } from '../../../../src/infrastructure/obsidian/workspace/openNote';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack } from '../../../helpers/vault';
import { FakeWorkspace } from '../../../helpers/workspace';
import type { EntityId } from '../../../../src/core/identity/EntityId';

const PROJECT_ID = 'project-1' as EntityId<string>;

/**
 * Every cause `reportFault` was handed this case, which is how "reported ONCE" is asked as a
 * count rather than as a boolean.
 */
const faults: unknown[] = [];

beforeEach(() => {
	faults.length = 0;
});

/**
 * One builder rather than eight object literals, and it exists for the fake rule rather than
 * for brevity: `reportFault` is a REQUIRED member of what this function takes, and a case
 * that left it out would pass happily until something faulted and then fail with
 * `deps.reportFault is not a function` — a stand-in thinner than the real thing, which
 * `tests/` is not type-checked to catch.
 */
function depsFor(workspace: unknown, vault: unknown, index: InMemoryProjectIndex) {
	return {
		workspace: workspace as never,
		vault: vault as never,
		index,
		reportFault: (cause: unknown) => {
			faults.push(cause);
		},
	};
}

describe('opening a project note', () => {
	it('opens the file the index resolves the id to', async () => {
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();

		const outcome = await openProjectNote(
			depsFor(workspace, vault, index),
			PROJECT_ID,
		);

		expect(outcome).toBe('opened');
		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].opened).toHaveLength(1);
		expect(workspace.leaves[0].opened[0]?.path).toBe('Project.md');
	});

	it('reuses the tab the note is already open in rather than opening a second one', async () => {
		// A project row is a thing a user clicks repeatedly — to check a figure, to come back
		// after looking at something else. `getLeaf('tab')` unconditionally meant N clicks on one
		// row produced N identical tabs, which is the defect `revealView`'s own docblock names as
		// the one every hand-rolled activation grows: this module was the hand-rolled one.
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();
		const deps = depsFor(workspace, vault, index);

		expect(await openProjectNote(deps, PROJECT_ID)).toBe('opened');
		// The reveal arm answers `'opened'` too: the note IS in front of the user either way,
		// which is the question the caller is asking.
		expect(await openProjectNote(deps, PROJECT_ID)).toBe('opened');

		expect(workspace.leaves).toHaveLength(1);
		// Revealed rather than re-opened: the file is already in that leaf, and `openFile` on it
		// would rebuild a view the user may have scrolled — `revealCandidate`'s own rule.
		expect(workspace.leaves[0].opened).toHaveLength(1);
		expect(workspace.revealed).toEqual([workspace.leaves[0]]);
	});

	it('coalesces a double click into one tab rather than racing itself', async () => {
		// The sequential case above is not this one, and its `await` between the two calls is
		// exactly what hid this: reuse is read off the LEAF's view state, and Obsidian
		// establishes that inside `openFile`, whose promise is the only thing that says when.
		// Two clicks of an ordinary double click both reach the lookup before the first open
		// settles, both miss, and both call `getLeaf('tab')` — two identical tabs from one
		// gesture. Reported in review.
		//
		// It needed the fake to stop being FASTER than the real thing before it could be seen
		// at all: `FakeLeaf.openFile` used to name the file synchronously, so the second call
		// always found the first one's leaf and this case passed against the defect. Watched
		// failing with the honest fake and no coalescing — two leaves.
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();
		const deps = depsFor(workspace, vault, index);

		const outcomes = await Promise.all([
			openProjectNote(deps, PROJECT_ID),
			openProjectNote(deps, PROJECT_ID),
		]);

		// Both clicks are told the truth: the note IS in front of the user, once.
		expect(outcomes).toEqual(['opened', 'opened']);
		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].opened).toHaveLength(1);
	});

	/**
	 * The defect the coalescing itself created, reported one review round after it landed.
	 *
	 * Both clicks were handed the same promise, so when it REJECTED both callers saw the
	 * rejection and each reported it: two notices and two identical log lines for one
	 * operation. Sharing an operation has to mean sharing its failure too, which is why the
	 * map holds the HANDLED promise now and the fault door lives inside this module rather
	 * than at the caller that composes it.
	 *
	 * Watched failing against the previous shape: two `reportFault` calls, and the joining
	 * click rejecting rather than answering.
	 */
	it('reports a coalesced failure once, and answers both clicks', async () => {
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		// A workspace whose open FAULTS. `getLeavesOfType` answers none, which is the case this
		// is about: no tab is already showing the note, so the reuse path is skipped.
		const workspace = {
			getLeavesOfType: () => [],
			getLeaf: () => ({ openFile: () => Promise.reject(new Error('disk exploded')) }),
		};
		const deps = depsFor(workspace, vault, index);

		const outcomes = await Promise.all([
			openProjectNote(deps, PROJECT_ID),
			openProjectNote(deps, PROJECT_ID),
		]);

		expect(outcomes).toEqual(['failed', 'failed']);
		expect(faults).toHaveLength(1);
		expect((faults[0] as Error).message).toBe('disk exploded');
	});

	/**
	 * And the entry is released on the failing path too, which the `finally` is what buys: a
	 * click after a failed open has to reach the vault again rather than being answered
	 * `'failed'` forever from a promise the map never let go of.
	 */
	it('goes back to the vault after a failed open rather than answering from the map', async () => {
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		let failNext = true;
		const workspace = {
			getLeavesOfType: () => [],
			getLeaf: () => ({
				openFile: () => {
					if (!failNext) return Promise.resolve();
					failNext = false;
					return Promise.reject(new Error('disk exploded'));
				},
			}),
		};
		const deps = depsFor(workspace, vault, index);

		expect(await openProjectNote(deps, PROJECT_ID)).toBe('failed');
		expect(await openProjectNote(deps, PROJECT_ID)).toBe('opened');
		expect(faults).toHaveLength(1);
	});

	it('goes back to the leaf lookup once an open has settled', async () => {
		// The other half of the coalescing rule, and the one a map that never forgot would
		// break: the entry is released when the open settles, so a click a minute later takes
		// the ordinary reveal path rather than being answered from a stale promise.
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();
		const deps = depsFor(workspace, vault, index);

		await Promise.all([openProjectNote(deps, PROJECT_ID), openProjectNote(deps, PROJECT_ID)]);
		expect(await openProjectNote(deps, PROJECT_ID)).toBe('opened');

		expect(workspace.leaves).toHaveLength(1);
		// Revealed, which is what says the third click went through the lookup and not through
		// a promise the map had held on to.
		expect(workspace.revealed).toEqual([workspace.leaves[0]]);
	});

	it('opens a second note in its own tab rather than taking over the first', async () => {
		// The other half of the same rule, and the one a naive "reuse a markdown leaf" would
		// break: reuse is keyed on the FILE, so a different project is a different tab.
		const { vault } = createRepositoryStack();
		await vault.create('One.md', '---\nid: project-1\n---\n');
		await vault.create('Two.md', '---\nid: project-2\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'One.md' });
		index.upsert({ id: 'project-2' as EntityId<string>, type: 'renovation-project', path: 'Two.md' });
		const workspace = new FakeWorkspace();
		const deps = depsFor(workspace, vault, index);

		await openProjectNote(deps, PROJECT_ID);
		await openProjectNote(deps, 'project-2');

		expect(workspace.leaves).toHaveLength(2);
		expect(workspace.leaves[0].opened[0]?.path).toBe('One.md');
		expect(workspace.leaves[1].opened[0]?.path).toBe('Two.md');
	});

	it('does not mistake a markdown leaf that names no file for the note', async () => {
		// A leaf Obsidian has restored but not yet constructed a view for answers `{}` from
		// `getViewState()`, so "is this leaf showing my note" has to be a question about a
		// STRING and not about truthiness — `undefined === undefined` would otherwise make the
		// first fileless markdown leaf a match for every project in the vault.
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();
		const fileless = workspace.withOpen('markdown');

		await openProjectNote(depsFor(workspace, vault, index), PROJECT_ID);

		expect(fileless.opened).toHaveLength(0);
		expect(workspace.revealed).toHaveLength(0);
		expect(workspace.leaves).toHaveLength(2);
		expect(workspace.leaves[1].opened[0]?.path).toBe('Project.md');
	});

	/**
	 * The only way to hold an id the index does not resolve is a note deleted since the list
	 * was read — and this is the case that used to return SILENTLY, under a comment claiming
	 * "the list is re-read on the next hydrate anyway". There was no next hydrate: nothing
	 * publishes a deletion and `RenovationProjectStore.hydrate` has two callers, neither of
	 * them reachable from one. The answer is what lets `ViewRoot` clear the row that pointed
	 * here (`tests/presentation/views/viewRootOpenProject.test.ts` holds that half).
	 */
	it('answers missing, opening nothing, for an id the index does not resolve', async () => {
		const { vault } = createRepositoryStack();
		const index = new InMemoryProjectIndex();
		const workspace = new FakeWorkspace();

		const outcome = await openProjectNote(
			depsFor(workspace, vault, index),
			PROJECT_ID,
		);

		expect(outcome).toBe('missing');
		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * The index maps an id to a path Obsidian resolves as a FOLDER, not a note — a state the
	 * index itself should never produce for a project id, but the guard is what stops a
	 * `TFolder` from being handed to `openFile`, which expects a `TFile`.
	 */
	it('answers missing, opening nothing, for a path that resolves to a folder rather than a file', async () => {
		const { vault } = createRepositoryStack();
		await vault.createFolder('SomeFolder');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'SomeFolder' });
		const workspace = new FakeWorkspace();

		const outcome = await openProjectNote(
			depsFor(workspace, vault, index),
			PROJECT_ID,
		);

		// The same answer as an unresolved id, and deliberately so: both mean the row points at
		// nothing, which is the only distinction the caller can act on. A note deleted while the
		// index has not caught up yet takes THIS arm rather than the one above.
		expect(outcome).toBe('missing');
		expect(workspace.leaves).toHaveLength(0);
	});
});
