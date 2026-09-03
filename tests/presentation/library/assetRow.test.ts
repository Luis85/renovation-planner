/**
 * @vitest-environment jsdom
 *
 * One row of the Asset library's shelves (design "Asset library overview" §3.3): the accessible
 * wiring around the mark, and the five data slots derived from Task 5's `CatalogueEntryDto`.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetRow from '../../../src/presentation/library/AssetRow.vue';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf } from '../../../src/core/money/Money';

function anEntry(overrides: Partial<CatalogueEntryDto> = {}): CatalogueEntryDto {
	return {
		assetId: createAssetId(),
		name: 'Oak plank floor',
		category: 'material',
		unit: 'm2',
		unitCostAmount: '34.95',
		currency: currencyOf('EUR'),
		wasteFactorDefault: '0.08',
		supplier: 'Holzhandel Nord',
		sku: 'EIC-1200-190',
		height: null,
		notes: null,
		background: null,
		...overrides,
	};
}

function entryWithId(id: string, overrides: Partial<CatalogueEntryDto> = {}): CatalogueEntryDto {
	return anEntry({ assetId: id as AssetId, ...overrides });
}

const MEASURED: AssetOutline = {
	kind: 'measured',
	points: [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 190 }, { x: 0, y: 190 }],
	extent: { width: 1200, depth: 190 },
};

function mountRow(overrides: Partial<{
	entry: CatalogueEntryDto;
	outline: AssetOutline | null;
	selected: boolean;
	ordinal: number;
}> = {}) {
	return mount(AssetRow, {
		props: {
			entry: anEntry(),
			outline: MEASURED,
			selected: false,
			ordinal: 0,
			...overrides,
		},
	});
}

describe('AssetRow', () => {
	it('describes the row from an ordinal, never from an id that may hold whitespace', () => {
		const row = mountRow({ entry: entryWithId('wall tile'), ordinal: 3 });
		const describedBy = row.get('button').attributes('aria-describedby');

		expect(describedBy).toBeDefined();
		expect(describedBy).not.toContain(' ');
		expect(row.find(`#${describedBy as string}`).exists()).toBe(true);
	});

	it('keeps the description outside the button so it does not join the accessible name', () => {
		const row = mountRow({ entry: anEntry({ name: 'Oak plank floor' }) });

		expect(row.get('button').text()).not.toContain('mm');
		// It is a genuine sibling of the button, not merely absent from its text: the id the
		// button references resolves to an element the button does not contain.
		const describedBy = row.get('button').attributes('aria-describedby') as string;
		const described = row.get(`#${describedBy}`);
		expect(row.get('button').element.contains(described.element)).toBe(false);
		expect(described.text()).toContain('mm');
	});

	it('marks a selected row with aria-current, never aria-selected', () => {
		const selected = mountRow({ selected: true });
		const unselected = mountRow({ selected: false });

		expect(selected.get('button').attributes('aria-current')).toBe('true');
		expect(selected.get('button').attributes('aria-selected')).toBeUndefined();
		expect(unselected.get('button').attributes('aria-current')).toBeUndefined();
		expect(unselected.get('button').classes()).not.toContain('rp-al-row--on');
		expect(selected.get('button').classes()).toContain('rp-al-row--on');
	});

	it('prints each asset in its own currency', () => {
		const eur = mountRow({ entry: anEntry({ unitCostAmount: '34.95', currency: currencyOf('EUR') }) });
		const gbp = mountRow({ entry: anEntry({ unitCostAmount: '34.95', currency: currencyOf('GBP') }) });

		expect(eur.get('.rp-al-row__amount').text()).toContain('€');
		expect(gbp.get('.rp-al-row__amount').text()).toContain('£');
		expect(gbp.get('.rp-al-row__amount').text()).not.toContain('€');
	});

	it('prints the unit cost, right-aligned by class, with its own unit suffix', () => {
		const row = mountRow({ entry: anEntry({ unit: 'm2', unitCostAmount: '34.95' }) });
		expect(row.get('.rp-al-row__unit').text()).toBe('/ m2');
	});

	it('prints a non-zero waste factor as a signed percentage', () => {
		const row = mountRow({ entry: anEntry({ wasteFactorDefault: '0.08' }) });
		expect(row.get('.rp-al-row__waste').text()).toBe('+8%');
	});

	it('draws nothing in the waste slot when the default is zero', () => {
		const row = mountRow({ entry: anEntry({ wasteFactorDefault: '0' }) });
		expect(row.get('.rp-al-row__waste').text()).toBe('');
	});

	it('prints the supplier, or nothing when there is none', () => {
		const withSupplier = mountRow({ entry: anEntry({ supplier: 'Holzhandel Nord' }) });
		const without = mountRow({ entry: anEntry({ supplier: null }) });

		expect(withSupplier.get('.rp-al-row__supplier').text()).toBe('Holzhandel Nord');
		expect(without.get('.rp-al-row__supplier').text()).toBe('');
	});

	it('emits select with the asset id on click', async () => {
		const id = createAssetId();
		const row = mountRow({ entry: anEntry({ assetId: id }) });

		await row.get('button').trigger('click');

		expect(row.emitted('select')).toEqual([[id]]);
	});

	it('describes a not-yet-read mark without printing an extent', () => {
		const row = mountRow({ outline: null });
		const description = row.get('.rp-al-row__mark-words').text();
		expect(description).not.toMatch(/\d/);
	});

	it('describes an unscaled footprint by its proportions, withholding the unit', () => {
		const row = mountRow({ outline: { kind: 'unscaled', points: MEASURED.points, extent: MEASURED.extent } });
		const description = row.get('.rp-al-row__mark-words').text();
		expect(description).toContain('1200 × 190');
		expect(description).not.toContain('mm');
	});

	it('describes a measured footprint by its word AND its extent, with its unit', () => {
		// Spec amendment of 2026-09-03: §3.4 asks for "state AND extent" with no carve-out, so
		// `measured` carries a word exactly as the other four do, following the spec's own
		// worked example ("Measured footprint, 1200 × 190 mm").
		const row = mountRow({ outline: MEASURED });
		const description = row.get('.rp-al-row__mark-words').text();
		expect(description).toBe('Measured footprint, 1200 × 190 mm');
	});

	it('describes "no footprint" and "unreadable" without an extent', () => {
		const none = mountRow({ outline: { kind: 'none' } });
		const unreadable = mountRow({
			outline: { kind: 'refused', code: 'asset-geometry.unreadable', sidecarPath: undefined },
		});

		expect(none.get('.rp-al-row__mark-words').text()).not.toMatch(/\d/);
		expect(unreadable.get('.rp-al-row__mark-words').text()).not.toMatch(/\d/);
		expect(none.get('.rp-al-row__mark-words').text()).not.toBe(unreadable.get('.rp-al-row__mark-words').text());
	});

	it('mints a distinct description id per row, from its own ordinal', () => {
		const first = mountRow({ ordinal: 0 });
		const second = mountRow({ ordinal: 1 });

		const firstId = first.get('button').attributes('aria-describedby');
		const secondId = second.get('button').attributes('aria-describedby');
		expect(firstId).not.toBe(secondId);
	});
});
