import type { ValidationError } from '../../core/errors/AppError';
import type { EntityId } from '../../core/identity/EntityId';
import { sameVersion, type EntityVersion } from '../ports/versioning';

/**
 * "What revision did THIS editor's own history last write for this entity" (design
 * slice 6, "The expectation is the history's, not the adapter's"), plus "has anything
 * OUTSIDE this history written since a given gesture captured its inverse".
 *
 * A reversible command adapter's `undo()`/`redo()` presents a conditional-write
 * expectation on every operation after its first — SDD-linked design slice 6's rule that
 * an inverse asserts "put this back, because nothing has happened since", a premise only
 * a comparison against a specific prior revision can verify. An earlier draft kept that
 * memory as a private field on each adapter, and it is wrong the moment two adapters touch
 * one entity: move-zone writes V1 (adapter A remembers V1), rename-zone writes V2 (adapter
 * B remembers V2), undo-rename writes V3 (adapter B remembers V3), and undo-move — still
 * holding V1 — is refused against V3 even though every write was this plugin's own, in
 * order, and nothing foreign happened. An adapter knows only what IT wrote and is blind to
 * its siblings.
 *
 * The history is not blind — it dispatched all of them — so the memory belongs to one
 * `WriteLedger` per `CommandHistory`, shared by every adapter that history runs, advancing
 * on exactly one event: a write this history dispatched and that succeeded.
 *
 * **The version alone answers a question about the TIP, and the question an undo actually
 * asks is about the CHAIN.** This docblock used to claim that one number told "a sibling
 * command in this history wrote in between" (the ledger advanced; the undo applies) apart
 * from "someone else wrote in between" (the ledger did not advance; the write is refused as
 * stale). It does not, and the counter-example is a foreign write SANDWICHED between two of
 * this history's own gestures:
 *
 * 1. gesture G1 writes, and the ledger records V1. Its inverse holds document D0.
 * 2. a peer leaf, or a synced change, writes: the store is at V2 and the ledger still says V1.
 * 3. G2 pre-reads V2, writes, and the ledger records V3.
 * 4. undoing G2 restores the peer-containing snapshot G2 captured, and records V4.
 * 5. undoing G1 presents the ledger's V4, which is exactly what the store holds — so it
 *    SUCCEEDS and writes D0 back, and the peer's edit is gone with no refusal anywhere.
 *
 * Every one of those five writes is conditional and every condition holds. The ledger
 * advanced, so the old sentence read step 5 as the sibling case; the peer's write in step 2
 * is what it could not see, because by then the ledger had been overwritten by our own
 * later writes and nothing remembered that a version had been skipped.
 *
 * **So the ledger carries a per-entity GENERATION beside the version, and detection is a
 * separate act from recording.** A gesture with a pre-read holds two facts at its forward
 * execute — what the ledger says this history last wrote, and what its own read just found —
 * and `observe` compares them: a non-null entry that DIFFERS is something outside this
 * history, and the generation is bumped. At that instant the observing gesture's own inverse
 * is still safe (it was captured after the foreign write) and every inverse below it on the
 * stack is not, which is exactly what a monotonic counter expresses: each gesture records
 * `generation(id)` beside its inverse, and an undo whose generation has moved refuses
 * (`undoSuperseded` below) rather than writing.
 *
 * Refusing is the honest answer rather than a conservative one. A whole-snapshot inverse
 * cannot MERGE — it replaces a document or an entity outright — so the only alternative to
 * refusing is the silent overwrite of step 5.
 *
 * **What `observe` cannot see, stated narrowly because a documented residue reads as
 * surveyed ground.** It is a SAMPLE taken at forward executes, so a foreign write that no
 * later gesture's pre-read ever looks at is invisible, and an inverse below it is applied.
 * The three adapters with a real pre-read (both asset design adapters and the zone delete
 * adapter) sample at every execute; `ReversibleMoveZoneCommand` has no pre-read of its own
 * and samples the version its wrapped command reports having LOADED, which is the same
 * reading one call deeper; `ReversibleCreateZoneCommand` samples nothing on its first
 * execute and needs to, since a freshly minted id has no prior entry to disagree with.
 *
 * **What "record" is actually required of.** Every write a history's adapter lands must be
 * recorded, restores included. A DELETE records nothing, and that is not an omission: the
 * entity has no revision to remember once its note is gone, and the next thing to touch
 * that id is a restore, which writes with an `'absent'` expectation and consults no ledger
 * entry. So the rule is "every write, never a delete" — narrower than the "every
 * successful half" the adapters' own comments used to state, two of whose four halves are
 * deletes. Deletes additionally FORGET the id (`forget` below), so a stale entry cannot
 * outlive the note it described and be presented as an expectation by whatever touches
 * that id next.
 */
export interface WriteLedger {
	lastWritten(id: EntityId<string>): EntityVersion | null;
	record(id: EntityId<string>, version: EntityVersion): void;
	/**
	 * "This entity no longer exists" — what a successful delete records instead of a
	 * version. Without it the ledger goes on answering the pre-delete revision for a note
	 * that is gone, and the first half to present that as an expectation (slice 10's
	 * cascade-aware delete is the named candidate) refuses a legitimate undo against a
	 * revision nothing has.
	 *
	 * **It forgets the VERSION and keeps the GENERATION**, which are two different claims
	 * about two different subjects. A version is a fact about a note, and the note is gone;
	 * a generation is a fact about this HISTORY's exposure, and deleting an entity does not
	 * un-happen a peer's write to it. Resetting it here would revive the sandwich one
	 * gesture further along — G1 moves, a peer writes, G2 observes and bumps, G3 deletes and
	 * forgets, undoing G3 restores, and undoing G2 and then G1 would each find a generation
	 * back at its starting value and write a pre-peer snapshot. `writeLedger.test.ts` pins
	 * both halves, because "forget clears everything about this id" is the reading a later
	 * reader will reach for.
	 */
	forget(id: EntityId<string>): void;
	/**
	 * How many times something outside this history has been seen writing this entity.
	 * Read by every adapter that keeps a whole-snapshot inverse, recorded beside that
	 * inverse, and compared again at `undo`.
	 *
	 * A plain read rather than a second parameter on `observe`, because two adapters have
	 * nothing to compare against — `ReversibleCreateZoneCommand`'s first execute mints the
	 * id — and an optional `found` would let a caller silently pass nothing where it had a
	 * reading to give.
	 */
	generation(id: EntityId<string>): number;
	/**
	 * Reconcile what this history last wrote against what a gesture's own read just found,
	 * and answer the generation that gesture is executing under.
	 *
	 * A non-null entry that differs from `found` is a write this history did not make, so
	 * the generation moves. The entry itself is deliberately NOT advanced to `found`: the
	 * ledger answers "what this history wrote", and an undo presenting a version somebody
	 * else minted would match the store and overwrite them, which is the defect rather than
	 * the fix. Observing the same foreign write twice therefore bumps twice, which costs
	 * nothing — the only question ever asked of the counter is whether it has moved.
	 */
	observe(id: EntityId<string>, found: EntityVersion): number;
}

/**
 * The refusal an undo answers when something outside this history wrote after its inverse
 * was captured.
 *
 * **`Validation`, and a code that is deliberately not a write-boundary one.** The meaning is
 * `versioning.ts`'s — a premise about a stored version no longer holds — and that module
 * raises `revisionConflict`/`externalModification` in the same category. What differs is
 * WHERE: those two are the store's answer to a write it received, and this one is raised
 * before any repository is reached, having written nothing at all. So it must land on the
 * PRE-write side of `affectsSaveState`, which is precisely what a `Validation` category
 * outside `WRITE_BOUNDARY_CODES` expresses — a "Save error" badge here would report a
 * persistence failure that did not happen, over data exactly as safe as it was.
 *
 * A factory rather than a literal at each of the three raise sites, for the reason the two
 * `nothingToUndo` helpers already record: the same logical refusal minted by hand in two
 * files arrived under two different categories, and category is the discriminant SDD §64
 * makes it so a consumer can route on it.
 */
export function undoSuperseded(id: EntityId<string>): ValidationError {
	return {
		category: 'Validation',
		code: 'undo.superseded',
		message: `${id} was written outside this editor's history after this step was recorded; undoing it would discard that change.`,
	};
}

export class SessionWriteLedger implements WriteLedger {
	private readonly versions = new Map<EntityId<string>, EntityVersion>();
	// Separate from `versions` because `forget` clears one and keeps the other — see the
	// interface's account of why those are two claims about two subjects.
	private readonly generations = new Map<EntityId<string>, number>();

	lastWritten(id: EntityId<string>): EntityVersion | null {
		return this.versions.get(id) ?? null;
	}

	record(id: EntityId<string>, version: EntityVersion): void {
		this.versions.set(id, version);
	}

	forget(id: EntityId<string>): void {
		this.versions.delete(id);
	}

	generation(id: EntityId<string>): number {
		return this.generations.get(id) ?? 0;
	}

	observe(id: EntityId<string>, found: EntityVersion): number {
		const ours = this.versions.get(id);
		if (ours !== undefined && !sameVersion(ours, found)) {
			this.generations.set(id, this.generation(id) + 1);
		}
		return this.generation(id);
	}
}
