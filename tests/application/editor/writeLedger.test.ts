import { describe, expect, it } from 'vitest';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { observationToken } from '../../helpers/domain';

const version = (revision: number) => ({ revision, observed: observationToken(`t${revision}`) });

describe('SessionWriteLedger', () => {
	it('answers null for an entity this history never wrote', () => {
		const ledger = new SessionWriteLedger();
		expect(ledger.lastWritten('zone-x' as never)).toBeNull();
	});
	it('records per entity and answers the latest write', () => {
		const ledger = new SessionWriteLedger();
		ledger.record('zone-a' as never, version(2));
		ledger.record('zone-b' as never, version(5));
		expect(ledger.lastWritten('zone-a' as never)?.revision).toBe(2);
		ledger.record('zone-a' as never, version(3));
		expect(ledger.lastWritten('zone-a' as never)?.revision).toBe(3);
	});
	it('forget removes an entry, so a deleted entity presents no expectation', () => {
		// A delete has no revision to record — the note is gone. Keeping the pre-delete one
		// means the ledger goes on answering a version for a note that does not exist, and
		// the first half to present it (slice 10's cascade-aware delete is the named
		// candidate) refuses a legitimate undo against a revision nothing has.
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, version(1));
		expect(ledger.lastWritten(id)).toEqual(version(1));

		ledger.forget(id);

		expect(ledger.lastWritten(id)).toBeNull();
	});

	it('forget for an id it never knew is a no-op, not a throw', () => {
		const ledger = new SessionWriteLedger();
		expect(() => ledger.forget('never-seen' as never)).not.toThrow();
	});
});
