import { describe, expect, it } from 'vitest';
import { CreateProjectCommand } from '../../../../src/application/commands/project/CreateProject';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { expectErr, expectOk, injectedPersistenceError, RecordingEventBus } from '../../../helpers/domain';

describe('CreateProjectCommand', () => {
	it('creates, persists and publishes exactly one ProjectCreated', async () => {
		const projects = new InMemoryProjectRepository();
		const events = new RecordingEventBus();
		const result = await new CreateProjectCommand(projects, events).execute({ name: ' Kitchen ' });

		const { project } = expectOk(result);
		expect(project.entity.name).toBe('Kitchen');
		expect(project.version.revision).toBe(1);

		const found = await projects.getById(project.entity.id);
		expect(expectOk(found)?.entity.name).toBe('Kitchen');

		expect(events.published).toHaveLength(1);
		expect(events.published[0]).toEqual({
			type: 'ProjectCreated',
			payload: { projectId: project.entity.id },
		});
	});

	it('refuses an empty name without saving or publishing', async () => {
		const projects = new InMemoryProjectRepository();
		const events = new RecordingEventBus();
		const error = expectErr(await new CreateProjectCommand(projects, events).execute({ name: '  ' }));

		expect(error.code).toBe('project.empty-name');
		expect(events.published).toHaveLength(0);
		expect(expectOk(await projects.listAll()).loaded).toHaveLength(0);
	});

	it('refuses a status outside the vocabulary', async () => {
		const projects = new InMemoryProjectRepository();
		const events = new RecordingEventBus();
		const error = expectErr(
			await new CreateProjectCommand(projects, events).execute({ name: 'X', status: 'PAUSED' as never }),
		);
		expect(error.code).toBe('project.unknown-status');
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed save: same error, no event, nothing stored', async () => {
		const events = new RecordingEventBus();
		class FailingSave extends InMemoryProjectRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const projects = new FailingSave();
		const error = expectErr(
			await new CreateProjectCommand(projects, events).execute({ name: 'Kitchen' }),
		);

		expect(error).toEqual(injectedPersistenceError());
		expect(events.published).toHaveLength(0);
	});
});
