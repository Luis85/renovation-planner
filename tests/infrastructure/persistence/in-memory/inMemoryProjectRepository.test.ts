import { describe, expect, it } from 'vitest';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { projectRepositoryContract } from '../../../contracts/project-repository.contract';
import { makeProject } from '../../../helpers/entities';

// The contract runs against whatever fixture is handed in; slice 4 replays it against
// the Obsidian-backed repository with a hand-edit `touch` instead of poke().
projectRepositoryContract(() => {
	const repository = new InMemoryProjectRepository();
	return {
		repository,
		makeProject: (name = 'Kitchen renovation') => makeProject({ name }),
		touch: (id) => repository.poke(id),
	};
});

describe('InMemoryProjectRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryProjectRepository();
		expect(() => repository.poke(makeProject().id)).not.toThrow();
	});
});
