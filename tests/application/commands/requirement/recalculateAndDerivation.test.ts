import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../../src/core/result/Result';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { CreateAssetCommand } from '../../../../src/application/commands/asset/CreateAsset';
import { DeleteRequirementCommand } from '../../../../src/application/commands/requirement/DeleteRequirement';
import {
	assetMatchesCalculatedFrom,
	deriveRequirementFigures,
} from '../../../../src/application/commands/requirement/deriveRequirementFigures';
import { ListReassignmentTargets } from '../../../../src/application/queries/ListReassignmentTargets';
import { currencyOf, of as moneyOf } from '../../../../src/core/money/Money';
import { expectErr, expectFound, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { makeAsset, makeRequirement } from '../../../helpers/entities';
import { requirementFixture } from '../../../helpers/slice10';
import {
	overridePort,
	withConflictingReads,
	wiredWithLink,
	wiredZoneFor,
} from './refusalFixtures';

/**
 * The recalculation, derivation and picker arms of slice 10's refusal suite -- split out
 * of `requirementRefusals.test.ts` when the file crossed the line budget. The fixtures
 * are shared verbatim; a seam change lands once.
 */

describe('RecalculateRequirementCommand refusals', () => {
	it('propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new RecalculateRequirementCommand({
				requirements,
				zones: w.zones,
				assets: w.assets,
				events: w.events,
				projects: w.projects,
				overrides: w.overrides,
			}).execute({
				requirementId: w.requirementId,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	/**
	 * Unlike `AssignAsset.ts`, which propagates a failed project read as itself, this
	 * command wraps BOTH a failed read and a missing project as `requirement.project-gone`
	 * — the same shape `loadZone`/`loadAsset` already give `requirement.zone-gone` and
	 * `requirement.asset-gone` above. Deliberately left as-is; the asymmetry with
	 * `AssignAsset` is recorded for the whole-branch review rather than changed here.
	 */
	it('propagates a failed project read as requirement.project-gone', async () => {
		const w = await wiredWithLink();
		const projects = overridePort(w.projects, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new RecalculateRequirementCommand({
				requirements: w.requirements,
				zones: w.zones,
				assets: w.assets,
				events: w.events,
				projects,
				overrides: w.overrides,
			}).execute({ requirementId: w.requirementId }),
		);
		expect((error as { code: string }).code).toBe('requirement.project-gone');
	});

	it('wraps a vanished zone as requirement.zone-gone', async () => {
		const w = await wiredWithLink();
		const zone = expectFound(await w.zones.getById(w.zoneId));
		expectOk(await w.zones.delete(w.zoneId, zone.version));
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect(error.category).toBe('Calculation');
		expect((error as { code: string }).code).toBe('requirement.zone-gone');
	});

	it('wraps a vanished asset as requirement.asset-gone', async () => {
		const w = await wiredWithLink();
		const asset = expectFound(await w.assets.getById(w.assetId));
		expectOk(await w.assets.delete(w.assetId, asset.version));
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toBe('requirement.asset-gone');
	});

	it('wraps a vanished project as requirement.project-gone', async () => {
		const w = await wiredWithLink();
		expectOk(await w.projects.delete(w.project.entity.id, w.project.version));
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toBe('requirement.project-gone');
	});

	it('wraps a failing area computation as requirement.area-failed', async () => {
		const w = await wiredWithLink();
		const stored = expectFound(await w.zones.getById(w.zoneId));
		Object.assign(stored?.entity as object, {
			area: () => ({ ok: false, error: { category: 'Calculation', code: 'test.no-area', message: 'x' } }),
		});
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toBe('requirement.area-failed');
	});

	it('refuses figures a hand-tampered waste factor cannot produce', async () => {
		const w = await wiredWithLink();
		const stored = expectOk(await w.requirements.getById(w.requirementId));
		Object.assign(stored?.entity as object, { wasteFactor: new Decimal('-0.05') });
		const error = expectErr(await w.recalculate.execute({ requirementId: w.requirementId }));
		expect((error as { code: string }).code).toContain('negative');
	});

	it('propagates a lost race on its conditional save', async () => {
		const w = await wiredWithLink();
		const error = expectErr(
			await new RecalculateRequirementCommand({
				requirements: withConflictingReads(w.requirements),
				zones: w.zones,
				assets: w.assets,
				events: w.events,
				projects: w.projects,
				overrides: w.overrides,
			}).execute({ requirementId: w.requirementId }),
		);
		expect(error.category).toBe('Validation');
	});
});

describe('DeleteRequirementCommand error propagation', () => {
	it('propagates a failed read', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new DeleteRequirementCommand(requirements, w.events).execute({ requirementId: w.requirementId }),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a refused delete', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			delete: () => Promise.resolve(err(injectedPersistenceError())),
		});
		// This is the case that actually reaches the write: `loadRequirement` succeeds and
		// `delete` is what refuses, so a build that published right after the load — before
		// checking whether the delete itself succeeded — would still pass every case in
		// deleteRequirement.test.ts, which never gets this far. Clearing first drops the
		// events wiredWithLink's own assign already published.
		w.events.clear();
		const error = expectErr(
			await new DeleteRequirementCommand(requirements, w.events).execute({ requirementId: w.requirementId }),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(w.events.published).toEqual([]);
	});
});

describe('deriveRequirementFigures stage refusals', () => {
	it('refuses a negative raw area at the measurement stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: -1000,
			assetUnit: 'm2',
			unitCost: moneyOf('45.00', 'EUR'),
			wasteFactor: new Decimal('0.10'),
			expectedCurrency: currencyOf('EUR'),
		});
		expect(result).toMatchObject({ ok: false, error: { code: 'quantity.negative' } });
	});

	it('refuses a negative waste factor at the waste stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: 10_000_000,
			assetUnit: 'm2',
			unitCost: moneyOf('45.00', 'EUR'),
			wasteFactor: new Decimal('-0.10'),
			expectedCurrency: currencyOf('EUR'),
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected a refusal');
		expect(result.error.code).toContain('negative');
	});

	it('refuses a negative recorded price at the cost stage', () => {
		const result = deriveRequirementFigures({
			zoneAreaMm2: 10_000_000,
			assetUnit: 'm2',
			unitCost: moneyOf('-45.00', 'EUR'),
			wasteFactor: new Decimal('0.10'),
			expectedCurrency: currencyOf('EUR'),
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected a refusal');
		expect(result.error.code).toContain('cost.negative');
	});

	it('assetMatchesCalculatedFrom compares amount, currency AND unit symbol', () => {
		const calculatedFrom = {
			zoneArea: { value: new Decimal(10), unit: 'm2' as const },
			unitCost: moneyOf('45.00', 'EUR'),
			assetUnit: 'm2' as const,
		};
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'EUR'), unit: 'm2' })).toBe(true);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('30.00', 'EUR'), unit: 'm2' })).toBe(false);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'USD'), unit: 'm2' })).toBe(false);
		expect(assetMatchesCalculatedFrom(calculatedFrom, { unitCost: moneyOf('45.00', 'EUR'), unit: 'm' })).toBe(false);
	});
});

describe('CreateAssetCommand save refusals', () => {
	it('propagates a refused create save', async () => {
		const w = await requirementFixture();
		const assets = overridePort(w.assets, {
			save: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const error = expectErr(
			await new CreateAssetCommand(assets, w.events).execute({
				name: 'Grout',
				category: 'material',
				unit: 'piece',
				unitCostAmount: '2.50',
				currency: 'EUR',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('InMemoryRequirementRepository.markStale validation arm', () => {
	it('refuses to mark stale a record whose fields no longer construct', async () => {
		const w = await requirementFixture();
		const { zoneId } = await wiredZoneFor(w);
		const requirement = makeRequirement({
			projectId: w.project.entity.id,
			assetId: 'asset-x' as never,
			origin: { kind: 'zone', zoneId },
		});
		expectOk(await w.requirements.save(requirement, 'absent'));
		// A hand edit that breaks the smart constructor must fail the MARKER WRITE,
		// loudly -- not silently leave the entity as it was.
		const stored = expectOk(await w.requirements.getById(requirement.id));
		Object.assign(stored?.entity as object, { requiredDate: 'not a date' });

		const error = expectErr(await w.requirements.markStale(requirement.id));
		expect(error.code).toBe('requirement.mark-stale-invalid');
	});
});

describe('picker query supplement', () => {
	it('ListReassignmentTargets maps area-kind assets other than the deleted one', async () => {
		const w = await wiredWithLink();
		const replacement = expectOk(
			await w.assets.save(
				makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			),
		);
		const targets = expectOk(
			await new ListReassignmentTargets(w.zones, w.assets).execute({ kind: 'asset', assetId: w.assetId }),
		);
		expect(targets.map((target) => target.id)).toEqual([replacement.entity.id]);
	});
});
