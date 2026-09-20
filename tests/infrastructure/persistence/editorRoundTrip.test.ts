import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { expectFound, expectOk, RecordingEventBus } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { createCurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { stackFoundation } from '../../helpers/repositoryStack';
import { ObsidianZoneRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianPlanRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';

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

	it('round-trips a rectangle created through CreateZoneCommand as a polygon under one id', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Willow House' }), 'absent'));
		expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground floor' }), 'absent'));

		const command = new CreateZoneCommand(stack.zones, stack.plans, new RecordingEventBus());
		const geometry = expectOk(
			createPolygon([
				{ x: 1000, y: 2000 },
				{ x: 5200, y: 2000 },
				{ x: 5200, y: 5800 },
				{ x: 1000, y: 5800 },
			]),
		);
		const created = expectOk(
			await command.execute({ planId, name: 'Kitchen', zoneType: 'Room', geometry }),
		).zone;

		const read = expectFound(await stack.zones.getById(created.entity.id));
		expect(read.entity.id).toBe(created.entity.id);
		expect(read.entity.name).toBe('Kitchen');
		expect(read.entity.zoneType).toBe('Room');
		expect(read.entity.geometry.points).toEqual([
			{ x: 1000, y: 2000 },
			{ x: 5200, y: 2000 },
			{ x: 5200, y: 5800 },
			{ x: 1000, y: 5800 },
		]);
		expect(expectOk(read.entity.area())).toBe(15_960_000);

		const path = stack.index.getPath(created.entity.id as never);
		if (path === undefined) throw new Error('zone note not indexed');
		const file = stack.vault.getAbstractFileByPath(path) as never;
		const frontmatter = parseFrontmatter(await stack.vault.read(file)).frontmatter;
		// `zoneMapper.zoneToPersistence` writes `toKebab(zone.zoneType)`, matching the
		// existing `makeZone` case above rather than a second derivation of the spelling.
		expect(frontmatter['zone-type']).toBe('room');
		expect(Object.keys(frontmatter)).not.toContain('width');
		expect(Object.keys(frontmatter)).not.toContain('depth');
		expect(Object.keys(frontmatter)).not.toContain('room');
	});

	/**
	 * **Reload, at the layer that owns it** (design spec §8): the same room, read back by a
	 * repository stack that has never seen it written.
	 *
	 * The case above proves the round trip through the stack that did the writing, which
	 * cannot tell a note on disk from a cache. This one throws that stack's whole memory away
	 * — a fresh `stackFoundation` over the SAME `FakeVault` bytes, so a fresh
	 * `ReconcilingProjectIndex`, a fresh `EchoWindow` and a fresh `PlanGeometryStore` — and
	 * rebuilds the index with the real scan the plugin runs at load. What comes back therefore
	 * came from the note and its sidecar and from nothing else.
	 *
	 * **A fresh `EchoWindow` is the part that matters and the part a `rebuildIndex()` on the
	 * original stack would not have given.** `frontmatterOf` falls back to "what this plugin
	 * last wrote here" while the metadata cache lags, so a read taken through the writing
	 * stack can be answered by this plugin's own memory of its own write — exactly the
	 * mechanism `FakeVault.pendingParse` exists to model. Reopening Obsidian has no such
	 * memory, and neither does this.
	 */
	it('reopening over the same vault bytes reads the room back whole: id, name, type, points and area', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Willow House' }), 'absent'));
		expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground floor' }), 'absent'));

		const command = new CreateZoneCommand(stack.zones, stack.plans, new RecordingEventBus());
		const geometry = expectOk(
			createPolygon([
				{ x: 1000, y: 2000 },
				{ x: 5200, y: 2000 },
				{ x: 5200, y: 5800 },
				{ x: 1000, y: 5800 },
			]),
		);
		const created = expectOk(
			await command.execute({ planId, name: 'Kitchen', zoneType: 'Room', geometry }),
		).zone;

		// The reopen: a second stack over the same bytes, with the scan the plugin runs at load.
		//
		// `catchUp()` first, because a reopened Obsidian has a fully parsed `MetadataCache` and
		// this fake deliberately models the parse LAG that follows a write. Without it the scan
		// asks a cache that has not reached the note yet and — with a fresh `EchoWindow` holding
		// no memory of our own write — finds none of ours, which is a true statement about the
		// milliseconds after a save and not about reopening a vault.
		stack.metadataCache.catchUp();
		const reopened = stackFoundation(
			{ vault: stack.vault, fileManager: stack.fileManager, metadataCache: stack.metadataCache },
			stack.projectFolder,
		);
		reopened.rebuildIndex();
		const zones = new ObsidianZoneRepository(reopened.deps, reopened.store);

		const read = expectFound(await zones.getById(created.entity.id));
		expect(read.entity.id).toBe(created.entity.id);
		expect(read.entity.name).toBe('Kitchen');
		expect(read.entity.zoneType).toBe('Room');
		expect(read.entity.planId).toBe(planId);
		expect(read.entity.geometry.points).toEqual([
			{ x: 1000, y: 2000 },
			{ x: 5200, y: 2000 },
			{ x: 5200, y: 5800 },
			{ x: 1000, y: 5800 },
		]);
		expect(expectOk(read.entity.area())).toBe(15_960_000);

		// And the plan it belongs to, since the editor reopens on a plan id rather than a zone.
		expect(expectFound(await new ObsidianPlanRepository(reopened.deps, reopened.store).getById(planId)).entity.name).toBe(
			'Ground floor',
		);
	});

	/**
	 * **BP-04's named test 10, "fresh repository reload", at the layer that owns it.** Every other
	 * BP-04 assertion reads back through `InMemoryZoneRepository`, which holds entity objects and
	 * serializes nothing, and `planEditorRig.ts` states in terms that its rig does not model the
	 * geometry-sidecar join — so until this case nothing had seen a TYPED corner reach the note
	 * and its sidecar and come back.
	 *
	 * Three properties of the outline editor's own write are what make it worth a case rather
	 * than a repeat of the `CreateZoneCommand` reopen above, and each is the thing the editor can
	 * produce that the create path cannot:
	 *
	 * - a **negative** coordinate, which `editor.area.coordinates-hint` promises is allowed;
	 * - a **sub-millimetre** sibling the user did not retype, which `outlineProposal` passes
	 *   through unrounded while the retyped corner rounds to whole millimetres;
	 * - a **bulge** the form never sends, retained by `preservePointCurves` at the command.
	 *
	 * The command is the real one the dialog dispatches (`MoveSpatialObjectCommand`, through
	 * `ReversibleMoveZoneCommand` in production) with a points-only polygon, exactly as
	 * `zoneOutlineAction.ts`'s `forward` carries. What is NOT modelled here is the dialog, the
	 * history adapter and the version guard: this case's subject is the FORMAT, and the doors are
	 * `zoneOutlineReach.e2e.test.ts`'s.
	 */
	it('reopening over the same vault bytes reads back a typed corner, its retained curve and its unrounded negative sibling', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		const zoneId = createZoneId();
		expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Willow House' }), 'absent'));
		expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground floor' }), 'absent'));
		const original = expectOk(
			createCurvedPolygon({
				points: [{ x: 1234.4, y: -765.4 }, { x: 4400, y: 0 }, { x: 4400, y: 3400 }, { x: 0, y: 3400 }],
				bulges: [0, 0.4, 0, 0],
			}),
		);
		expectOk(
			await stack.zones.save(makeZone({ id: zoneId, projectId, planId, name: 'Terrace', zoneType: 'Terrace', geometry: original }), 'absent'),
		);

		// The typed correction: corner 3 retyped to 4.5 m — an endpoint of the curved edge — with
		// every other corner passed through as loaded, and no bulges in the forward polygon.
		const typed = [original.points[0], original.points[1], { x: 4500, y: 3400 }, original.points[3]];
		expectOk(await new MoveSpatialObjectCommand(stack.zones, new RecordingEventBus()).execute({ zoneId, geometry: { points: typed } }));

		// The reopen, exactly as the case above: `catchUp()` for the parse lag this fake models,
		// then a second stack over the same bytes with the scan the plugin runs at load.
		stack.metadataCache.catchUp();
		const reopened = stackFoundation(
			{ vault: stack.vault, fileManager: stack.fileManager, metadataCache: stack.metadataCache },
			stack.projectFolder,
		);
		reopened.rebuildIndex();

		const read = expectFound(await new ObsidianZoneRepository(reopened.deps, reopened.store).getById(zoneId));
		expect(read.entity.geometry.points).toEqual(typed);
		expect(read.entity.geometry.bulges).toEqual([0, 0.4, 0, 0]);
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
