/** Coalesce invalidations into one active read and one latest follow-up. */
export function createLatestRead<T>(read: () => Promise<T>, publish: (value: T) => void) {
 let alive = true, running = false, generation = 0;
 const waiters: { resolve: () => void; reject: (cause: unknown) => void }[] = [];
 function finish(settle: (waiter: typeof waiters[number]) => void): void {
  running = false;
  for (const waiter of waiters.splice(0)) settle(waiter);
 }
 async function attemptRead() {
  try { return { ok: true as const, value: await read() }; }
  catch (cause) { return { ok: false as const, cause }; }
 }
 async function drain(): Promise<void> {
  try {
   for (;;) {
    if (!alive) break;
    const ticket = generation, result = await attemptRead();
    if (!alive) break;
    if (ticket !== generation) continue;
    if (!result.ok) throw result.cause;
    publish(result.value);
    if (ticket === generation) break;
   }
   finish(waiter => waiter.resolve());
  } catch (cause) { finish(waiter => waiter.reject(cause)); }
 }
 function refresh(): Promise<void> {
  if (!alive) return Promise.resolve();
  generation++;
  const done = new Promise<void>((resolve, reject) => { waiters.push({ resolve, reject }); });
  if (!running) { running = true; void Promise.resolve().then(drain); }
  return done;
 }
 function dispose(): void { alive = false; generation++; finish(waiter => waiter.resolve()); }
 return { refresh, dispose };
}
