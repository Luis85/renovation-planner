/**
 * The fixtures the P04 price-section suites share: one row DTO, one mounted `AssetPriceList`,
 * and the gesture that opens a row's editor.
 *
 * A MODULE rather than a copy in each file. `assetPriceList.test.ts` reached the 450-line test
 * budget when P04's parity cases landed beside it, and the seam this repository already takes
 * for that (`tests/harness/accessibilityAssetLibrary.test.ts` beside `accessibility.test.ts`)
 * shares its options through a module for the reason that applies here too: two copies of a row
 * fixture are two definitions of what the query produces, and they drift silently.
 */
import { vi } from 'vitest';
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import AssetPriceList from '../../../src/presentation/views/AssetPriceList.vue';
import { createMoney, type Money } from '../../../src/core/money/Money';
import { ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { Logger } from '../../../src/application/ports/Logger';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import type { EntityVersion, ObservationToken } from '../../../src/application/ports/versioning';
import type {
	AssetPriceCommitResult,
	AssetPriceEdit,
} from '../../../src/presentation/views/assetPriceEdit';

const logger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};

/**
 * `createMoney` rather than `of`, and this is the constructor the component itself mints with —
 * a fixture built through the other door could hold an amount the component's own validator
 * refuses, which is the disagreement this whole file is partly about.
 */
export function money(amount: string, currency = 'GBP'): Money {
	const minted: Result<Money, ValidationError> = createMoney(amount, currency);
	if (!minted.ok) throw new Error(`unmintable fixture: ${amount} ${currency}`);
	return minted.value;
}

export const version = (revision: number): EntityVersion => ({
	revision,
	observed: `observed-${revision}` as ObservationToken,
});

export interface RowOptions {
	assetId?: string;
	assetName?: string | null;
	catalogue?: Money | null;
	override?: Money | null;
	overrideRevision?: number;
	assetStatus?: AssetPriceRowDto['assetStatus'];
}

/**
 * One row, ANNOTATED as the DTO the component's prop declares, so a member the query grows is a
 * compile error here rather than an `undefined` the template reads happily.
 *
 * `overrideId`/`overrideVersion` are derived from `override` rather than taken separately: the
 * three travel together on the real DTO — an override IS a note at a version — and a fixture
 * that could spell a price with no id would be a row the query never produces.
 */
export function row(over: RowOptions = {}): AssetPriceRowDto {
	const override = over.override ?? null;
	return {
		assetId: over.assetId ?? 'a1',
		assetName: over.assetName === undefined ? 'Oak flooring' : over.assetName,
		catalogue: over.catalogue === undefined ? money('24.00') : over.catalogue,
		override,
		overrideId: override === null ? null : ('op-1' as AssetPriceOverrideId),
		overrideVersion: override === null ? null : version(over.overrideRevision ?? 1),
		assetStatus: over.assetStatus ?? 'known',
	};
}

/** A commit that accepts everything and reports the pair it left behind. */
export const accepts = (): AssetPriceCommitResult => ({
	dispatch: ok('wrote'),
	settled: { id: 'op-2' as AssetPriceOverrideId, version: version(9) },
});

export function mountSection(options: {
	rows?: readonly AssetPriceRowDto[];
	currency?: string;
	commit?: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
	refreshBlocked?: boolean;
	/** `document.activeElement` only tracks an attached element — pass a live host to assert focus. */
	attachTo?: Element;
} = {}) {
	const commit = vi.fn<(edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>>(
		options.commit ?? (() => Promise.resolve(accepts())),
	);
	const wrapper = mount(AssetPriceList, {
		props: {
			rows: options.rows ?? [row()],
			currency: options.currency ?? 'GBP',
			refreshBlocked: options.refreshBlocked,
			commit,
			logger,
		},
		...(options.attachTo === undefined ? {} : { attachTo: options.attachTo }),
	});
	return { wrapper, commit };
}

/**
 * P04's rows REST until asked: the editor is one row's state, not every row's markup, so a case
 * about the field has to open it the way a user does. Returns the input the click revealed, so a
 * case that forgets to open one fails at this call rather than three assertions later.
 */
export async function openEditor(wrapper: VueWrapper, index = 0): Promise<Omit<DOMWrapper<HTMLInputElement>, 'exists'>> {
	const buttons = wrapper.findAll('.rp-asset-price-edit');
	const button = buttons[index];
	if (button === undefined) throw new Error(`no editable row at ${index}`);
	await button.trigger('click');
	return wrapper.get<HTMLInputElement>('input');
}
