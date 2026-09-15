import { expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectFound, expectOk } from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

it('keeps a room colour through rename, lock and a whole-document sidecar write', async () => {
	const stack = createRepositoryStack(), project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent')); expectOk(await stack.plans.save(plan, 'absent'));
	const zone = makeZone({ projectId: project.id, planId: plan.id, color: '#3a7bd5' });
	expectOk(await stack.zones.save(zone, 'absent'));
	const loaded = expectFound(await stack.zones.getById(zone.id));
	expect(loaded.entity.color).toBe('#3a7bd5');
	expectOk(await stack.zones.save(expectOk(loaded.entity.withName('Kitchen')).withLocked(true), loaded.version));
	expect(expectFound(await stack.zones.getById(zone.id)).entity.color).toBe('#3a7bd5');
	const sidecar = new ObsidianPlanGeometrySidecar(stack.store), read = expectOk(await sidecar.read(plan.id));
	expect(read.document.objects.find(object => object.id === zone.id)?.color).toBe('#3a7bd5');
	expectOk(await sidecar.write(plan.id, read.document, read.version));
	expect(expectFound(await stack.zones.getById(zone.id)).entity.color).toBe('#3a7bd5');
	expect(expectOk(await stack.store.read(plan.id)).dto.schemaVersion).toBe(15);
});
