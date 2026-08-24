/**
 * Per-key mutual exclusion for async critical sections (SDD §42's per-entity and
 * per-plan queues). A comparison the write cannot be separated from is a
 * compare-and-swap; a comparison the caller makes outside the queue is check-then-act.
 *
 * Tasks for one key run to completion in submission order. A task that REJECTS does not
 * poison the queue — the next task runs — because every repository translates its own
 * failures into `Result` values before the queue ever sees them, and a queue that died
 * with one failure would deadlock every later writer to that entity.
 */
export class KeyedQueues {
	private readonly tails = new Map<string, Promise<unknown>>();

	run<T>(key: string, task: () => Promise<T>): Promise<T> {
		const tail = this.tails.get(key) ?? Promise.resolve();
		const running = tail.then(task, task);
		this.tails.set(
			key,
			running.then(
				() => undefined,
				() => undefined,
			),
		);
		return running;
	}
}
