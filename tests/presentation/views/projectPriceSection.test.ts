/**
 * @vitest-environment jsdom
 *
 * The price section MOUNTED — hydrated, re-read when something outside this pane moves a price,
 * and dispatching through the detail state's own write path.
 *
 * `assetPriceList.test.ts` drives the component; this file drives the wiring around it, which is
 * where the two subscriptions and the narrowing live. Both are asserted as BEHAVIOUR — what the
 * section draws, and what it asks the query — rather than as "a subscribe was called", because a
 * subscription registered and never acted on looks identical from the wiring side.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import {
	RENOVATION_PROJECT_CONTEXT,
	type RenovationProjectDeps,
} from '../../../src/presentation/views/RenovationProjectContext';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { createMoney, type Money } from '../../../src/core/money/Money';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import type { ObservationToken } from '../../../src/application/ports/versioning';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import { t } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';

const PROJECT_ID = 'project-1';
const OTHER_PROJECT_ID = 'project-2';

const PROJECT: ProjectSummaryDto = {
	id: PROJECT_ID,
	name: 'Hallway',
	status: 'IDEA',
	currency: 'GBP',
	libraryOverlap: false,
};

function money(amount: string, currency = 'GBP'): Money {
	const minted: Result<Money, ValidationError> = createMoney(amount, currency);
	if (!minted.ok) throw new Error('unmintable fixture');
	return minted.value;
}

function priceRow(override: Money | null): AssetPriceRowDto {
	return {
		assetId: 'a1',
		assetName: 'Oak flooring',
		catalogue: money('24.00'),
		override,
		overrideId: override === null ? null : ('op-1' as AssetPriceOverrideId),
		overrideVersion: override === null ? null : { revision: 1, observed: 'observed-1' as ObservationToken },
		assetStatus: 'known',
	};
}

interface Harness {
	wrapper: VueWrapper;
	/** Every registered price listener, so a case can publish into the section. */
	pricesChanged: (projectId: string | null) => void;
	catalogueChanged: () => void;
	listAssetPrices: ReturnType<typeof vi.fn>;
	/** Moves what the next `listAssetPrices` answers. */
	setRows: (rows: readonly AssetPriceRowDto[]) => void;
	setAssetPriceOverride: ReturnType<typeof vi.fn>;
	clearAssetPriceOverride: ReturnType<typeof vi.fn>;
}

/**
 * The detail state, mounted on one project with a live price query.
 *
 * Over `defaultRenovationProjectDeps()` rather than a hand-built literal, for that factory's own
 * stated reason: it is the one place an honest default per member is written down, so a widened
 * `RenovationProjectDeps` reaches this file the day it is written rather than as an `undefined`
 * nothing reports.
 *
 * `hold` is what makes the burst case expressible: with it set, `listAssetPrices` does not
 * resolve until the case releases it, which is the in-flight window a sync arrives during.
 */
async function mountSection(options: {
	rows?: readonly AssetPriceRowDto[];
	hold?: Promise<void>;
	listAssetPrices?: () => Promise<Result<readonly AssetPriceRowDto[], RepositoryError>>;
} = {}): Promise<Harness> {
	let rows: readonly AssetPriceRowDto[] = options.rows ?? [priceRow(null)];
	const listAssetPrices = vi.fn<() => Promise<Result<readonly AssetPriceRowDto[], RepositoryError>>>(
		options.listAssetPrices ??
			(async () => {
				if (options.hold !== undefined) await options.hold;
				return ok([...rows]);
			}),
	);
	const priceListeners: ((projectId: string | null) => void)[] = [];
	const catalogueListeners: (() => void)[] = [];
	const setAssetPriceOverride = vi.fn<(input: unknown) => Promise<unknown>>(() =>
		Promise.resolve(
			ok({
				override: { id: 'op-9' as AssetPriceOverrideId },
				created: true,
				version: { revision: 4, observed: 'observed-4' as ObservationToken },
			}),
		),
	);
	const clearAssetPriceOverride = vi.fn<(input: unknown) => Promise<unknown>>(
		() => Promise.resolve(ok({ cleared: true })),
	);

	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: PROJECT_ID,
		queries: {
			...base.queries,
			getProject: () => Promise.resolve(ok(PROJECT)),
			listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
			listAssetPrices: listAssetPrices as RenovationProjectDeps['queries']['listAssetPrices'],
		},
		commands: {
			...base.commands,
			setAssetPriceOverride: {
				execute: setAssetPriceOverride,
			} as unknown as RenovationProjectDeps['commands']['setAssetPriceOverride'],
			clearAssetPriceOverride: {
				execute: clearAssetPriceOverride,
			} as unknown as RenovationProjectDeps['commands']['clearAssetPriceOverride'],
		},
		onCatalogueChanged: (listener) => {
			catalogueListeners.push(listener);
			return () => undefined;
		},
		onProjectPricesChanged: (listener) => {
			priceListeners.push(listener);
			return () => undefined;
		},
	};

	setActivePinia(createPinia());
	const wrapper = mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	await flushPromises();
	return {
		wrapper,
		pricesChanged: (projectId) => {
			for (const listener of priceListeners) listener(projectId);
		},
		catalogueChanged: () => {
			for (const listener of catalogueListeners) listener();
		},
		listAssetPrices,
		setRows: (next) => {
			rows = next;
		},
		setAssetPriceOverride,
		clearAssetPriceOverride,
	};
}

describe('the project detail state’s price section', () => {
	it('draws the rows it read at mount', async () => {
		const { wrapper } = await mountSection({ rows: [priceRow(money('19.50'))] });

		expect(wrapper.get('.rp-asset-price-title').text()).toBe(t('en', 'view.project.prices-title'));
		expect((wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('19.50');
	});

	/**
	 * A failed price read replaces the LIST and nothing else. A project whose prices could not be
	 * read is still a project the user can look at and work in, so this must not take the header,
	 * the plans or the way back with it — which is what asserting `.rp-project-detail__back` here
	 * makes a statement about rather than a decoration.
	 */
	it('replaces only the list when the price read fails, keeping the project drawn', async () => {
		const refusal: RepositoryError = {
			category: 'Persistence',
			code: 'asset-price.frontmatter-invalid',
			message: 'developer English',
		};
		const { wrapper } = await mountSection({ listAssetPrices: () => Promise.resolve(err(refusal)) });

		expect(wrapper.get('.rp-asset-price-failure').text()).toBe(trError(refusal));
		expect(wrapper.find('.rp-asset-price-list').exists()).toBe(false);
		expect(wrapper.find('.rp-project-detail__back').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__name').exists()).toBe(true);
	});

	/**
	 * **The half no COMMAND can raise.** A price note added by hand, copied in, or arriving
	 * through sync publishes no domain event at all — `VaultChangeAdapter` is the sole index
	 * writer for those — and that arm of the source can name no project, so it delivers `null`.
	 * `null` is a MATCH; without that arm this pane draws the vault it read at mount for the life
	 * of the leaf.
	 */
	it('rehydrates the price rows when a price note changes out of band', async () => {
		const harness = await mountSection({ rows: [priceRow(null)] });
		expect(harness.listAssetPrices).toHaveBeenCalledTimes(1);

		harness.setRows([priceRow(money('30.00'))]);
		harness.pricesChanged(null);
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
		expect((harness.wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('30.00');
	});

	/**
	 * This project's OWN price, moved by this plugin's own command in another leaf. The domain
	 * event names the project, so it matches by id rather than by the `null` arm above.
	 */
	it('rehydrates when this project’s own price changes', async () => {
		const harness = await mountSection();

		harness.setRows([priceRow(money('30.00'))]);
		harness.pricesChanged(PROJECT_ID);
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
		expect((harness.wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('30.00');
	});

	/**
	 * **The NEGATIVE direction, and it is the one that matters.** Without it the filter is
	 * untested: every other case in this file passes against a build that re-reads for every
	 * event, which is exactly the behaviour Ruling 15 exists to end — a price set in project A
	 * re-reading the whole catalogue in every open pane for project B.
	 *
	 * Watched failing with the filter defeated (the listener re-reading unconditionally): the
	 * count then reads 2 at the assertion below.
	 */
	it('does not rehydrate for another project’s price', async () => {
		const harness = await mountSection();

		harness.pricesChanged(OTHER_PROJECT_ID);
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(1);
	});

	it('rehydrates when the catalogue changes', async () => {
		const harness = await mountSection();

		harness.setRows([priceRow(money('30.00'))]);
		harness.catalogueChanged();
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
	});

	/**
	 * The BURST. `ProjectIndexEntryChanged` fires once per note and BOTH sources are subscribed to
	 * it, so a vault syncing a large catalogue delivers one event per arriving note — and a build
	 * that handed each callback straight to the store's ticket would launch one whole price-list
	 * scan per note, all concurrent, every one but the last discarded AFTER its reads had already
	 * happened.
	 *
	 * TWO reads: the one already running and one trailing. The mount's read is held open for the
	 * whole burst, which is what makes this the in-flight window rather than twenty sequential
	 * reads.
	 */
	it('answers a burst of index changes with one trailing read', async () => {
		let release: (() => void) | undefined;
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const harness = await mountSection({ hold });

		for (let i = 0; i < 10; i += 1) {
			harness.pricesChanged(null);
			harness.catalogueChanged();
		}
		release?.();
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
	});

	/**
	 * The write path end to end: a typed price reaches the guarded command with this project's id
	 * and the row's expectation, and the section RE-READS so the price the user just set appears.
	 *
	 * The re-read is asserted rather than left to `onProjectPricesChanged`: relying on the
	 * subscription would make this gesture's own refresh depend on the event bus round trip, and
	 * a price that appeared or did not according to delivery order is indistinguishable from a
	 * create that silently failed.
	 */
	it('dispatches a set through the guarded command and re-reads', async () => {
		const harness = await mountSection({ rows: [priceRow(null)] });

		harness.setRows([priceRow(money('19.50'))]);
		const input = harness.wrapper.get('.rp-asset-price-input');
		await input.setValue('19.50');
		await input.trigger('blur');
		await flushPromises();

		expect(harness.setAssetPriceOverride).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: PROJECT_ID,
				assetId: 'a1',
				expected: 'absent',
				unitCost: expect.objectContaining({ amount: '19.50', currency: 'GBP' }),
			}),
		);
		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
		expect((harness.wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('19.50');
	});

	/**
	 * A REFUSED set establishes nothing, so `commitAssetPrice` answers `settled: null` and the
	 * row's frozen snapshot stays exactly where it was. Asserted on the re-read count rather than
	 * on the returned shape: a refusal must not buy a read either, because there is nothing new
	 * to see.
	 */
	it('does not re-read when the set refuses', async () => {
		const harness = await mountSection();
		harness.setAssetPriceOverride.mockResolvedValue(
			err({ category: 'Validation', code: 'asset-price.currency-mismatch', message: 'dev' }),
		);

		const input = harness.wrapper.get('.rp-asset-price-input');
		await input.setValue('19.50');
		await input.trigger('blur');
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(1);
		expect((harness.wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('19.50');
	});

	/** The same on the other command. */
	it('does not re-read when the clear refuses', async () => {
		const harness = await mountSection({ rows: [priceRow(money('19.50'))] });
		harness.clearAssetPriceOverride.mockResolvedValue(
			err({ category: 'Validation', code: 'asset-price.revision-conflict', message: 'dev' }),
		);

		await harness.wrapper.get('.rp-asset-price-clear').trigger('click');
		await flushPromises();

		expect(harness.listAssetPrices).toHaveBeenCalledTimes(1);
	});

	/**
	 * **A clear that removed nothing reports `'no-write'`.** `ClearAssetPriceOverrideCommand`
	 * answers `cleared: false` for a pair with no override, writes nothing and publishes nothing
	 * by its own design — so reporting `'wrote'` for it would be this seam claiming a vault
	 * change the command explicitly declined to make. The pair still settles as `'absent'`, which
	 * is what an expectation states about it either way.
	 */
	it('reports no-write for a clear that removed nothing', async () => {
		const harness = await mountSection({ rows: [priceRow(money('19.50'))] });
		harness.clearAssetPriceOverride.mockResolvedValue(ok({ cleared: false }));

		await harness.wrapper.get('.rp-asset-price-clear').trigger('click');
		await flushPromises();

		// The gesture still ran and still re-read: nothing failed, there was simply nothing to
		// remove.
		expect(harness.clearAssetPriceOverride).toHaveBeenCalledTimes(1);
		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
	});

	/** The other command, through the same seam and the same re-read. */
	it('dispatches a clear through the guarded command and re-reads', async () => {
		const harness = await mountSection({ rows: [priceRow(money('19.50'))] });

		harness.setRows([priceRow(null)]);
		await harness.wrapper.get('.rp-asset-price-clear').trigger('click');
		await flushPromises();

		expect(harness.clearAssetPriceOverride).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: PROJECT_ID,
				assetId: 'a1',
				expected: { id: 'op-1', version: { revision: 1, observed: 'observed-1' } },
			}),
		);
		expect(harness.listAssetPrices).toHaveBeenCalledTimes(2);
		expect((harness.wrapper.get('.rp-asset-price-input').element as HTMLInputElement).value).toBe('');
	});
});
