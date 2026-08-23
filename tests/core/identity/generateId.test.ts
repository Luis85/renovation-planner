import { describe, expect, it } from 'vitest';
import { createEntityId } from '../../../src/core/identity/generateId';
import type { EntityId } from '../../../src/core/identity/EntityId';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('createEntityId', () => {
	it('produces the <prefix>-<ULID> shape', () => {
		const id = createEntityId('zone');
		expect(id.startsWith('zone-')).toBe(true);
		expect(ULID_PATTERN.test(id.slice('zone-'.length))).toBe(true);
	});

	it('carries its brand at the type level while remaining a plain string at runtime', () => {
		const id: EntityId<'zone'> = createEntityId('zone');
		expect(typeof id).toBe('string');
	});

	it('never collides across many calls', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(createEntityId('asset'));
		}
		expect(seen.size).toBe(1000);
	});

	it('sorts IDs lexicographically in generation order — including within one millisecond', () => {
		const ids: string[] = [];
		for (let i = 0; i < 200; i++) {
			ids.push(createEntityId('zone'));
		}
		const sorted = ids.toSorted();
		expect(sorted).toEqual(ids);
	});
});
