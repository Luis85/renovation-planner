import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeProject as makeProjectEntity } from '../../../helpers/entities';
import { ensureFolder, undoEnsureFolder } from '../../../../src/infrastructure/obsidian/repositories/noteIo';

/**
 * The orphan folder a failed project insert used to leave behind, and the two rules that keep
 * its compensation narrower than the damage.
 *
 * `ObsidianProjectRepository`'s class header predicted this defect for two slices and named
 * design slice 16 — the project-creation form — as the trigger to close it, on the grounds
 * that a form is the first time a user reaches this path by typing a name and the first time
 * retrying after a failure is an ordinary thing to do. Review of that slice asked for exactly
 * the recorded trigger.
 *
 * The repository cases assert on the VAULT rather than only on the returned refusal: `save`
 * already answered `project.write-failed` before any of this existed (`errorPaths.test.ts` pins
 * that), so a case reading only the error is equally true of the defect and of the fix.
 *
 * They still name the CODE beside the vault, and design slice 19 is why: a refusal that returns
 * before anything is created satisfies every "the folder is gone" assertion trivially, so the
 * pair is what says the compensation ran rather than that it was never needed.
 */
describe('a failed project insert leaves no folder behind', () => {
	it('removes the project folder and the root it had to create for it', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity({ name: 'Collision' });
		stack.vault.failures.add(`create:${stack.projectFolder}/Collision/Collision.md`);

		// The CODE, exactly as the third case below already asserts it, and not merely "some
		// refusal": design slice 19 gave `save` a `project.folder-overlaps-library` arm that
		// returns BEFORE `ensureFolder`, so a stack whose library CONTAINS the project folder
		// satisfies both `toBeNull()`s trivially — nothing was ever created, the compensation
		// never ran, and this case stayed green over code it no longer reached.
		//
		// Measured rather than argued, and the value matters: mutating
		// `createRepositoryStack`'s default `libraryFolder` to `'Renovation/Library'` changes
		// NOTHING, because `Renovation/Collision` and `Renovation/Library` are siblings and
		// `foldersOverlap` tests containment at a segment boundary. `'Renovation'` is the
		// mutation that fires the guard, and with this line it takes the case red.
		const error = expectErr(await stack.projects.save(project, 'absent'));
		expect(error.code).toBe('project.write-failed');

		expect(stack.vault.getAbstractFileByPath(`${stack.projectFolder}/Collision`)).toBeNull();
		expect(stack.vault.getAbstractFileByPath(stack.projectFolder)).toBeNull();
	});

	/**
	 * The consequence the header actually named, and the reason the orphan was never merely
	 * untidy: `freshProjectFolder` collides on any abstract file at the base path, so a folder
	 * left behind pushes the RETRY onto `<name> <id>` — a different suffix each time, because
	 * `CreateProjectCommand` mints a new id per call. Two failures, two orphans, and the
	 * project in a third folder.
	 *
	 * The retry carries a fresh entity for that reason: reusing `project` would test a path no
	 * user takes and would hide the id-suffix behaviour this case exists for.
	 */
	it('lets a retry land in the plain folder rather than an id-suffixed one', async () => {
		const stack = createRepositoryStack();
		const failing = `create:${stack.projectFolder}/Collision/Collision.md`;
		stack.vault.failures.add(failing);
		expectErr(await stack.projects.save(makeProjectEntity({ name: 'Collision' }), 'absent'));
		stack.vault.failures.delete(failing);

		const retry = makeProjectEntity({ name: 'Collision' });
		expectOk(await stack.projects.save(retry, 'absent'));

		expect(stack.index.getPath(retry.id)).toBe(`${stack.projectFolder}/Collision/Collision.md`);
	});

	/**
	 * The root is shared, and this repository's queue is keyed per PROJECT — so a second insert
	 * that found the root already there and filled it is concurrent with the first one's
	 * failure. Obsidian's `trashFile` on a folder takes everything inside it, so without the
	 * emptiness rule the failing insert would delete the successful project beside it.
	 *
	 * Driven by seeding the sibling BETWEEN the two vault calls of the failing insert, which is
	 * what `ensureFolder`'s own `created` list makes possible to write directly: going through
	 * two concurrent `save` calls would leave the interleaving to promise scheduling, and a
	 * case whose coverage depends on that is a case that stops covering it silently.
	 */
	it('leaves a created folder alone once something else has filled it', async () => {
		const stack = createRepositoryStack();
		const created: string[] = [];
		await ensureFolder(stack.vault as never, 'Renovation/Alpha', created);
		expect(created).toEqual(['Renovation', 'Renovation/Alpha']);
		// A sibling insert's own folder, made after this call created the root it shares.
		await stack.vault.createFolder('Renovation/Beta');

		expect(await undoEnsureFolder(stack.vault as never, stack.fileManager as never, created)).toEqual([]);

		expect(stack.vault.getAbstractFileByPath('Renovation/Alpha')).toBeNull();
		expect(stack.vault.getAbstractFileByPath('Renovation/Beta')).not.toBeNull();
		expect(stack.vault.getAbstractFileByPath('Renovation')).not.toBeNull();
	});

	/**
	 * A compensation that itself refuses is REPORTED rather than swallowed —
	 * `ObsidianPlanRepository`'s sidecar compensation has carried the same log line since slice
	 * 5 — and the refusal the caller gets is still the write's own, never the rollback's: the
	 * user asked to create a project, and `project.write-failed` is what happened to that.
	 */
	it('logs a compensation that cannot remove what it created, and still reports the write', async () => {
		const stack = createRepositoryStack();
		stack.vault.failures.add(`create:${stack.projectFolder}/Collision/Collision.md`);
		stack.vault.failures.add(`delete:${stack.projectFolder}/Collision`);

		const error = expectErr(await stack.projects.save(makeProjectEntity({ name: 'Collision' }), 'absent'));

		expect(error.code).toBe('project.write-failed');
		expect(stack.logged.filter((line) => line.event === 'project.insert-compensation-failed')).toHaveLength(1);
		// One line, not two: the folder that refused is still the root's child, so the emptiness
		// rule ends the walk on the next iteration and the root survives untouched.
		expect(stack.vault.getAbstractFileByPath(stack.projectFolder)).not.toBeNull();
	});

	/**
	 * The other two states a created path can be in by the time the compensation reaches it,
	 * and they behave DIFFERENTLY — which is worth a case rather than a sentence, because the
	 * first draft of `undoEnsureFolder`'s docblock collapsed them into one and described both
	 * as skipped.
	 *
	 * A path that is GONE skips to the parent: something else removed it, so the parent may now
	 * be empty and genuinely ours. A path where a FILE now sits stops the walk, for the same
	 * reason a non-empty folder does — it is not ours to trash, and its parent is holding it.
	 */
	it('skips a created folder that is already gone, and walks on to its parent', async () => {
		const stack = createRepositoryStack();
		const created: string[] = [];
		await ensureFolder(stack.vault as never, 'Renovation/Alpha', created);
		await stack.fileManager.trashFile(stack.vault.getAbstractFileByPath('Renovation/Alpha') as never);

		expect(await undoEnsureFolder(stack.vault as never, stack.fileManager as never, created)).toEqual([]);

		expect(stack.vault.getAbstractFileByPath('Renovation')).toBeNull();
	});

	it('stops at a created path a FILE now occupies, leaving the parent holding it', async () => {
		const stack = createRepositoryStack();
		const created: string[] = [];
		await ensureFolder(stack.vault as never, 'Renovation/Alpha', created);
		await stack.fileManager.trashFile(stack.vault.getAbstractFileByPath('Renovation/Alpha') as never);
		// Same path, other namespace — what a user dragging a note into place produces.
		stack.vault.entries.set('Renovation/Alpha', 'not a folder');

		expect(await undoEnsureFolder(stack.vault as never, stack.fileManager as never, created)).toEqual([]);

		expect(stack.vault.entries.has('Renovation/Alpha')).toBe(true);
		expect(stack.vault.getAbstractFileByPath('Renovation')).not.toBeNull();
	});

	/**
	 * `ensureFolder` can throw having already made some of its segments, which is why `created`
	 * is an out parameter rather than a return value — a returned list is lost on exactly the
	 * path that needs it. Driven at the function, because no repository call can produce a
	 * mid-walk failure through the vault fake's injected-failure keys alone.
	 */
	it('records the segments made before a mid-walk failure', async () => {
		const stack = createRepositoryStack();
		const created: string[] = [];
		stack.vault.failures.add('createFolder:Renovation/Alpha/Plans');

		await expect(ensureFolder(stack.vault as never, 'Renovation/Alpha/Plans', created)).rejects.toThrow(
			'Injected failure: createFolder Renovation/Alpha/Plans',
		);

		expect(created).toEqual(['Renovation', 'Renovation/Alpha']);
		expect(await undoEnsureFolder(stack.vault as never, stack.fileManager as never, created)).toEqual([]);
		expect(stack.vault.getAbstractFileByPath('Renovation')).toBeNull();
	});
});

/**
 * §83's first door, and it sits one line ABOVE the compensation this file is otherwise about:
 * a refusal that runs before `ensureFolder` has nothing to compensate, because nothing was
 * created. The two cases are a pair on purpose — the refusal alone is equally true of a build
 * that refuses every insert, so the sibling case is what says the guard is about the OVERLAP
 * and not about the library folder being configured at all.
 *
 * Asserted on the VAULT as well as on the code, for the same reason the cases above are: the
 * whole claim is "creates nothing", and a case reading only the returned error passes against
 * a guard placed after `ensureFolder`.
 */
describe('a project folder that would overlap the library', () => {
	it('is refused, and creates neither the folder nor the root it would have needed', async () => {
		const stack = createRepositoryStack('Renovation', 'Renovation/Library');

		const refusal = expectErr(await stack.projects.save(makeProjectEntity({ name: 'Library' }), 'absent'));

		expect(refusal.code).toBe('project.folder-overlaps-library');
		expect(stack.vault.getAbstractFileByPath('Renovation/Library')).toBeNull();
		expect(stack.vault.getAbstractFileByPath('Renovation')).toBeNull();
	});

	it('leaves a sibling of the library alone', async () => {
		const stack = createRepositoryStack('Renovation', 'Renovation/Library');

		const project = makeProjectEntity({ name: 'Kitchen refit' });
		expectOk(await stack.projects.save(project, 'absent'));

		expect(stack.index.getPath(project.id)).toBe('Renovation/Kitchen refit/Kitchen refit.md');
	});
});
