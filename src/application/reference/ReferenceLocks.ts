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
 * A THIRD rule stands beside those two and is the one NOT enforced here:
 *
 * - **a subscriber must never acquire a reference lock.**
 *
 * The mechanism, which makes this a deadlock rather than contention: `EventBus.publish`
 * AWAITS its handlers, so a subscriber blocked in `acquire` is awaiting `waitForRelease`,
 * which fires only from `releaseAll`, which the publisher reaches only after `publish`
 * returns. Neither side can advance, and nothing times out — the publishing command hangs
 * for the life of the session holding every lock it took.
 *
 * **Why the alternative is unavailable, and therefore why this is a RULE rather than a
 * repositioning of the publishes.** The obvious remedy is to publish after releasing. It
 * cannot close the class. Publishing under a lock is routine here rather than exceptional —
 * the sweep that produced this rule (2026-09-03) found 13 of the 40 publish source lines in
 * `src/` reached inside a locked region, across 18 (publish x locked-region) pairs — but the
 * half that DECIDES is not the breadth. It is that one of those pairs cannot move AT ALL:
 * `RecalculateRequirementCommand.execute`'s own publish, and the
 * `publishIfEffectiveCostChanged` call below it, are reached under a lock through
 * `recalculateInline` in `deleteResolution.ts`'s `requirementResolutionSteps`, so they sit
 * inside a shared command whose event buffering a prior ruling already declined. Moving the
 * ones that CAN move would leave a partial fix that reads exactly like a complete one at the
 * precise moment a first subscriber arrives.
 *
 * **Why it is not enforced at the lock like its two siblings.** `acquire` cannot see that
 * its caller is inside a publish; finding out would mean coupling `ReferenceLocks` to the
 * `EventBus`, which is a worse thing to own than the rule. Four instruments check it
 * instead, and what each one reaches differs:
 *
 * - `tests/application/reference/referenceLocks.test.ts` — the mechanism, with no engine:
 *   a subscriber reaching for a held lock never gets it, and the publish never settles;
 * - `tests/application/reference/deleteResolutionAnnouncements.test.ts` — the forward
 *   engine really does deliver with both levels still held;
 * - `tests/application/reference/undoDeleteResolution.test.ts` — the same for the undo
 *   engine, whose publish loop sits between its `acquire` and its `finally`;
 * - `tests/application/events/subscriberLockBoundary.test.ts` — a text tripwire over the
 *   modules that register subscribers.
 *
 * **Do not read that as more than it is.** The guarantee is that no subscriber module NAMES
 * a lock and that the constraint is live. It is NOT that no subscriber can reach one: a
 * handler handed a collaborator that locks internally would name nothing, and is invisible
 * to every instrument above.
 *
 * **No subscriber acquires a lock today** — established on 2026-09-03 by READING every
 * module that registers one (`event-handlers/requirement/cascade.ts`, the three
 * `on*.ts` handlers beside it, and `RecalculateRequirementCommand` below them), and NOT by
 * any of the four instruments above, none of which can see a lock reached through an
 * injected collaborator. Dated and attributed for the same reason the 13-of-40 figure is: it
 * is a fact about the tree at the moment somebody looked, and nothing re-establishes it.
 *
 * A SECOND and quite separate rule governs where a publisher announces FROM: publish outside
 * the locked region where you can, so a subscriber's own read does not wait on a lock the
 * publisher has not let go. `updateAssetShape` and `CalibrateAssetCommand.executeWithVersion`
 * state that one where they publish and follow it; `SetAssetBackgroundCommand.write`
 * publishes inside `withLevel1` and does not. **That is an exception to THAT convention and
 * to nothing on this page** — a publish-POSITION choice, violating no rule stated here, and
 * harmless for exactly as long as the subscriber rule above holds. Pre-existing, out of this
 * increment's scope, and named rather than glossed, because uniformity implied is uniformity
 * a later reader relies on.
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
	 * Hold ONE entity's level-1 lock for the length of `work`, released whatever `work` does.
	 *
	 * `withLevel2`'s sibling, and it exists for the same reason that one does: the shape was
	 * about to be spelled out longhand at three call sites. What it is FOR is different, and the
	 * difference is worth stating where the code is — level 2 serialises two writers of one
	 * requirement, while this serialises a writer of an entity's geometry against the DELETE of
	 * that entity.
	 *
	 * The hazard it closes (PR 43): an asset's sidecar is a separate file from its note, and an
	 * ABSENT sidecar is a valid empty document at `ABSENT_VERSION` — a real constant, `{ revision:
	 * 0, observed: observeSidecar('') }`. So a design command that read the note, found the asset,
	 * and then had the asset deleted under it presents `expected: ABSENT_VERSION` to a store that
	 * now reads exactly that, the compare-and-swap AGREES, and the write lands: a `.rpgeo` for an
	 * asset that is not there. The version condition protects an asset that HAD geometry — an
	 * expected revision 3 against an absent revision 0 refuses — and cannot protect one that did
	 * not, which is every first footprint, first calibration and first spec sheet.
	 *
	 * `runDeleteResolution` already holds level 1 on its entity across `deleteEntity`, so taking
	 * the same lock is all the design commands needed; the exclusive region existed and they were
	 * simply not in it. No hierarchy risk, because a design command holds level 1 and never
	 * reaches for level 2 — `LockSessionImpl`'s two raises are about the other direction.
	 */
	async withLevel1<T>(id: string, work: () => Promise<T>): Promise<T> {
		const release = await this.acquire([id], []);
		try {
			return await work();
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
