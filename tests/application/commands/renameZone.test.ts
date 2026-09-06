import { describe, expect, it, vi } from 'vitest';
import { RenameZoneCommand } from '../../../src/application/commands/zone/RenameZone';
import { ReversibleRenameZoneCommand } from '../../../src/application/commands/zone/reversible-rename-zone-command';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { createPlanChangeSource } from '../../../src/application/events/planChangeSource';
import { createEventBus } from '../../../src/core/events/EventBus';
import { err } from '../../../src/core/result/Result';
import { makeZone } from '../../helpers/entities';
import { expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';

async function seed() {
	const zones = new InMemoryZoneRepository(), events = createEventBus(), ledger = new SessionWriteLedger();
	const original = expectOk(await zones.save(makeZone({ planId: 'plan-1' as never, projectId: 'project-1' as never, name: 'Kitchen', domainNoteLink: '[[Notes]]' }), 'absent'));
	const command = new RenameZoneCommand(zones, events);
	const input = { zoneId: original.entity.id, name: ' Dining / room : A ', expected: original.version, inverse: original.entity.name };
	return { zones, events, ledger, original, command, input, adapter: new ReversibleRenameZoneCommand(command, ledger, input) };
}

describe('conditional room naming', () => {
	it('announces each reversible write to matching plan leaves, including Undo and Redo', async () => {
		const r = await seed(); const listener = vi.fn<() => void>();
		createPlanChangeSource(r.events)(r.original.entity.planId, listener);
		expectOk(await r.adapter.execute()); expect(listener).toHaveBeenCalledTimes(1);
		expectOk(await r.adapter.undo()); expect(listener).toHaveBeenCalledTimes(2);
		expectOk(await r.adapter.execute()); expect(listener).toHaveBeenCalledTimes(3);
	});
	it('preserves every non-name field, accepts duplicate/punctuation names and notifies other plan leaves', async () => {
		const r = await seed(); const samePlan = vi.fn<() => void>(), otherPlan = vi.fn<() => void>();
		createPlanChangeSource(r.events)(r.original.entity.planId, samePlan);
		createPlanChangeSource(r.events)('other', otherPlan);
		expectOk(await r.zones.save(makeZone({ planId: r.original.entity.planId, projectId: r.original.entity.projectId, name: r.input.name }), 'absent'));
		const result = expectOk(await r.command.execute(r.input));
		expect(result.zone.entity).toEqual(expectOk(r.original.entity.withName('Dining / room : A')));
		expect(r.original.entity.name).toBe('Kitchen');
		expect(samePlan).toHaveBeenCalledTimes(1); expect(otherPlan).not.toHaveBeenCalled();
	});
	it('shares creation normalization, refuses blank names and writes nothing for identical names', async () => {
		const r = await seed(); const save = vi.spyOn(r.zones, 'save');
		for (const name of ['', ' \t\n ']) expect(await r.command.execute({ ...r.input, name })).toMatchObject({ ok: false, error: { code: 'zone.empty-name' } });
		for (const name of ['Kitchen', '  Kitchen \n']) expect(expectOk(await r.command.execute({ ...r.input, name })).outcome).toBe('no-write');
		expect(save).not.toHaveBeenCalled();
		expect(await r.zones.getById(r.input.zoneId)).toEqual({ ok: true, value: r.original });
	});
	it('conditions both version dimensions, even a normalized no-op', async () => {
		const r = await seed(); const save = vi.spyOn(r.zones, 'save');
		for (const expected of [{ ...r.input.expected, revision: 90 }, { ...r.input.expected, observed: 'peer' as never }]) {
			expect(await r.command.execute({ ...r.input, name: 'Kitchen', expected })).toMatchObject({ ok: false, error: { category: 'Validation' } });
		}
		expect(save).not.toHaveBeenCalled();
	});
	it('propagates missing, read and write failures without an event', async () => {
		const r = await seed(); const listener = vi.fn<() => void>(); createPlanChangeSource(r.events)(r.original.entity.planId, listener);
		expect(await r.command.execute({ ...r.input, zoneId: 'missing' as never })).toMatchObject({ ok: false });
		vi.spyOn(r.zones, 'getById').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await r.command.execute(r.input)).toMatchObject({ ok: false });
		vi.spyOn(r.zones, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await r.adapter.execute()).toMatchObject({ ok: false }); expect(listener).not.toHaveBeenCalled();
	});
	it('interleaves rename and geometry Undo/Redo through one ledger', async () => {
		const r = await seed(); expectOk(await r.adapter.execute());
		const moved = { points: r.original.entity.geometry.points.map(p => ({ x: p.x + 200, y: p.y })) };
		const move = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(r.zones, r.events), r.ledger, r.input.zoneId, moved, r.original.entity.geometry);
		expectOk(await move.execute()); expectOk(await move.undo()); expectOk(await r.adapter.undo());
		expect(expectFound(await r.zones.getById(r.input.zoneId)).entity).toEqual(r.original.entity);
		expectOk(await r.adapter.execute()); expectOk(await move.execute());
		expect(expectFound(await r.zones.getById(r.input.zoneId)).entity).toMatchObject({ name: r.input.name.trim(), geometry: moved });
	});
	it('refuses peer edits and superseded or missing history tips', async () => {
		const r = await seed(); expectOk(await r.adapter.execute());
		const current = expectFound(await r.zones.getById(r.input.zoneId));
		const peer = expectOk(await r.zones.save(expectOk(current.entity.withName('Peer')), current.version));
		expect(await r.adapter.undo()).toMatchObject({ ok: false });
		r.ledger.observe(r.input.zoneId, peer.version); r.ledger.record(r.input.zoneId, peer.version);
		expect(await r.adapter.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		expect(await r.adapter.execute()).toMatchObject({ ok: false });
		const clean = await seed(); expectOk(await clean.adapter.execute()); clean.ledger.forget(clean.input.zoneId);
		expect(await clean.adapter.undo()).toMatchObject({ ok: false });
	});
	it('reports a no-write adapter without recording a history version', async () => {
		const r = await seed(); const adapter = new ReversibleRenameZoneCommand(r.command, r.ledger, { ...r.input, name: ' Kitchen ' });
		expect(expectOk(await adapter.execute())).toBe('no-write'); expect(r.ledger.lastWritten(r.input.zoneId)).toBeNull();
	});
});
