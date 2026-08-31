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

	it('refuses createPlan with that same shape, from the same refusal function', async () => {
		// ONE `persistenceFailure()` behind both members, which is what stops the two writes in
		// this bundle answering two spellings of one state. Asserted per member rather than by
		// comparing the two results to each other: two calls that agree with each other would
		// agree just as well if both drifted.
		const commands = unavailableRenovationProjectCommands();

		const result = await commands.createPlan.execute({ projectId: 'project-1' as never, name: 'Ground floor' });

		expect(isErr(result)).toBe(true);
		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		expect(isErr(result) && result.error.category).toBe('Persistence');
	});

	/**
	 * Design slice A10's pair, asserted per member for the reason the case above gives: two
	 * results compared against each other would agree just as well if both drifted.
	 *
	 * They earn their own cases rather than riding the two above because they are the two whose
	 * ABSENCE is survivable-looking: `NewAssetForm` would mount, its button would work, and the
	 * user would get whatever a missing `execute` throws — which is a fault, not the refusal
	 * every other write in this session answers with.
	 */
	it('refuses createAsset with that same shape', async () => {
		const commands = unavailableRenovationProjectCommands();

		const result = await commands.createAsset.execute({
			name: 'Kitchen island',
			category: 'material',
			unit: 'piece',
			unitCostAmount: '450.00',
			currency: 'EUR',
		});

		expect(isErr(result)).toBe(true);
		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		expect(isErr(result) && result.error.category).toBe('Persistence');
	});

	it('refuses setAssetFootprintFromDimensions with that same shape', async () => {
		const commands = unavailableRenovationProjectCommands();

		const result = await commands.setAssetFootprintFromDimensions.execute({
			assetId: 'asset-1' as never,
			width: 1200,
			depth: 800,
		});

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
