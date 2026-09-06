import { describe, expect, it, vi } from 'vitest';
import { referencePlanServices, type ConfigureReferenceInput } from '../../../../src/application/commands/plan/ConfigurePlanReference';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ObsidianPlanRepository } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { createRepositoryStack, parseFrontmatter } from '../../../helpers/vault';
import { stackFoundation } from '../../../helpers/repositoryStack';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { err } from '../../../../src/core/result/Result';

const input: ConfigureReferenceInput = {
	background: { path: 'scan.pdf', kind: 'pdf', page: 2, appearance: {
		crop: { x: 20, y: 40, width: 800, height: 600 }, rotation: 90, opacity: 0.6, visible: true, locked: true,
	} }, measurement: { pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 100 }, knownDistance: 200 },
};
async function setup() {
	const stack = createRepositoryStack(), project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent')); expectOk(await stack.plans.save(plan, 'absent'));
	const zone = makeZone({ projectId: project.id, planId: plan.id }); expectOk(await stack.zones.save(zone, 'absent'));
	const geometry = new ObsidianPlanGeometrySidecar(stack.store), files = { fileExists: vi.fn<() => boolean>(() => true) };
	const services = referencePlanServices(stack.plans, geometry, stack.events, files);
	const baseline = expectOk(await services.read(plan.id));
	const command = services.command(baseline, input);
	const note = expectDefined(stack.index.getPath(plan.id), 'note'), sidecar = expectDefined(stack.index.getGeometrySidecarPath(plan.id), 'sidecar');
	return { stack, plan, zone, geometry, services, baseline, command, note, sidecar, files };
}
describe('reference configuration through real Markdown and sidecar repositories', () => {
	it('commits one coherent configuration, publishes in both directions, and reloads through a fresh stack', async () => {
		const r = await setup(), publish = vi.spyOn(r.stack.events, 'publish');
		const beforeFiles = [...r.stack.vault.entries.keys()];
		expectOk(await r.command.execute());
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toEqual(input.background);
		expect(expectFound(await r.stack.zones.getById(r.zone.id)).entity.geometry.points[0]?.x).toBe(expectDefined(r.zone.geometry.points[0], 'point').x * 2);
		const changed = expectOk(await r.geometry.read(r.plan.id));
		expect(changed.document.calibration).toEqual({ pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 200 }, knownDistance: 200, pixelsPerWorldUnit: 0.5 });
		expect(parseFrontmatter(expectDefined(r.stack.vault.entries.get(r.note), 'note')).frontmatter['schema-version']).toBe(2);
		expect([...r.stack.vault.entries.keys()]).toEqual(beforeFiles);
		r.stack.metadataCache.catchUp();
		const fresh = stackFoundation(r.stack, r.stack.projectFolder); fresh.rebuildIndex();
		const reloaded = new ObsidianPlanRepository(fresh.deps, fresh.store);
		expect(expectFound(await reloaded.getById(r.plan.id)).entity.background).toEqual(input.background);
		expectOk(await r.command.undo());
		expect(expectOk(await r.geometry.read(r.plan.id)).document).toEqual(r.baseline.geometry.document);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toEqual(r.plan.background);
		expect(parseFrontmatter(expectDefined(r.stack.vault.entries.get(r.note), 'note')).frontmatter).not.toHaveProperty('reference-appearance');
		expectOk(await r.command.execute());
		expect(expectOk(await r.geometry.read(r.plan.id)).document).toEqual(changed.document);
		expect(publish.mock.calls.map(([event]) => event.type)).toEqual(Array.from({ length: 3 }, () => ['PlanBackgroundChanged', 'PlanCalibrated', 'ZoneGeometryChanged']).flat());
	});
	it('does not write before confirmation and makes repeated execute/undo no-ops', async () => {
		const r = await setup(), before = new Map(r.stack.vault.entries);
		expect(new Map(r.stack.vault.entries)).toEqual(before);
		expect(await r.command.undo()).toEqual({ ok: true, value: 'no-write' });
		expectOk(await r.command.execute()); const after = new Map(r.stack.vault.entries);
		expect(await r.command.execute()).toEqual({ ok: true, value: 'no-write' }); expect(new Map(r.stack.vault.entries)).toEqual(after);
		expectOk(await r.command.undo()); expect(await r.command.undo()).toEqual({ ok: true, value: 'no-write' });
	});
	it.each(['note', 'sidecar'] as const)('refuses a peer change to %s before commit without overwriting it', async field => {
		const r = await setup();
		if (field === 'note') expectOk(await r.stack.plans.save(expectOk(r.plan.withBackground({ path: 'peer.jpg', kind: 'image' })), r.baseline.plan.version));
		else expectOk(await r.geometry.write(r.plan.id, { ...r.baseline.geometry.document, objects: [] }, r.baseline.geometry.version));
		const before = new Map(r.stack.vault.entries);
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: field === 'note' ? 'plan.revision-conflict' : 'plan-geometry.revision-conflict' } });
		expect(new Map(r.stack.vault.entries)).toEqual(before);
	});
	it('refuses an external note edit and peer geometry changes before Undo/Redo', async () => {
		const r = await setup(); r.stack.vault.entries.set(r.note, expectDefined(r.stack.vault.entries.get(r.note), 'note').replace(r.plan.name, 'Peer'));
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: 'plan.external-modification' } });
		const q = await setup(); expectOk(await q.command.execute()); expectOk(await q.command.undo());
		const live = expectOk(await q.geometry.read(q.plan.id)); expectOk(await q.geometry.write(q.plan.id, live.document, live.version));
		expect(await q.command.execute()).toMatchObject({ ok: false, error: { code: 'plan-geometry.revision-conflict' } });
		const u = await setup(); expectOk(await u.command.execute());
		const state = expectOk(await u.geometry.read(u.plan.id)); expectOk(await u.geometry.write(u.plan.id, state.document, state.version));
		expect(await u.command.undo()).toMatchObject({ ok: false, error: { code: 'plan-geometry.revision-conflict' } });
	});
	it.each([false, true])('compensates rejected/thrown sidecar writes (%s), retains the draft and permits a retry', async throws => {
		const r = await setup(); const write = vi.spyOn(r.geometry, 'write');
		if (throws) write.mockRejectedValueOnce(new Error('disk')); else write.mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await r.command.execute()).toMatchObject({ ok: false });
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toEqual(r.baseline.plan.entity.background);
		expect(expectOk(await r.geometry.read(r.plan.id)).document).toEqual(r.baseline.geometry.document);
		expectOk(await r.command.execute());
	});

	it('marks a thrown compensation failure as an unrecovered write', async () => {
		const r = await setup(), save = r.stack.plans.save.bind(r.stack.plans);
		vi.spyOn(r.stack.plans, 'save').mockImplementationOnce(save).mockRejectedValueOnce(new Error('restore disk'));
		vi.spyOn(r.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: 'reference.compensation-failed', uncompensatedWrite: true } });
	});
	it('reports failed compensation, preserves peer metadata and never forces a restore', async () => {
		const r = await setup();
		vi.spyOn(r.geometry, 'write').mockImplementationOnce(async () => {
			const current = expectFound(await r.stack.plans.getById(r.plan.id));
			expectOk(await r.stack.plans.save(expectOk(current.entity.withBackground({ path: 'peer.png', kind: 'image' })), current.version));
			return err(injectedPersistenceError());
		});
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: 'reference.compensation-failed' } });
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background?.path).toBe('peer.png');
	});
	it.each([
		{ background: { path: 'scan.txt', kind: 'image' } },
		{ background: { ...input.background, appearance: { ...expectDefined(input.background.appearance, 'appearance'), opacity: 2 } } },
		{ measurement: { ...input.measurement, knownDistance: 0 } },
	])('rejects invalid configuration without any mutation: %j', async patch => {
		const r = await setup(), before = new Map(r.stack.vault.entries);
		expect(await r.services.command(r.baseline, { ...input, ...patch } as ConfigureReferenceInput).execute()).toMatchObject({ ok: false });
		expect(new Map(r.stack.vault.entries)).toEqual(before);
	});
	it('reports missing source, missing plan and baseline/commit read failures', async () => {
		const r = await setup(); r.files.fileExists.mockReturnValue(false);
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: 'plan.background-not-found' } });
		expect(await r.services.read('missing' as never)).toMatchObject({ ok: false });
		vi.spyOn(r.geometry, 'read').mockResolvedValue(err(injectedPersistenceError()));
		expect(await r.services.read(r.plan.id)).toMatchObject({ ok: false });
		r.files.fileExists.mockReturnValue(true); expect(await r.command.execute()).toMatchObject({ ok: false });
	});
});
