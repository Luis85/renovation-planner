import type { EntityId } from '../../core/identity/EntityId';
import type { EntityVersion } from '../ports/versioning';

/**
 * "What revision did THIS editor's own history last write for this entity" (design
 * slice 6, "The expectation is the history's, not the adapter's").
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
 * on exactly one event: a write this history dispatched and that succeeded. That is what
 * lets it tell "a sibling command in this history wrote in between" (the ledger advanced;
 * the undo applies) apart from "someone else wrote in between" (the ledger did not
 * advance; the write is correctly refused as stale).
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
	 */
	forget(id: EntityId<string>): void;
}

// Task 3 (the reversible command adapter) is the first consumer; nothing in src/ wires a
// CommandHistory yet. `tests/application/editor/writeLedger.test.ts` importing this class
// is what keeps fallow's dead-code check from flagging it in the meantime.
export class SessionWriteLedger implements WriteLedger {
	private readonly versions = new Map<EntityId<string>, EntityVersion>();

	lastWritten(id: EntityId<string>): EntityVersion | null {
		return this.versions.get(id) ?? null;
	}

	record(id: EntityId<string>, version: EntityVersion): void {
		this.versions.set(id, version);
	}

	forget(id: EntityId<string>): void {
		this.versions.delete(id);
	}
}
