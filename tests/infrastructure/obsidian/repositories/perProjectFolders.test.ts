import { describe, expect, it } from 'vitest';
import {
	freshProjectFolder,
	joinFolder,
	plansFolderFor,
	projectFolderOf,
} from '../../../../src/infrastructure/obsidian/repositories/paths';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack } from '../../../helpers/vault';
import { makeProject as makeProjectEntity } from '../../../helpers/entities';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

describe('joinFolder', () => {
	it('joins a folder and a child with one separator', () => {
		expect(joinFolder('Renovation/Kitchen', 'Plans')).toBe('Renovation/Kitchen/Plans');
	});

	it('answers the child alone at the vault root, rather than a leading slash', () => {
		// A Project.md at the vault root derives the empty folder, and `/Plans` is a path
		// Obsidian refuses. This arm is why the join is a function rather than a template.
		expect(joinFolder('', 'Plans')).toBe('Plans');
		expect(plansFolderFor('')).toBe('Plans');
	});
});

describe('projectFolderOf', () => {
	it('answers the folder the project note sits in', () => {
		const index = new InMemoryProjectIndex();
		index.upsert({
			id: 'p1' as never,
			type: 'renovation-project',
			path: 'Renovation/Kitchen Refit/Project.md',
		});
		expect(projectFolderOf(index, 'p1' as never)).toBe('Renovation/Kitchen Refit');
	});

	it('answers undefined for a project the index does not hold', () => {
		expect(projectFolderOf(new InMemoryProjectIndex(), 'nope' as never)).toBeUndefined();
	});
});

describe('freshProjectFolder', () => {
	it('derives the folder from the project name, under the configured root', () => {
		const stack = createRepositoryStack('Renovation');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p1')).toBe(
			'Renovation/Kitchen Refit',
		);
	});

	it('appends the id when the plain name is taken', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set('Renovation/Kitchen Refit/Project.md', '');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p2')).toBe(
			'Renovation/Kitchen Refit p2',
		);
	});
});

describe('a project owns its folder', () => {
	// The note's own FILENAME is unchanged by this task — `freshNotePath` still derives it
	// from the project's name via `fileNameFor` (filename is never identity, §83), exactly
	// as it did before ADR-0013. Only the FOLDER it is created in moves, so each project's
	// note lands at `<folder>/<fileNameFor(name)>.md`, not literally `Project.md`.
	it('creates each project in its own folder under the configured root', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });

		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		expect(stack.index.getPath('p1' as never)).toBe('Renovation/Kitchen Refit/Kitchen Refit.md');
		expect(stack.index.getPath('p2' as never)).toBe('Renovation/Bathroom/Bathroom.md');
	});

	it('takes the configured root, so changing the setting moves where a new project goes', async () => {
		const stack = createRepositoryStack('Somewhere Else');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });

		await stack.projects.save(kitchen, 'absent');

		expect(stack.index.getPath('p1' as never)).toBe('Somewhere Else/Kitchen Refit/Kitchen Refit.md');
	});
});
