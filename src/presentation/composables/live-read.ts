import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { AppError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import { persistenceError } from '../../application/errors';
import { createLatestRead } from './latest-read';
export interface LiveReadSource<T> { read(): Promise<Result<T, AppError>>; onChanged(listener: () => void): () => void }
/** A leaf projection retains its last data on failure while blocking dependent writes. */
export function useLiveRead<T>(source: LiveReadSource<T> | undefined) {
 const data = shallowRef<T | null>(null), error = shallowRef<AppError | null>(null), loading = ref(true);
 let alive = true, ticket = 0;
 const reader = source ? createLatestRead(() => source.read(), result => {
  if (!result.ok) { error.value = result.error; return; }
  data.value = result.value; error.value = null;
 }) : null;
 async function refresh(): Promise<void> {
  if (!alive) return;
  const started = ++ticket;
  loading.value = true;
  try {
   if (!reader) { error.value = persistenceError('settings.unrecovered', 'Planning data is unavailable.'); return; }
   await reader.refresh();
  } catch (cause) { if (alive && started === ticket) error.value = persistenceError('view.read-failed', 'The current records could not be read.', cause); }
  finally { if (alive && started === ticket) loading.value = false; }
 }
 const unsubscribe = source?.onChanged(() => { void refresh(); });
 onMounted(() => { void refresh(); });
 onBeforeUnmount(() => { alive = false; reader?.dispose(); unsubscribe?.(); });
 return { data, error, loading, refresh, paused: computed(() => loading.value || error.value !== null) };
}
