/** Coalesce invalidations into one active read and one latest follow-up. */
export function createLatestRead<T>(read: () => Promise<T>, publish: (value: T) => void) {
 let alive = true, running = false, generation = 0;
 const waiters: { resolve: () => void; reject: (cause: unknown) => void }[] = [];
 function finish(settle: (waiter: typeof waiters[number]) => void): void {
  running = false;
  for (const waiter of waiters.splice(0)) settle(waiter);
 }
 async function drain(): Promise<void> {
  try {
   while (alive) {
    const ticket = generation;
    let value: T;
    try { value = await read(); }
    catch (cause) { if (alive && ticket !== generation) continue; throw cause; }
    if (!alive) break;
    if (ticket !== generation) continue;
    publish(value);
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
