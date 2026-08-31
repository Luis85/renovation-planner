/**
 * The two-level mutual-exclusion set over everything that can make the reference graph
 * disagree with an invariant someone is about to rely on (design slice 10, "Deletion &
 * reference integrity"):
 *
 *   level 1 — an entity id (a ZoneId or AssetId): who may CREATE a reference to it,
 *             DELETE it, or cross its unit kind while referents exist
 *   level 2 — a RequirementId: who may WRITE that requirement
 *
 * Levels are always acquired 1 then 2, each level's whole set in ONE acquisition sorted
 * ascending by the id's string value (ULIDs, so the order is total and computable without
 * coordination). A total order plus one acquisition point per level is the standard
 * deadlock cure: within a level the whole sorted batch is taken or nothing is, and no
 * holder of a level-2 lock ever waits for a level-1 one, so the wait-for graph cannot
 * cycle.
 *
 * The two rules the hierarchy lives on are enforced HERE, at the lock, rather than by
 * reviewing every command that uses it — so they hold for sequences not yet written. Both
 * are checked against the ACQUIRING SESSION's own holdings:
 *
 * - a session asking for a level it already holds raises (every acquirer must know its
 *   full set before it takes anything; a second acquisition within a level is the
 *   incremental take-one-learn-take-another shape the rule exists to refuse);
 * - a session holding level-2 asking for level-1 raises (a level-2 holder never reaches
 *   back; nothing does today and the raise keeps that true).
 *
 * Deliberately NOT a general write mutex: an ordinary requirement writer holds exactly one
 * level-2 lock through its own short-lived session and waits for nothing else, so the
 * recalculation cascade's concurrent pairs neither contend nor deadlock.
 */

export type Release = () => void;

export interface LockSession {
	acquire(level1: readonly string[], level2: readonly string[]): Promise<void>;
	release(): void;
}

class LockSessionImpl implements LockSession {
	private heldLevel1 = false;
	private heldLevel2 = false;
	// Kept for symmetry with the lock's own maps, which remain the authority on what is
	// held; per-session batches make release self-contained.
	private batch1: string[] = [];
	private batch2: string[] = [];

	constructor(private readonly locks: ReferenceLocks) {}

	async acquire(level1: readonly string[], level2: readonly string[]): Promise<void> {
		const batch1 = [...new Set(level1)].toSorted();
		const batch2 = [...new Set(level2)].toSorted();

		if (batch1.length > 0) {
			if (this.heldLevel2) {
				throw new Error(
					'ReferenceLocks: a level-2 holder requested level-1 — hierarchy violation.',
				);
			}
			if (this.heldLevel1) {
				throw new Error(
					'ReferenceLocks: a second level-1 acquisition from a holder — take the whole set at once.',
				);
			}
		}
		if (batch2.length > 0 && this.heldLevel2) {
			throw new Error(
				'ReferenceLocks: a second level-2 acquisition from a holder — take the whole set at once.',
			);
		}

		while (!this.locks.tryTake(this, 1, batch1)) {
			await this.locks.waitForRelease();
		}
		if (batch1.length > 0) {
			this.heldLevel1 = true;
			this.batch1 = batch1;
		}
		while (!this.locks.tryTake(this, 2, batch2)) {
			await this.locks.waitForRelease();
		}
		if (batch2.length > 0) {
			this.heldLevel2 = true;
			this.batch2 = batch2;
		}
	}

	release(): void {
		this.locks.releaseAll(this);
		this.heldLevel1 = false;
		this.heldLevel2 = false;
		this.batch1 = [];
		this.batch2 = [];
	}
}

export class ReferenceLocks {
	/** Convenience for the common shape: both batches at once, released in a `finally`. */
	async acquire(level1: readonly string[], level2: readonly string[]): Promise<Release> {
		const session = this.beginSession();
		await session.acquire(level1, []);
		await session.acquire([], level2);
		return () => session.release();
	}

	/**
	 * Hold ONE entity's level-2 lock for the length of `write`, released whatever `write` does.
	 *
	 * The shape both override commands had spelled out longhand — `acquire`, `try`, `finally
	 * release` — which is the level-2 lock a delete resolution's compensation relies on. The
	 * RULE was already stated once (`SetRequirementCostOverrideCommand`'s header, cited by its
	 * sibling's comment); the CODE was not, and `npm run analyze` reported the pair as a clone.
	 * A rule stated once over two copies is the shape this repository keeps re-finding.
	 *
	 * Deliberately not widened to a list: every caller today locks exactly the entity it is
	 * about to write, and a `readonly string[]` parameter would invite a second caller to pass
	 * a set without the ordering argument `beginSession` exists to make.
	 */
	async withLevel2<T>(id: string, write: () => Promise<T>): Promise<T> {
		const release = await this.acquire([], [id]);
		try {
			return await write();
		} finally {
			release();
		}
	}

	/**
	 * One command's locking lifetime. The delete resolution uses one session across TWO
	 * acquire calls (level 1 at step 0, level 2 at step 1) — which is exactly what the
	 * hierarchy permits and everything else refuses.
	 */
	beginSession(): LockSession {
		return new LockSessionImpl(this);
	}

	/** Test seam: is `id` currently held at `level`, by anyone? */
	isHeld(level: 1 | 2, id: string): boolean {
		return this.heldMap(level).has(id);
	}

	/**
	 * Internal — resolves once when any lock is released; the caller re-checks and
	 * re-arms if it is still blocked. Public only because the session sharing this
	 * module needs it.
	 */
	waitForRelease(): Promise<void> {
		return new Promise<void>((resolve) => {
			const wake = (): void => {
				this.waiters.delete(wake);
				resolve();
			};
			this.waiters.add(wake);
		});
	}

	tryTake(session: LockSession, level: 1 | 2, ids: readonly string[]): boolean {
		const map = this.heldMap(level);
		if (ids.some((id) => map.has(id))) return false;
		for (const id of ids) map.set(id, session);
		return true;
	}

	releaseAll(session: LockSession): void {
		for (const map of [this.held1, this.held2]) {
			for (const [id, holder] of map) {
				if (holder === session) map.delete(id);
			}
		}
		for (const wake of this.waiters) wake();
	}

	private readonly held1 = new Map<string, LockSession>();
	private readonly held2 = new Map<string, LockSession>();
	private readonly waiters = new Set<() => void>();

	private heldMap(level: 1 | 2): Map<string, LockSession> {
		return level === 1 ? this.held1 : this.held2;
	}
}
