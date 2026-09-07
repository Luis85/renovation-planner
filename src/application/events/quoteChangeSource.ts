import type { EventBus } from '../../core/events/EventBus';
import { createAssetCatalogueChangeSource } from './assetCatalogueChangeSource';
import { changedEntry, disposeAll, subscribeAll } from './subscriptions';
const QUOTE_CHANGE_EVENTS = ['QuoteSaved', 'SupplierCreated', 'PlanRenovationChanged', 'PlanCreated', 'ZoneCreated', 'ZoneDeleted', 'ZoneRenamed'] as const;
/** A quote projection combines offer facts, current catalogue labels and floor/Room Work context. */
export function createQuoteChangeSource(events: EventBus): (listener: () => void) => () => void {
 const catalogue = createAssetCatalogueChangeSource(events);
 return listener => disposeAll([
  { dispose: catalogue(listener) },
  ...subscribeAll(events, QUOTE_CHANGE_EVENTS, listener),
  ...subscribeAll(events, ['ProjectIndexEntryChanged'], event => {
   if (['renovation-quote', 'renovation-supplier', 'renovation-project', 'renovation-plan', 'renovation-zone'].includes(changedEntry(event).entityType ?? '')) listener();
  }),
 ]);
}
