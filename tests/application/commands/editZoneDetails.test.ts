import { describe, expect, it, vi } from 'vitest';
import { EditZoneDetailsCommand } from '../../../src/application/commands/zone/EditZoneDetails';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { createPlanChangeSource } from '../../../src/application/events/planChangeSource';
import { createEventBus } from '../../../src/core/events/EventBus';
import { err } from '../../../src/core/result/Result';
import type { ZoneType } from '../../../src/domain/zone/ZoneType';
import { makeZone } from '../../helpers/entities';
import { expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { structureStack } from '../../helpers/structure';

async function seed() {
	const zones = new InMemoryZoneRepository(), events = createEventBus(), ledger = new SessionWriteLedger();
	const original = expectOk(await zones.save(makeZone({ planId: 'plan-metadata' as never, projectId: 'project-metadata' as never, zoneType: 'Custom', name: 'Area 1' }), 'absent'));
	const input = { zoneId: original.entity.id, expected: original.version, forward: { name: 'Patio', zoneType: 'Terrace' as const }, inverse: { name: original.entity.name, zoneType: original.entity.zoneType } };
	const command = new EditZoneDetailsCommand(zones, events, ledger, input);
	return { zones, events, ledger, original, input, command };
}
describe('Area details use one versioned Zone transaction', () => {
	it('updates name/type together, preserves other facts, and announces every history direction', async () => {
		const r = await seed(), changed = vi.fn<() => void>(), other = vi.fn<() => void>();
		const published = vi.spyOn(r.events, 'publish');
		const expectedEvent = { type: 'ZoneDetailsChanged', payload: { zoneId: r.input.zoneId, planId: r.original.entity.planId, projectId: r.original.entity.projectId } };
		createPlanChangeSource(r.events)(r.original.entity.planId, changed); createPlanChangeSource(r.events)('other', other);
		expectOk(await r.command.execute()); expect(published).toHaveBeenNthCalledWith(1, expectedEvent);
		expect(expectFound(await r.zones.getById(r.input.zoneId)).entity).toEqual(expectOk(r.original.entity.withDetails('Patio', 'Terrace')));
		expectOk(await r.command.undo()); expect(published).toHaveBeenNthCalledWith(2, expectedEvent); expect(expectFound(await r.zones.getById(r.input.zoneId)).entity).toEqual(r.original.entity);
		expectOk(await r.command.execute()); expect(published).toHaveBeenNthCalledWith(3, expectedEvent); expect(changed).toHaveBeenCalledTimes(3); expect(other).not.toHaveBeenCalled();
	});
	it('refuses invalid metadata and treats unchanged normalized details as no write', async () => {
		const r = await seed(), save = vi.spyOn(r.zones, 'save'), published = vi.spyOn(r.events, 'publish');
		for (const forward of [{ name: '', zoneType: 'Custom' as const }, { name: 'Patio', zoneType: 'unknown' as ZoneType }, { name: 'Room', zoneType: 'Room' as const }]) {
			expect(await new EditZoneDetailsCommand(r.zones, r.events, r.ledger, { ...r.input, forward }).execute()).toMatchObject({ ok: false, error: { category: 'Validation' } });
		}
		expect(await new EditZoneDetailsCommand(r.zones, r.events, r.ledger, { ...r.input, forward: { ...r.input.inverse, name: ' Area 1 ' } }).execute()).toEqual({ ok: true, value: 'no-write' });
		expect(save).not.toHaveBeenCalled(); expect(published).not.toHaveBeenCalled();
		expect(makeZone({ planId: r.original.entity.planId, projectId: r.original.entity.projectId, zoneType: 'Room' }).withDetails('Area', 'Custom')).toMatchObject({ ok: false, error: { code: 'zone.category-change' } });
	});
	it('refuses stale baselines and history after a peer revision or forgotten tip', async () => {
		const r = await seed(); expectOk(await r.zones.save(expectOk(r.original.entity.withName('Peer')), r.original.version));
		expect(await r.command.execute()).toMatchObject({ ok: false, error: { code: 'zone.revision-conflict' } });
		const q = await seed(); expectOk(await q.command.execute()); q.ledger.forget(q.input.zoneId);
		expect(await q.command.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		const u = await seed(); expectOk(await u.command.execute());
		const live = expectFound(await u.zones.getById(u.input.zoneId)); const peer = expectOk(await u.zones.save(expectOk(live.entity.withName('Peer')), live.version));
		u.ledger.observe(u.input.zoneId, peer.version);
		expect(await u.command.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		expect(expectFound(await u.zones.getById(u.input.zoneId)).entity.name).toBe('Peer');
	});
	it('propagates missing/read/write refusals without advancing history', async () => {
		const r = await seed(); expectOk(await r.zones.delete(r.input.zoneId, r.original.version));
		expect(await r.command.execute()).toMatchObject({ ok: false });
		const q = await seed(); vi.spyOn(q.zones, 'getById').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await q.command.execute()).toMatchObject({ ok: false, error: { category: 'Persistence' } });
		vi.spyOn(q.zones, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await q.command.execute()).toMatchObject({ ok: false, error: { category: 'Persistence' } });
		expect(q.ledger.lastWritten(q.input.zoneId)).toBeNull();
	});
	it('round-trips real Markdown/sidecar metadata and receipts without changing geometry', async () => {
		const r = await structureStack();
		const original = expectOk(await r.stack.zones.save(makeZone({ planId: r.plan.id, projectId: r.plan.projectId, zoneType: 'Custom' }), 'absent'));
		const geometry = expectOk(await r.geometry.read(r.plan.id)).document;
		const command = new EditZoneDetailsCommand(r.stack.zones, r.stack.events, r.ledger, { zoneId: original.entity.id, expected: original.version,
			forward: { name: 'Garden patio', zoneType: 'Terrace' }, inverse: { name: original.entity.name, zoneType: original.entity.zoneType } });
		expectOk(await command.execute()); expect(expectFound(await r.stack.zones.getById(original.entity.id)).entity.zoneType).toBe('Terrace');
		expect(expectOk(await r.geometry.read(r.plan.id)).document).toEqual(geometry);
		expect(r.ledger.lastWritten(r.plan.id)).toEqual(expectOk(await r.geometry.read(r.plan.id)).version);
		expectOk(await command.undo()); expect(expectFound(await r.stack.zones.getById(original.entity.id)).entity).toEqual(original.entity);
		expectOk(await command.execute()); expect(expectFound(await r.stack.zones.getById(original.entity.id)).entity.name).toBe('Garden patio');
	});
});
