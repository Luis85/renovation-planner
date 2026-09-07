import { expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createQuoteChangeSource } from '../../../src/application/events/quoteChangeSource';
it('delivers each relevant catalogue, offer and Room change once, ignores unrelated index entries and disposes every subscription', async () => {
 const bus = createEventBus(() => undefined), changed = vi.fn<() => void>(), dispose = createQuoteChangeSource(bus)(changed);
 const events = [
  ...['ProjectIndexRebuilt', 'AssetCreated', 'AssetUpdated', 'AssetDeleted', 'QuoteSaved', 'SupplierCreated', 'PlanRenovationChanged', 'PlanCreated', 'ZoneCreated', 'ZoneDeleted', 'ZoneRenamed'].map(type => ({ type })),
  ...['asset', 'quote', 'supplier', 'project', 'plan', 'zone'].map(kind => ({ type: 'ProjectIndexEntryChanged', payload: { entityType: 'renovation-' + kind } })),
 ];
 for (const event of events) { changed.mockClear(); await bus.publish(event); expect(changed).toHaveBeenCalledOnce(); }
 changed.mockClear();
 for (const event of [{ type: 'ProjectIndexEntryChanged' }, { type: 'ProjectIndexEntryChanged', payload: {} }, { type: 'ProjectIndexEntryChanged', payload: { entityType: 'renovation-trade' } }, { type: 'ZoneGeometryChanged' }]) await bus.publish(event);
 expect(changed).not.toHaveBeenCalled(); dispose();
 for (const event of events) await bus.publish(event);
 expect(changed).not.toHaveBeenCalled();
});
