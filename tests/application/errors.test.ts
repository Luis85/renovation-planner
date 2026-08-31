import { describe, expect, it } from 'vitest';
import { persistenceError } from '../../src/application/errors';
import { persistenceError as fromNoteIo } from '../../src/infrastructure/obsidian/repositories/noteIo';

describe('persistenceError', () => {
	it('is one definition with two importers', () => {
		expect(fromNoteIo).toBe(persistenceError);
	});

	it('omits `cause` entirely when none is given', () => {
		expect('cause' in persistenceError('zone.listing-incomplete', 'x')).toBe(false);
	});

	it('carries a cause when one is given', () => {
		const boom = new Error('boom');
		expect(persistenceError('zone.listing-incomplete', 'x', boom).cause).toBe(boom);
	});
});
