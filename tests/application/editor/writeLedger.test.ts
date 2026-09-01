import { describe, expect, it } from 'vitest';
import { SessionWriteLedger, undoSuperseded } from '../../../src/application/editor/WriteLedger';
import { affectsSaveState } from '../../../src/presentation/editor/save-state/affects-save-state';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
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

/**
 * The GENERATION, which is what the version alone could not answer: the version names the
 * TIP, and an undo's premise is about the CHAIN — see `WriteLedger`'s own five-step account
 * of the foreign write sandwiched between two of this history's gestures.
 */
describe('SessionWriteLedger generations', () => {
	it('starts at zero for an entity nothing has ever touched', () => {
		const ledger = new SessionWriteLedger();
		expect(ledger.generation('zone-x' as never)).toBe(0);
	});

	it('does not move when a gesture finds exactly what this history last wrote', () => {
		// The ordinary case, and the one an over-eager guard breaks: a sibling gesture in
		// this same history reads the version its predecessor wrote, which is agreement and
		// not interference.
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, version(1));

		expect(ledger.observe(id, version(1))).toBe(0);
		expect(ledger.generation(id)).toBe(0);
	});

	it('does not move for an entity this history has never written', () => {
		// A freshly minted id — `ReversibleCreateZoneCommand`'s first execute — has no prior
		// entry to disagree with, and reading the absence as interference would refuse the
		// undo of every creation.
		const ledger = new SessionWriteLedger();
		expect(ledger.observe('zone-new' as never, version(7))).toBe(0);
	});

	it('moves when a gesture finds a version this history did not write', () => {
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, version(1));

		expect(ledger.observe(id, version(2))).toBe(1);
		expect(ledger.generation(id)).toBe(1);
	});

	it('moves on a changed OBSERVATION at an unchanged revision, which is the hand edit', () => {
		// Revision-only would have been the cheaper comparison and is wrong for exactly the
		// writes `observed` exists to catch: a hand edit or a sync leaves the revision alone.
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, { revision: 3, observed: observationToken('before') });

		expect(ledger.observe(id, { revision: 3, observed: observationToken('after') })).toBe(1);
	});

	it('does not advance the recorded version to what it found', () => {
		// The ledger answers "what THIS history wrote". Advancing it to a foreign version
		// would hand the next undo an expectation the store matches, and that undo would then
		// overwrite the very write the observation was about — the defect, wearing the fix's
		// clothes.
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, version(1));

		ledger.observe(id, version(2));

		expect(ledger.lastWritten(id)).toEqual(version(1));
	});

	it('keeps the generation across a forget, while the version goes', () => {
		// Two claims about two subjects: the version is a fact about a note that is now gone,
		// the generation a fact about this history's exposure, which deleting the entity does
		// not un-happen. Resetting here revives the sandwich one gesture further along.
		const ledger = new SessionWriteLedger();
		const id = 'zone-1' as never;
		ledger.record(id, version(1));
		ledger.observe(id, version(2));

		ledger.forget(id);

		expect(ledger.lastWritten(id)).toBeNull();
		expect(ledger.generation(id)).toBe(1);
	});

	it('counts per entity, so one asset moving says nothing about another', () => {
		const ledger = new SessionWriteLedger();
		ledger.record('zone-a' as never, version(1));
		ledger.record('zone-b' as never, version(1));

		ledger.observe('zone-a' as never, version(2));

		expect(ledger.generation('zone-a' as never)).toBe(1);
		expect(ledger.generation('zone-b' as never)).toBe(0);
	});
});

describe('undoSuperseded', () => {
	/**
	 * Asserted as a PAIR, because each half alone passes a build that got the other wrong.
	 * The category has to be one `affectsSaveState` reads as pre-write — this refusal reaches
	 * no repository — and the code must NOT end in a write-boundary suffix, which is the
	 * carve-out that would flip a `Validation` refusal back to affecting.
	 */
	it('is a refusal the save indicator reads as having written nothing', () => {
		const error = undoSuperseded('zone-1' as never);

		expect(error.category).toBe('Validation');
		expect(error.code).toBe('undo.superseded');
		expect(affectsSaveState(error)).toBe(false);
	});

	it('resolves copy of its own rather than falling through to the category sentence', () => {
		// A code with no locale entry does not degrade to silence, it degrades to the WRONG
		// sentence — here "This data is not in the expected form" about data that is fine and
		// an undo that was refused to protect somebody else's edit.
		expect(toUserMessage('en', undoSuperseded('zone-1' as never))).not.toBe(
			toUserMessage('en', { category: 'Validation', code: 'nothing.mapped', message: 'x' }),
		);
	});
});
