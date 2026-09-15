import { expect, it, vi } from 'vitest';
import { WALL_LOOP, structureStack } from '../../helpers/structure';
import { expectOk, expectErr } from '../../helpers/domain';
import { withWallThickness } from '../../../src/domain/spatial/wallThickness';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { createRepositoryStack } from '../../helpers/vault';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

it('saves thickness with hosted openings and joins, reloads, and keeps history after admission retires', async () => {
	const rig = await structureStack(), history = new CommandHistory();
	const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 75 } }] };
	expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure, ledger: rig.ledger, room: rig.room })));
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), next = withWallThickness(baseline.document.structure as typeof structure, 'wall-a', 183);
	if (!next) throw new Error('thickness proposal missing');
	let allowed = true;
	expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline, structure: next, ledger: rig.ledger, admit: () => allowed })));
	allowed = false;
	const saved = expectOk(await rig.geometry.read(rig.plan.id));
	expect(saved.document.structure).toEqual(next);
	expect(saved.document.objects).toEqual(baseline.document.objects);
	const fresh = createRepositoryStack();
	for (const [path, content] of rig.stack.vault.entries) fresh.vault.entries.set(path, content);
	fresh.rebuildIndex(); expect(expectOk(await new ObsidianPlanGeometrySidecar(fresh.store).read(rig.plan.id)).document).toEqual(saved.document);
	expectOk(await history.undo()); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(baseline.document);
	expectOk(await history.redo()); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(saved.document);
});

it('checks initial admission both before and after the asynchronous version read', async () => {
	const rig = await structureStack(), read = vi.spyOn(rig.geometry, 'read'), write = vi.spyOn(rig.geometry, 'write');
	const refused = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, ledger: rig.ledger, admit: () => false });
	expect(expectErr(await refused.execute()).code).toBe('spatial.cancelled'); expect(read).not.toHaveBeenCalled();
	let allowed = true, release!: () => void;
	const original = rig.geometry.read.bind(rig.geometry);
	read.mockImplementationOnce(async id => { await new Promise<void>(resolve => { release = resolve; }); return original(id); });
	const pending = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, ledger: rig.ledger, admit: () => allowed }).execute();
	allowed = false; release(); expect(expectErr(await pending).code).toBe('spatial.cancelled'); expect(write).not.toHaveBeenCalled();
});
