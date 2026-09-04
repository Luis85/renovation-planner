import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';

/**
 * WP0's round-trip instrument (design spec §2.5): a Project, a Plan and a Room-classified
 * Zone go entity → mapper → note + sidecar → mapper → entity through the REAL mappers and
 * repositories over the in-memory vault, and every field the first editor increment reads
 * comes back. The consolidation report cites this file; this file cites nothing.
 *
 * A user-authored body is written UNDER the frontmatter and asserted to survive a save,
 * because "the free-form body remains user-owned" is a rule the mappers cannot see.
 */

// Module scope rather than nested in the `describe` below: it captures nothing from its
// surrounding scope, and `unicorn/consistent-function-scoping` refuses a nested function
// that does not, since nesting it would recreate the same closure on every `describe` run.
async function seed() {
	const stack = createRepositoryStack();
	const projectId = createProjectId();
	const planId = createPlanId();
	const zoneId = createZoneId();
	expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Willow House' }), 'absent'));
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground floor' }), 'absent'));
	const geometry = expectOk(
		createPolygon([
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3600 },
			{ x: 0, y: 3600 },
		]),
	);
	expectOk(
		await stack.zones.save(
			makeZone({ id: zoneId, projectId, planId, name: 'Kitchen', zoneType: 'Room', geometry }),
			'absent',
		),
	);
	return { stack, projectId, planId, zoneId };
}

describe('editor round trip: Project, Plan and a Room-classified Zone', () => {
	it('reads back the project fields the context bar shows', async () => {
		const { stack, projectId } = await seed();
		const read = expectFound(await stack.projects.getById(projectId));
		expect(read.entity.id).toBe(projectId);
		expect(read.entity.name).toBe('Willow House');
		expect(read.entity.currency).toBe('EUR');
		expect(read.version.revision).toBe(1);
	});

	it('reads back the plan fields the floor summary shows', async () => {
		const { stack, planId, projectId } = await seed();
		const read = expectFound(await stack.plans.getById(planId));
		expect(read.entity.id).toBe(planId);
		expect(read.entity.projectId).toBe(projectId);
		expect(read.entity.name).toBe('Ground floor');
		expect(read.entity.background).toBeNull();
		expect(read.entity.calibration).toBeNull();
	});

	it('reads back the zone as one logical record: note fields plus sidecar geometry', async () => {
		const { stack, zoneId, planId, projectId } = await seed();
		const read = expectFound(await stack.zones.getById(zoneId));
		expect(read.entity.id).toBe(zoneId);
		expect(read.entity.planId).toBe(planId);
		expect(read.entity.projectId).toBe(projectId);
		expect(read.entity.name).toBe('Kitchen');
		expect(read.entity.zoneType).toBe('Room');
		expect(read.entity.status).toBe('Planned');
		expect(read.entity.geometry.points).toEqual([
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3600 },
			{ x: 0, y: 3600 },
		]);
		// Area is DERIVED, never stored: 4.2 m × 3.6 m in mm².
		expect(expectOk(read.entity.area())).toBe(15_120_000);
	});

	it('persists the zone note with the v1 keys the spec names, and nothing homeowner-facing', async () => {
		const { stack, zoneId } = await seed();
		const path = stack.index.getPath(zoneId as never);
		if (path === undefined) throw new Error('zone note not indexed');
		const file = stack.vault.getAbstractFileByPath(path) as never;
		const frontmatter = parseFrontmatter(await stack.vault.read(file)).frontmatter;
		expect(frontmatter['type']).toBe('renovation-zone');
		expect(frontmatter['schema-version']).toBe(1);
		expect(frontmatter['id']).toBe(zoneId);
		// `zoneMapper.zoneToPersistence` writes `toKebab(zone.zoneType)`, so the domain
		// value `'Room'` persists as `'room'` — measured against the real mapper rather
		// than assumed from the domain-level label.
		expect(frontmatter['zone-type']).toBe('room');
		expect(frontmatter['name']).toBe('Kitchen');
		expect(Object.keys(frontmatter)).not.toContain('kind');
		expect(Object.keys(frontmatter)).not.toContain('room');
	});

	it('keeps a user-authored body across a plugin save', async () => {
		const { stack, zoneId, projectId, planId } = await seed();
		const path = stack.index.getPath(zoneId as never);
		if (path === undefined) throw new Error('zone note not indexed');
		const file = stack.vault.getAbstractFileByPath(path) as never;
		const before = await stack.vault.read(file);
		await stack.vault.modify(file, `${before}\nThe kitchen faces north.\n`);

		const read = expectFound(await stack.zones.getById(zoneId));
		expectOk(
			await stack.zones.save(
				makeZone({ id: zoneId, projectId, planId, name: 'Kitchen (renamed)', zoneType: 'Room', geometry: read.entity.geometry }),
				read.version,
			),
		);
		const after = await stack.vault.read(file);
		expect(after).toContain('The kitchen faces north.');
		expect(parseFrontmatter(after).frontmatter['name']).toBe('Kitchen (renamed)');
	});
});
