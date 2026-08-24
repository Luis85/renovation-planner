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
});
