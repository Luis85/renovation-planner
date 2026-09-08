import { describe, expect, it, vi } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { createRepositoryStack } from '../../helpers/vault';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { renovationServices, validateRenovationInput } from '../../../src/application/commands/renovation/RenovationCommand';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { err, ok } from '../../../src/core/result/Result';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { calibrateDocument } from '../../../src/application/commands/plan/ReversibleCalibratePlan';

const fault = { category: 'Persistence' as const, code: 'test.write-failed', message: 'Disk refused' };
describe('renovation transactions through Markdown and sidecar repositories', () => {
	it('preserves independent facts, relationships and IDs through fresh reload and repeated undo/redo', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const publish = vi.spyOn(rig.stack.events, 'publish');
		const command = rig.renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger);
		expect(await command.undo()).toEqual(ok('no-write'));
		expectOk(await command.execute()); expect(await command.execute()).toEqual(ok('no-write'));
		expect(publish).toHaveBeenLastCalledWith({ type: 'PlanRenovationChanged', payload: { planId: rig.plan.id, projectId: rig.plan.projectId } });
		const saved = expectOk(await rig.read()); expect(saved.plan.entity.renovation).toEqual(rig.value);
		// The document is untouched, and the sidecar still moved one revision: a metadata-only renovation writes it as a CAS no-op so a peer deletion cannot slip in between.
		expect(saved.geometry.document).toEqual(baseline.geometry.document); expect(saved.geometry.version.revision).toBe(baseline.geometry.version.revision + 1);
		const fresh = createRepositoryStack(); for (const [path, bytes] of rig.stack.vault.entries) fresh.vault.entries.set(path, bytes); fresh.rebuildIndex();
		const loaded = expectOk(await renovationServices(fresh.plans, new ObsidianPlanGeometrySidecar(fresh.store), fresh.events).read(rig.plan.id));
		expect(loaded.plan.entity.renovation).toEqual(rig.value);
		for (let i = 0; i < 2; i++) { publish.mockClear(); expectOk(await command.undo()); expect(publish).toHaveBeenCalledOnce(); expect(expectOk(await rig.read()).plan.entity.renovation).toBeUndefined(); expectOk(await command.execute()); }
	});
	it('composes metadata and intended geometry while leaving current hosts and Room outlines intact', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const current = expectDefined(baseline.geometry.document.structure, 'structure');
		const intended = { ...current, openings: [{ id: 'opening-proposed', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		const subject = { ...rig.value.subjects[0], id: 'detail-door', kind: 'door' as const, targetId: 'opening-proposed', existing: null, planned: { change: 'add' as const, description: 'New doorway' } };
		const command = rig.renovation.command(baseline, { renovation: { ...rig.value, subjects: [...rig.value.subjects, subject] }, intended }, rig.ledger);
		expectOk(await command.execute()); const saved = expectOk(await rig.read());
		expect(saved.geometry.document.structure).toEqual(current); expect(saved.geometry.document.objects).toEqual(baseline.geometry.document.objects);
		expect(saved.geometry.document.intended).toEqual(intended);
		const scaled = expectOk(calibrateDocument(saved.geometry.document, { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 }));
		expect(scaled.intended?.openings[0].width).toBe(1800);
		expectOk(await command.undo()); expect(expectOk(await rig.read()).geometry.document).toEqual(baseline.geometry.document);
		expectOk(await command.execute());
	});
	it('refuses invalid states, missing targets, dangling intended hosts and linked Room deletion without losing notes', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		expect(validateRenovationInput({ ...rig.value, subjects: [] }, baseline.geometry.document).ok).toBe(false);
		expect(validateRenovationInput(rig.value, { ...baseline.geometry.document, objects: [] }).ok).toBe(false);
		expect(validateRenovationInput(EMPTY_RENOVATION, { ...baseline.geometry.document, intended: { ...EMPTY_STRUCTURE, openings: [{ id: 'opening-bad', kind: 'door', hostId: 'absent', offset: 0, width: 900, height: 2000, sill: 0 }] } }).ok).toBe(false);
		expectOk(await rig.renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger).execute());
		const before = [...rig.stack.vault.entries];
		expect(expectErr(await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, objects: [], structure: EMPTY_STRUCTURE })).code).toBe('renovation.room-missing');
		expect([...rig.stack.vault.entries]).toEqual(before);
	});
	it.each(['metadata', 'geometry'] as const)('refuses stale %s baselines and later peer writes', async kind => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const command = rig.renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger);
		if (kind === 'metadata') expectOk(await rig.stack.plans.save(baseline.plan.entity, baseline.plan.version));
		else expectOk(await rig.geometry.write(rig.plan.id, baseline.geometry.document, baseline.geometry.version));
		expect(expectErr(await command.execute()).code).toContain('revision-conflict');
		const next = rig.renovation.command(expectOk(await rig.read()), { renovation: rig.value, intended: undefined }, rig.ledger); expectOk(await next.execute());
		const live = expectOk(await rig.read());
		if (kind === 'metadata') expectOk(await rig.stack.plans.save(live.plan.entity, live.plan.version));
		else expectOk(await rig.geometry.write(rig.plan.id, { ...live.geometry.document, intended: EMPTY_STRUCTURE }, live.geometry.version));
		const bytes = [...rig.stack.vault.entries]; expect(expectErr(await next.undo()).code).toBe('undo.superseded'); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it.each([false, true])('compensates spatial failure using its own metadata receipt; compensation failure=%s', async fails => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const command = rig.renovation.command(baseline, { renovation: rig.value, intended: baseline.geometry.document.structure }, rig.ledger);
		vi.spyOn(rig.geometry, 'write').mockRejectedValueOnce(new Error('disk'));
		if (fails) { const save = rig.stack.plans.save.bind(rig.stack.plans); vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(save).mockRejectedValueOnce(new Error('restore')); }
		const failure = expectErr(await command.execute()); expect(leftWritesBehind(failure)).toBe(fails);
		expect(expectOk(await rig.read()).plan.entity.renovation).toEqual(fails ? rig.value : undefined);
		const retry = await command.execute(); expect(retry.ok).toBe(!fails);
		if (!fails) expectOk(await command.undo());
	});
	it('handles returned write/restore failures and read faults; suppresses concurrent submissions', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const command = rig.renovation.command(baseline, { renovation: rig.value, intended: baseline.geometry.document.structure }, rig.ledger);
		vi.spyOn(rig.stack.plans, 'save').mockResolvedValueOnce(err(fault)); expect(await command.execute()).toEqual(err(fault));
		vi.spyOn(rig.geometry, 'read').mockResolvedValueOnce(err(fault)); expect(await command.execute()).toEqual(err(fault));
		vi.spyOn(rig.stack.plans, 'getById').mockRejectedValueOnce(new Error('read')); expect(expectErr(await command.execute()).code).toBe('renovation.write-failed');
		const pending = command.execute(); expect(await command.execute()).toEqual(ok('no-write')); expectOk(await pending);
		const second = rig.renovation.command(expectOk(await rig.read()), { renovation: rig.value, intended: undefined }, rig.ledger);
		vi.mocked(rig.stack.plans.save).mockRestore(); const save = rig.stack.plans.save.bind(rig.stack.plans); vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(fault));
		vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(fault)); expect(leftWritesBehind(expectErr(await second.execute()))).toBe(true);
	});
	it('refuses a metadata-only renovation whose Room a peer deleted between its check and its save, leaving no metadata behind', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const command = rig.renovation.command(baseline, { renovation: rig.value, intended: undefined }, rig.ledger);
		const save = rig.stack.plans.save.bind(rig.stack.plans);
		vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(async (plan, expected) => {
			// After check() read the Room and before the metadata lands: the store's deletion guard reads a Plan with no renovation yet, so the deletion goes through.
			expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, objects: [], structure: EMPTY_STRUCTURE }, baseline.geometry.version));
			return save(plan, expected);
		});
		const failure = expectErr(await command.execute());
		expect(failure.code).toContain('revision-conflict'); expect(leftWritesBehind(failure)).toBe(false);
		const live = expectOk(await rig.read()); expect(live.plan.entity.renovation).toBeUndefined(); expect(live.geometry.document.objects).toEqual([]);
	});
	it('reads absent plans and sidecar refusals without partial baselines', async () => {
		const rig = await renovationStack(); vi.spyOn(rig.stack.plans, 'getById').mockResolvedValueOnce(ok(null)); expect((await rig.read()).ok).toBe(false);
		vi.spyOn(rig.geometry, 'read').mockResolvedValueOnce(err(fault)); expect(await rig.read()).toEqual(err(fault));
	});
});
