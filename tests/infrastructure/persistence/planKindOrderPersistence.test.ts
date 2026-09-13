import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { createRepositoryStack } from '../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

describe('plan kind and order persistence (ADR-0029)', () => {
	it('writes v11 with kind and order only when they are not the defaults', () => {
		const project = makeProject();
		const site = makePlan({ projectId: project.id, name: 'Site', kind: 'site', order: 2 });
		expect(planToPersistence(site, 1)).toMatchObject({ 'schema-version': 11, kind: 'site', order: 2 });
		const plain = planToPersistence(makePlan({ projectId: project.id }), 1);
		expect(plain['schema-version']).toBe(1);
		expect('kind' in plain).toBe(false);
		expect('order' in plain).toBe(false);
		const ordered = planToPersistence(makePlan({ projectId: project.id, order: 1 }), 1);
		expect(ordered).toMatchObject({ 'schema-version': 11, order: 1 });
		expect('kind' in ordered).toBe(false);
	});

	it('reads a note without the keys as floor / 0, and refuses a wrong value rather than guessing', () => {
		const raw = planToPersistence(makePlan({ projectId: makeProject().id }), 1);
		expect(expectOk(planFromPersistence(raw, null))).toMatchObject({ kind: 'floor', order: 0 });
		expect(expectOk(planFromPersistence({ ...raw, 'schema-version': 11, kind: 'room', order: 4 }, null))).toMatchObject({ kind: 'room', order: 4 });
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 11, kind: 'attic' }, null)).code).toBe('plan.unknown-kind');
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 11, order: -1 }, null)).code).toBe('plan.invalid-order');
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 11, order: 'first' }, null)).code).toBe('plan.frontmatter-invalid');
	});

	it('round-trips through the Obsidian repository', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const room = makePlan({ projectId: project.id, name: 'Kitchen', kind: 'room', order: 7 });
		expectOk(await stack.plans.save(room, 'absent'));
		expect(expectFound(await stack.plans.getById(room.id)).entity).toMatchObject({ kind: 'room', order: 7 });
	});
});
