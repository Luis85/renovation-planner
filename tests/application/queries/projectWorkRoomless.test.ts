import { expect, it } from 'vitest';
import { createRepositoryStack } from '../../helpers/vault';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { readProjectWork } from '../../../src/application/queries/schedule/ProjectWork';

it('lists a Work item with no room with an empty room list rather than an unnamed room', async () => {
	const stack = createRepositoryStack(), project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const plan = makePlan({ projectId: project.id, renovation: { subjects: [], decisions: [], work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }] } });
	expectOk(await stack.plans.save(plan, 'absent'));
	const read = expectOk(await readProjectWork({ projects: stack.projects, plans: stack.plans, zones: stack.zones }, project.id));
	expect(read.rows.map(row => row.rooms)).toEqual([[]]);
});

it('adds no room for an outcome whose subject has none', async () => {
	const stack = createRepositoryStack(), project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const subject = { id: 'detail-wall', targetId: 'wall-a', kind: 'wall' as const, existing: null, planned: { change: 'add' as const, description: 'New wall' } };
	const plan = makePlan({ projectId: project.id, renovation: { subjects: [subject], decisions: [], work: [{ id: 'work-build', targetId: 'wall-a', title: 'Build', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-wall'], dependencies: [] }] } });
	expectOk(await stack.plans.save(plan, 'absent'));
	const read = expectOk(await readProjectWork({ projects: stack.projects, plans: stack.plans, zones: stack.zones }, project.id));
	expect(read.rows.map(row => row.rooms)).toEqual([[]]);
});
