import { describe, expect, it } from 'vitest';
import { DeleteAssetCommand } from '../../../src/application/commands/asset/DeleteAsset';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import { expectErr, expectOk } from '../../helpers/domain';
import { assetSequenceCollaborators, assignedRequirementFixture } from '../../helpers/slice10';

/**
 * Split from `deleteAssetRefusals.test.ts`, which sits at the tests/ line-budget cap (450
 * counted lines — CLAUDE.md's tests/ budget note): both cases here extend that file's own
 * "refuses to delete an asset a plan names as a wall or opening material" case in ways it
 * does not reach — the user-facing COPY (ADR-0031, spec §6.8 says the refusal names the
 * plans), and the `materialUsers` read itself failing rather than answering non-empty.
 * Reuses `assignedRequirementFixture`/`assetSequenceCollaborators` from `tests/helpers/slice10.ts`
 * rather than the sibling file's private `wiredAssetWithLink`, which is the same shape.
 */

function silentLogger() {
	return { debug() {}, info() {}, warn() {}, error() {} };
}

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

describe('DeleteAssetCommand material-in-use refusal', () => {
	it('names the plan in the user-facing message, not only the error code', async () => {
		const w = await assignedRequirementFixture();
		const command = new DeleteAssetCommand({ ...assetSequenceCollaborators(),
			assets: w.assets, requirements: w.requirements, recalculate: w.recalculate, events: w.events,
			locks: w.locks, logger: silentLogger(), overrides: w.overrides,
			materialUsers: () => Promise.resolve({ ok: true, value: ['Ground floor'] }) });
		const error = expectErr(await command.execute({ assetId: w.assetId, resolution: 'delete-anyway' }));
		expect(toUserMessage('en', error)).toContain('Ground floor');
	});

	it('propagates a failed materialUsers read before touching anything', async () => {
		const w = await assignedRequirementFixture();
		const command = new DeleteAssetCommand({ ...assetSequenceCollaborators(),
			assets: w.assets, requirements: w.requirements, recalculate: w.recalculate, events: w.events,
			locks: w.locks, logger: silentLogger(), overrides: w.overrides,
			materialUsers: () => Promise.resolve({ ok: false, error: injectedPersistenceError() }) });
		const error = expectErr(await command.execute({ assetId: w.assetId, resolution: 'delete-anyway' }));
		expect(error.code).toBe('test.injected-failure');
		expect(expectOk(await w.assets.getById(w.assetId))).not.toBeNull();
	});
});
