import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { roomDimensions, dimensionProposal } from '../../../src/presentation/editor/resize/roomDimensions';
import { toSpatialRecordDto } from '../../../src/presentation/read-models/spatialRecords';
import { toZoneDto } from '../../../src/presentation/read-models/PlanDto';

describe('resized Room Markdown and sidecar compatibility', () => {
	it('reloads the same Room identity and new points, with conditional Undo/Redo and no schema additions', async () => {
		const stack = createRepositoryStack(); const project = makeProject(); const plan = makePlan({ projectId: project.id });
		expectOk(await stack.projects.save(project, 'absent')); expectOk(await stack.plans.save(plan, 'absent'));
		const geometry = { points: [{ x: -1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 3500 }, { x: -1000, y: 3500 }] };
		const { zone } = expectOk(await new CreateZoneCommand(stack.zones, stack.plans, stack.events).execute({ planId: plan.id, name: 'Resize test', zoneType: 'Room', geometry }));
		const polygon = expectDefined(dimensionProposal(geometry.points, expectDefined(roomDimensions(geometry.points), 'rectangle'), { width: '5.2', depth: '2' }).polygon, 'resized polygon');
		const move = new MoveSpatialObjectCommand(stack.zones, stack.events);
		const command = new ReversibleMoveZoneCommand({ execute: input => move.execute({ ...input, expected: input.expected ?? zone.version }) }, new SessionWriteLedger(), zone.entity.id, polygon, geometry);
		expectOk(await command.execute()); stack.rebuildIndex();
		const loaded = expectFound(await stack.zones.getById(zone.entity.id));
		expect(loaded.entity.geometry).toEqual(polygon);
		expect(toSpatialRecordDto(toZoneDto(loaded.entity))).toMatchObject({ id: zone.entity.id, name: 'Resize test', kind: 'room', areaMm2: 10_400_000 });
		const path = expectDefined(stack.index.getPath(zone.entity.id), 'note path');
		const note = expectDefined(stack.vault.entries.get(path), 'note');
		const { frontmatter } = parseFrontmatter(note);
		expect(frontmatter).toMatchObject({ id: zone.entity.id, 'zone-type': 'room' });
		for (const key of ['width', 'depth', 'area', 'kind', 'geometry']) expect(frontmatter).not.toHaveProperty(key);
		expectOk(await command.undo()); expect(expectFound(await stack.zones.getById(zone.entity.id)).entity.geometry).toEqual(geometry);
		expectOk(await command.execute()); expect(expectFound(await stack.zones.getById(zone.entity.id)).entity.geometry).toEqual(polygon);
		expect(expectOk(await stack.zones.listByPlan(plan.id)).loaded).toHaveLength(1);
	});
});
