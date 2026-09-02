import { describe, expect, it, vi } from 'vitest';
import { SetAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { err } from '../../../../src/core/result/Result';
import { persistenceError } from '../../../../src/application/errors';
import { of as moneyOf, currencyOf } from '../../../../src/core/money/Money';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { AssetPriceOverride } from '../../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId, type AssetPriceOverrideId } from '../../../../src/domain/asset-price/AssetPriceOverrideId';
import { expectOk, injectedReadFailure, RecordingEventBus } from '../../../helpers/domain';
import { makeAsset, makeProject } from '../../../helpers/entities';
import { makeOverride } from '../../../contracts/asset-price-override-repository.contract';

/**
 * Deps built from the in-memory repositories and a recording bus, following the sibling
 * command tests under tests/application/commands/requirement/. A fresh GBP project and an
 * EUR-priced catalogue asset — the currency mismatch is exactly what the coherence rule
 * (spec Decision 2) exists to refuse.
 */
async function wired() {
	const projects = new InMemoryProjectRepository();
	const assets = new InMemoryAssetRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const bus = new RecordingEventBus();
	const locks = new ReferenceLocks();
	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('GBP') }), 'absent'),
	);
	const asset = expectOk(await assets.save(makeAsset(), 'absent'));
	const command = new SetAssetPriceOverrideCommand({ overrides, projects, assets, events: bus, locks });
	return {
		projectId: project.entity.id,
		assetId: asset.entity.id,
		projects,
		assets,
		overrides,
		bus,
		locks,
		command,
	};
}

/** The state a hand edit or a sync leaves: the same revision, a new observed token. */
function editNoteOutsideThePlugin(overrides: InMemoryAssetPriceOverrideRepository, id: AssetPriceOverrideId): void {
	overrides.poke(id);
}

describe('SetAssetPriceOverrideCommand', () => {
	it('creates an override for a pair that has none, and reports created', async () => {
		const { command, projectId, assetId } = await wired();
		const result = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		expect(result.created).toBe(true);
		// `result.override` is the entity the in-memory repository stored, holding the SAME
		// `Money` object `execute` was called with — no re-mapping. `moneyOf('19.50', ...)`
		// already normalized to '19.5' before the call, so that is what comes back (Task 1's
		// normalization note).
		expect(result.override.unitCost.amount).toBe('19.5');
	});

	it('replaces the existing override for a pair that has one, and reports created false', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		const second = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(second.created).toBe(false);
		expect(second.override.unitCost.amount).toBe('21');
		const listed = expectOk(await overrides.listByProject(projectId));
		expect(listed).toHaveLength(1);
	});

	/**
	 * The coherence rule, which is this command's rather than the entity's (spec Decision 2).
	 * Watch it fail with the check deleted: the entity accepts any currency by design, so
	 * nothing else in the suite refuses this.
	 */
	it('refuses a price that is not in the project currency', async () => {
		const { command, projectId, assetId } = await wired();
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'EUR'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.currency-mismatch');
	});

	it('refuses when the project is not there', async () => {
		const { command, assetId } = await wired();
		const result = await command.execute({
			projectId: createProjectId(),
			assetId,
			unitCost: moneyOf('1.00', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.project-not-found');
	});

	it('refuses when the asset is not there', async () => {
		const { command, projectId } = await wired();
		const result = await command.execute({
			projectId,
			assetId: createAssetId(),
			unitCost: moneyOf('1.00', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.asset-not-found');
	});

	/**
	 * The no-op set, and the rule the clear command already keeps: nothing to change, so nothing
	 * is written and nothing is announced. Assert ALL THREE — no publish, no revision bump, and
	 * `created: false` — because "the price is 19.50 afterwards" is equally true of the build
	 * that saves and cascades for nothing, which is what makes this case worth writing.
	 */
	it('writes nothing and announces nothing when the submitted price already holds', async () => {
		const { command, bus, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		bus.clear();
		const again = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(again.created).toBe(false);
		expect(again.version.revision).toBe(first.version.revision);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * The same rule against a DIFFERENT SPELLING of the same price. `createMoney` normalizes
	 * nothing, so `19.5` and `19.50` are two strings for one value — and a string comparison
	 * calls this a change, writes, publishes, and recalculates every requirement for the asset
	 * in the project. Watch it fail with the amount compared as a string.
	 */
	it('writes nothing when the submitted price differs only in spelling', async () => {
		const { command, bus, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		bus.clear();
		const again = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.5', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(again.version.revision).toBe(first.version.revision);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * And the ORDER, which one assertion on the case above cannot show: the expectation is
	 * checked BEFORE the no-op test, so a stale row is refused even when its value happens to
	 * match. Watch it fail with the two swapped — this passes, and the conditional write has
	 * quietly become conditional on the data.
	 */
	it('refuses a stale row even when the submitted price equals the stored one', async () => {
		const { command, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.revision-conflict');
		expect(first.version.revision).toBe(1);
	});

	it('publishes AssetPriceOverrideChanged carrying BOTH ids', async () => {
		const { command, bus, projectId, assetId } = await wired();
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		expect(bus.published).toContainEqual(
			expect.objectContaining({
				type: 'AssetPriceOverrideChanged',
				payload: { projectId, assetId },
			}),
		);
	});

	/**
	 * The stale row. The pair lock cannot see this one: it protects the command's own
	 * read-to-write window, and the window that matters opened when the section rendered.
	 * Watch it fail with the `expectationMismatch` call removed — without it the save conditions
	 * on the NEWEST revision and succeeds, erasing a price the user never saw.
	 */
	it('refuses a submission whose row was rendered before someone else moved the price', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		// Another leaf moves it while the user's row still shows 19.50.
		expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('30.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));

		const stale = await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		});
		expect(stale.ok).toBe(false);
		if (stale.ok) throw new Error('unreachable');
		expect(stale.error.code).toBe('asset-price.revision-conflict');

		// And the intervening price is untouched, which is the half that matters.
		const found = expectOk(await overrides.getForPair(projectId, assetId));
		// `moneyOf('30.00', ...)` normalizes to '30' (Task 1's normalization note).
		expect(found?.entity.unitCost.amount).toBe('30');
	});

	/**
	 * The arm a revision-only check misses, and the reason `observed` is compared: a hand edit
	 * or a sync changes the note without moving `revision`. `externalModification`, not
	 * `revisionConflict` — two codes because the recoveries differ.
	 */
	it('refuses when the note was edited outside the plugin without a revision bump', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const first = expectOk(
			await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
		);
		editNoteOutsideThePlugin(overrides, first.override.id); // same revision, new observed token
		const stale = await command.execute({
			projectId, assetId, unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		});
		expect(stale.ok).toBe(false);
		if (stale.ok) throw new Error('unreachable');
		expect(stale.error.code).toBe('asset-price.external-modification');
	});

	/**
	 * The arm the IDENTITY check exists for, reachable only because duplicates are tolerated:
	 * a different note wins the pair, at the same revision.
	 */
	it('refuses when a different note now wins the pair at the same revision', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const first = expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		// A second note for the same pair — the duplicate state the read tolerates. Both land
		// at revision 1: each note's version is independent of the other's.
		const second = expectOk(await overrides.save(makeOverride(projectId, assetId, '30.00'), 'absent'));
		expect(second.version.revision).toBe(first.version.revision);

		const result = await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('21.00', 'GBP'),
			// The row rendered the LOSING duplicate; the winner (higher id) has since taken
			// the pair, at the same revision — no version comparison alone can catch it.
			expected: { id: first.entity.id, version: first.version },
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.revision-conflict');
	});

	/** The other arm: a row that showed NO price, when someone else has since set one. */
	it('refuses an absent-expectation submission when a price now exists', async () => {
		const { command, projectId, assetId } = await wired();
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('30.00', 'GBP'), expected: 'absent' }));
		const stale = await command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP'), expected: 'absent' });
		expect(stale.ok).toBe(false);
	});

	/**
	 * The pair lock, driven as a real race: two executions started before either awaits. Both
	 * read `getForPair === null` without it, mint different ULIDs, and both inserts succeed
	 * under `'absent'` — the duplicate-pair state this design tolerates in a hand-edited vault
	 * and must never manufacture. Watch it fail with the `locks.acquire` removed.
	 */
	it('lets one racing create win and refuses the other, leaving one override', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const [a, b] = await Promise.all([
			command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
			command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP'), expected: 'absent' }),
		]);

		// **One ok, one conflict — not two oks.** An earlier draft asserted both succeeded,
		// which was written before the expectation check existed and contradicts it: the
		// second caller's row also said `'absent'`, and by the time the lock lets it through
		// a price exists, so its view is stale and it must be refused. Asserting two oks would
		// have invited weakening the very protection the round before added.
		const results = [a, b];
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		const refused = results.find((r) => !r.ok);
		expect(refused && !refused.ok && refused.error.code).toBe('asset-price.revision-conflict');
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(1);
	});

	/**
	 * The LOCK is still what this pair proves, and it is worth saying which mutation reddens
	 * which: without the lock both callers read `null`, both satisfy `'absent'`, and both
	 * create — two oks and two notes. Without the expectation check the second overwrites
	 * rather than refusing — two oks and one note. The assertions above discriminate all three
	 * outcomes, which one `toHaveLength(1)` alone would not.
	 */

	/**
	 * A failed WRITE must not announce. Otherwise the cascade recalculates against a price
	 * that was never persisted, and every requirement it touches is derived from a figure no
	 * note holds.
	 */
	it('publishes nothing when the save fails', async () => {
		const { command, overrides, bus, projectId, assetId } = await wired();
		vi.spyOn(overrides, 'save').mockResolvedValue(err(persistenceError('asset-price.write-failed', 'no')));
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
	});

	it('surfaces a failed project read rather than a missing project', async () => {
		const { command, projects, assetId } = await wired();
		vi.spyOn(projects, 'getById').mockResolvedValue(injectedReadFailure());
		const result = await command.execute({
			projectId: createProjectId(),
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('test.injected-failure');
	});

	it('surfaces a failed asset read rather than a missing asset', async () => {
		const { command, assets, projectId } = await wired();
		vi.spyOn(assets, 'getById').mockResolvedValue(injectedReadFailure());
		const result = await command.execute({
			projectId,
			assetId: createAssetId(),
			unitCost: moneyOf('19.50', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('test.injected-failure');
	});

	it('surfaces a failed read of the existing override', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		vi.spyOn(overrides, 'getForPair').mockResolvedValue(injectedReadFailure());
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('test.injected-failure');
	});

	/** The entity's own guard (a unit cost cannot be negative), reached through the command. */
	it('refuses a negative unit cost', async () => {
		const { command, projectId, assetId } = await wired();
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('-5.00', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.negative-unit-cost');
	});

	/**
	 * `samePrice` compares currency BEFORE value (see its header): a note stranded at a
	 * currency the project no longer holds is never "unchanged" against a submission in the
	 * project's own currency, whatever the numbers say. Reached without a currency-mismatch
	 * refusal because the SUBMITTED price is in the project's currency — only the STORED one
	 * has drifted, which a project currency change (out of this command's reach) is what
	 * would produce in a real vault.
	 */
	it('treats a stranded override at a different currency as a change, not a no-op', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const stranded = expectOk(
			AssetPriceOverride.create({
				id: createAssetPriceOverrideId(),
				projectId,
				assetId,
				unitCost: moneyOf('19.50', 'EUR'),
			}),
		);
		const saved = expectOk(await overrides.save(stranded, 'absent'));
		const result = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: { id: saved.entity.id, version: saved.version },
		}));
		expect(result.created).toBe(false);
		expect(result.override.unitCost.currency).toBe('GBP');
		expect(result.version.revision).toBe(saved.version.revision + 1);
	});
});
