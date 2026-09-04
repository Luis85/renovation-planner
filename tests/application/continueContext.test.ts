import { describe, expect, it } from 'vitest';
import { parseContinueContext } from '../../src/application/continueContext';

describe('parseContinueContext', () => {
	it('reads a whole context', () => {
		expect(parseContinueContext({ projectId: 'p1', planId: 'plan-1' })).toEqual({
			projectId: 'p1',
			planId: 'plan-1',
		});
	});

	it('reads a project-only context, planId absent', () => {
		expect(parseContinueContext({ projectId: 'p1' })).toEqual({ projectId: 'p1', planId: null });
	});

	it('falls back to ABSENT for anything it does not recognise', () => {
		// The parse-and-fall-back-to-absent rule §13 asks for. A malformed context is not an
		// error a user can act on and not a state worth reporting: the Continue group simply
		// does not render, which is a state the surface already draws for a fresh vault.
		for (const raw of [null, undefined, 42, 'p1', {}, { projectId: '' }, { projectId: 7 }]) {
			expect(parseContinueContext(raw)).toBeNull();
		}
	});

	it('drops a planId that is not a non-empty string rather than refusing the whole context', () => {
		// The project half is still usable, and Continue on a project is a real gesture.
		expect(parseContinueContext({ projectId: 'p1', planId: 7 })).toEqual({
			projectId: 'p1',
			planId: null,
		});
	});

	it('drops an empty-string planId the same way', () => {
		expect(parseContinueContext({ projectId: 'p1', planId: '' })).toEqual({
			projectId: 'p1',
			planId: null,
		});
	});
});
