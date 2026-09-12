import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { withPlanNorth } from '../../../src/domain/plan/Plan';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

describe('plan north persistence', () => {
	it('writes v10 with a north key only when one is set, and reads it back', () => {
		const project = makeProject();
		const detail = makePlan({ projectId: project.id, north: 45, parent: { planId: makePlan({ projectId: project.id }).id, zoneId: 'zone-1' as never } });
		const raw = planToPersistence(detail, 1);
		expect(raw).toMatchObject({ 'schema-version': 10, north: 45 });
		expect(expectOk(planFromPersistence(raw, null)).north).toBe(45);
		expect(toPlanDto(detail).north).toBe(45);
		const plain = makePlan({ projectId: project.id });
		expect('north' in planToPersistence(plain, 1)).toBe(false);
		expect('north' in toPlanDto(plain)).toBe(false);
	});

	it('reads a hand-edited bearing outside the vocabulary as no north, rather than refusing the note', () => {
		const raw = { ...planToPersistence(makePlan({ projectId: makeProject().id, north: 45 }), 1), north: 400 };
		expect(expectOk(planFromPersistence(raw, null)).north).toBeUndefined();
	});

	it('round-trips through the Obsidian repository, and a v9 note still reads with no north', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const site = makePlan({ projectId: project.id, name: 'Site' });
		const house = makePlan({ projectId: project.id, name: 'House', north: 270, parent: { planId: site.id, zoneId: 'zone-1' as never } });
		expectOk(await stack.plans.save(site, 'absent'));
		expectOk(await stack.plans.save(house, 'absent'));
		expect(expectFound(await stack.plans.getById(house.id)).entity.north).toBe(270);
		expect(expectFound(await stack.plans.getById(site.id)).entity.north).toBeUndefined();
	});

	it('removes a persisted north from the note when the bearing is unset again, and hands back the version it left', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const saved = expectOk(await stack.plans.save(makePlan({ projectId: project.id, north: 90 }), 'absent'));
		const cleared = expectOk(await stack.plans.save(expectOk(withPlanNorth(saved.entity, undefined)), saved.version));
		const reread = expectFound(await stack.plans.getById(saved.entity.id));
		expect(reread.entity.north).toBeUndefined();
		expect(reread.version).toEqual(cleared.version);
		// A v1 note's schema strips an undeclared key on READ, so only the file itself shows a stale one.
		const path = stack.index.getPath(saved.entity.id);
		if (path === undefined) throw new Error('plan note not indexed');
		const note = parseFrontmatter(await stack.vault.read(stack.vault.getAbstractFileByPath(path) as never)).frontmatter;
		expect('north' in note).toBe(false);
	});
});
