import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectFound, expectOk } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { toSpatialRecordDto } from '../../../src/presentation/read-models/spatialRecords';
import { areaOutline } from '../../../src/presentation/editor/add/areaOutline';
import { toZoneDto } from '../../../src/presentation/read-models/PlanDto';

describe('Area compatibility across Markdown and geometry persistence', () => {
	it('stores Custom under the existing Zone identity and reloads it as an Area', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		const plan = makePlan({ projectId: project.id });
		expectOk(await stack.projects.save(project, 'absent'));
		expectOk(await stack.plans.save(plan, 'absent'));
		const geometry = expectOk(areaOutline([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }]));
		const command = new CreateZoneCommand(stack.zones, stack.plans, stack.events);
		const { zone } = expectOk(await command.execute({ planId: plan.id, name: 'Fläche 1', zoneType: 'Custom', geometry }));
		const notePath = stack.index.getPath(zone.entity.id);
		if (notePath === undefined) throw new Error('Created Zone must have an indexed note');
		const text = stack.vault.entries.get(notePath);
		if (text === undefined) throw new Error('Created Zone must have Markdown');
		const { frontmatter } = parseFrontmatter(text);
		expect(frontmatter).toMatchObject({ type: 'renovation-zone', id: zone.entity.id, 'zone-type': 'custom', name: 'Fläche 1' });
		expect(frontmatter).not.toHaveProperty('kind');
		expect(frontmatter).not.toHaveProperty('geometry');
		stack.rebuildIndex();
		const loaded = expectFound(await stack.zones.getById(zone.entity.id));
		expect(loaded.entity.geometry).toEqual(geometry);
		const zones = expectOk(await new FindZonesByPlan(stack.zones).execute({ planId: plan.id }));
		expect(zones.loaded).toHaveLength(1);
		expect(toSpatialRecordDto(toZoneDto(loaded.entity))).toMatchObject({ id: zone.entity.id, kind: 'area', areaMm2: 12_000_000 });
	});
});
