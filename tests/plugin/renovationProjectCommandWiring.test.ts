/**
 * What tells a composition that wires the project view's write side from one that does not.
 *
 * Slice 10's `slice10CascadeWiring.test.ts` is the pattern: a collaborator that is built,
 * tested and passed by nothing is a collaborator that reaches nobody.
 */
import { describe, expect, it } from 'vitest';
import { unavailableRenovationProjectCommands } from '../../src/presentation/views/renovationProjectCommands';
import { isErr } from '../../src/core/result/Result';

describe('unavailableRenovationProjectCommands', () => {
	it('refuses createProject with the same settings.unrecovered shape every other write uses', async () => {
		const commands = unavailableRenovationProjectCommands();

		const result = await commands.createProject.execute({ name: 'Kitchen' });

		expect(isErr(result)).toBe(true);
		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		expect(isErr(result) && result.error.category).toBe('Persistence');
	});

	it('resolves a failed Result rather than throwing', async () => {
		const commands = unavailableRenovationProjectCommands();

		// A refusal, never a rejection: the whole point of the boundary.
		await expect(commands.createProject.execute({ name: '' })).resolves.toBeDefined();
	});

	it('carries a logger that records nothing and refuses nothing', () => {
		// The bundle is TOTAL — `NewProjectForm` requires a logger, so a member missing here
		// would make the form unmountable in exactly the session that has no persistence, which
		// is the one state nothing else in the app can recover from either. It records nothing
		// because this bundle's only failure is the resolved refusal above, never a fault; that
		// it is safe to CALL is the property, and a no-op that throws would be neither.
		const { logger } = unavailableRenovationProjectCommands();

		expect(() => {
			logger.debug('e');
			logger.info('e');
			logger.warn('e');
			logger.error('e', { cause: new Error('ignored') });
		}).not.toThrow();
	});
});
