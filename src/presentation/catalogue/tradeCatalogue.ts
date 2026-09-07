import { computed, inject, onBeforeUnmount, onMounted, provide, readonly, ref, shallowRef, type InjectionKey, type Ref } from 'vue';
import type { Trade } from '../../domain/trade/Trade';
import type { NamedCatalogueServices } from '../../application/commands/catalogue/NamedCatalogueServices';
import type { Logger } from '../../application/ports/Logger';
import { createLatestRead } from '../composables/latest-read';
import { notifyFault } from '../notices/notify';

export interface TradeCatalogueView {
 readonly entries: Readonly<Ref<readonly Trade[]>>;
 readonly status: Readonly<Ref<'unavailable' | 'loading' | 'ready' | 'failed'>>;
 readonly partial: Readonly<Ref<boolean>>;
 readonly available: Readonly<Ref<boolean>>;
 refresh(): Promise<void>;
}
const KEY: InjectionKey<TradeCatalogueView> = Symbol('TradeCatalogue');
function emptyCatalogue(): TradeCatalogueView {
 return { entries: readonly(shallowRef<readonly Trade[]>([])), status: readonly(ref('unavailable' as const)), partial: readonly(ref(false)), available: readonly(ref(false)), refresh: () => Promise.resolve() };
}
/** One read model per leaf, shared by Work rows and retained dialogs. No catalogue writes or identities live here. */
export function provideTradeCatalogue(services: NamedCatalogueServices<Trade> | undefined, logger: Logger): TradeCatalogueView {
 const entries = shallowRef<readonly Trade[]>([]), status = ref<TradeCatalogueView['status']['value']>(services ? 'loading' : 'unavailable'), partial = ref(false);
 let alive = true;
 const reader = services ? createLatestRead(() => services.list(), result => {
  if (!result.ok) { status.value = 'failed'; return; }
  entries.value = result.value.loaded.map(item => item.entity); partial.value = result.value.refused.length > 0; status.value = 'ready';
 }) : null;
 async function refresh(): Promise<void> {
  if (!alive || !reader) return;
  status.value = 'loading';
  try { await reader.refresh(); }
  catch (cause) { if (alive) { status.value = 'failed'; notifyFault(cause, logger, 'trade.list-failed'); } }
 }
 const unsubscribe = services?.onChanged(() => { void refresh(); });
 onMounted(() => { void refresh(); });
 onBeforeUnmount(() => { alive = false; reader?.dispose(); unsubscribe?.(); });
 const view: TradeCatalogueView = { entries: readonly(entries), status: readonly(status), partial: readonly(partial), available: computed(() => status.value === 'ready'), refresh };
 provide(KEY, view); return view;
}
export function useTradeCatalogue(): TradeCatalogueView { return inject(KEY, emptyCatalogue, true); }
