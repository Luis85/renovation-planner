import { describe, expect, it } from 'vitest';
import type { ProjectRepository } from '../../src/application/ports/ProjectRepository';
import type { EntityVersion, ObservationToken } from '../../src/application/ports/versioning';
import type { Project } from '../../src/domain/project/Project';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../helpers/domain';
import { assertSaveUpsertsById } from './upsert';

/**
 * The shared ProjectRepository contract (SDD §72). Slice 3 runs it against the
 * in-memory implementation; slice 4 imports THIS FILE unmodified and runs it against
 * the Obsidian-backed one. `touch` simulates a change to the stored bytes that no
 * plugin write made — a hand edit or a sync — WITHOUT bumping the revision; that is
 * exactly the case the `observed` half of EntityVersion exists to catch.
 */
export interface ProjectFixture {
	readonly repository: ProjectRepository;
	makeProject(name?: string): Project;
	touch(id: ProjectId): void;
}

function fabricatedVersion(observed: ObservationToken): EntityVersion {
	return { revision: 99, observed };
}

export function projectRepositoryContract(make: () => ProjectFixture): void {
	describe('ProjectRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const { repository, makeProject } = make();
			const found = await repository.getById(makeProject().id);
			expect(found).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			const saved = await repository.save(project, 'absent');
			const written = expectOk(saved);
			expect(written.version.revision).toBe(1);

			const found = await repository.getById(project.id);
			expect(expectOk(found)?.entity.id).toBe(project.id);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			// Slice 8's undo-of-delete restores by writing the captured snapshot back
			// under its original ID — insert-only semantics would not be an undo.
			const { repository, makeProject } = make();
			const original = makeProject('Before');
			const written = await assertSaveUpsertsById({
				repository,
				entity: original,
				read: async () => expectOk(await repository.getById(original.id))?.entity ?? null,
				replacementName: 'After',
			});
			expect(written.version.revision).toBe(2);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			expectOk(await repository.save(project, 'absent'));
			const error = expectErr(await repository.save(project, 'absent'));
			expect(error.code).toBe('project.revision-conflict');
		});

		it('save refuses a stale revision', async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			const written = expectOk(await repository.save(project, 'absent'));
			const stale = fabricatedVersion(written.version.observed);
			const error = expectErr(await repository.save(project, stale));
			expect(error.code).toBe('project.revision-conflict');
		});

		it('save refuses after an external modification', async () => {
			const { repository, touch, makeProject } = make();
			const project = makeProject();
			const written = expectOk(await repository.save(project, 'absent'));
			touch(project.id);
			// Same revision as what this caller read — only the token moved.
			const error = expectErr(
				await repository.save(project, { revision: written.version.revision, observed: written.version.observed }),
			);
			expect(error.code).toBe('project.external-modification');
		});

		it('delete removes conditionally and answers ok(null) afterwards', async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			const written = expectOk(await repository.save(project, 'absent'));
			await repository.delete(project.id, written.version);
			expect(await repository.getById(project.id)).toEqual({ ok: true, value: null });
		});

		it('delete refuses a stale expectation', async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			const written = expectOk(await repository.save(project, 'absent'));
			const error = expectErr(
				await repository.delete(project.id, fabricatedVersion(written.version.observed)),
			);
			expect(error.code).toBe('project.revision-conflict');
			expect(expectOk(await repository.getById(project.id))).not.toBeNull();
		});

		it('delete refuses an id that was never there', async () => {
			const { repository, makeProject } = make();
			const project = makeProject();
			const written = expectOk(await repository.save(project, 'absent'));
			const other = makeProject();
			const error = expectErr(await repository.delete(other.id, written.version));
			expect(error.code).toBe('project.revision-conflict');
		});

		it('listAll returns every stored project and refuses none', async () => {
			const { repository, makeProject } = make();
			const a = makeProject('A');
			const b = makeProject('B');
			expectOk(await repository.save(a, 'absent'));
			expectOk(await repository.save(b, 'absent'));
			const all = expectOk(await repository.listAll());
			expect(all.loaded.map((p) => p.entity.id).toSorted()).toEqual([a.id, b.id].toSorted());
			// Both implementations must agree that a fully readable vault refuses nothing. A
			// non-zero count is only reachable where a note is text, so it is asserted on the
			// Obsidian implementation alone rather than here.
			expect(all.refused).toBe(0);
		});
	});
}
