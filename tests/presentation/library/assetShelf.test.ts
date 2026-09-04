/**
 * @vitest-environment jsdom
 *
 * One category shelf of the Asset library (design "Asset library overview" §3.2): its header,
 * its count, and its sorted rows.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetShelf from '../../../src/presentation/library/AssetShelf.vue';
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
		wasteFactorDefault: '0',
		supplier: null,
		sku: null,
		height: null,
		notes: null,
		background: null,
		...overrides,
	};
}

describe('AssetShelf', () => {
	it('draws an empty declared shelf as a non-interactive heading with a zero count', () => {
		const shelf = mount(AssetShelf, { props: { label: 'Plant', entries: [], collapsible: false } });

		expect(shelf.find('button').exists()).toBe(false);
		expect(shelf.text()).toContain('0');
		expect(shelf.get('h3').classes()).toContain('rp-al-shelf__static--empty');
	});

	it('draws a non-empty, non-collapsible list as a plain heading with no disclosure control', () => {
		// §6.1's flattened Results heading: a non-empty list that still offers no control,
		// because there is nothing to collapse it back into.
		const shelf = mount(AssetShelf, {
			props: { label: 'Results', entries: [anEntry()], collapsible: false },
		});

		expect(shelf.find('button[aria-expanded]').exists()).toBe(false);
		expect(shelf.get('h3').classes()).not.toContain('rp-al-shelf__static--empty');
		expect(shelf.get('.rp-al-shelf__count').text()).toBe('1');
		expect(shelf.findAll('li')).toHaveLength(1);
	});

	it('draws a collapsible header with the real count and a disclosure control', () => {
		const shelf = mount(AssetShelf, {
			props: {
				label: 'Material',
				entries: [anEntry(), anEntry({ assetId: createAssetId(), name: 'Wall paint' })],
				collapsible: true,
				expanded: true,
			},
		});

		const header = shelf.get('button[aria-expanded]');
		expect(header.attributes('aria-expanded')).toBe('true');
		expect(shelf.get('.rp-al-shelf__count').text()).toBe('2');
	});

	it('emits toggle when the collapsible header is clicked', async () => {
		const shelf = mount(AssetShelf, {
			props: { label: 'Material', entries: [anEntry()], collapsible: true, expanded: false },
		});

		await shelf.get('button[aria-expanded]').trigger('click');

		expect(shelf.emitted('toggle')).toHaveLength(1);
	});

	it('hides its rows while collapsed without unmounting them', () => {
		const shelf = mount(AssetShelf, {
			props: { label: 'Material', entries: [anEntry()], collapsible: true, expanded: false },
		});

		const list = shelf.get('ul');
		expect((list.element as HTMLElement).style.display).toBe('none');
		expect(shelf.findAll('li')).toHaveLength(1);
	});

	it('sorts rows by name, locale-aware', () => {
		const shelf = mount(AssetShelf, {
			props: {
				label: 'Material',
				collapsible: true,
				expanded: true,
				entries: [
					anEntry({ assetId: createAssetId(), name: 'Wall paint, white matt' }),
					anEntry({ assetId: createAssetId(), name: 'Oak plank floor' }),
					anEntry({ assetId: createAssetId(), name: 'Ärger tile' }),
				],
			},
		});

		const names = shelf.findAll('.rp-al-row__name').map((el) => el.text());
		expect(names).toEqual(['Ärger tile', 'Oak plank floor', 'Wall paint, white matt']);
	});

	it("passes each row's outline through outlineFor, keyed by asset id", () => {
		const tiles = createAssetId();
		const paint = createAssetId();
		const outlines = new Map<AssetId, AssetOutline>([
			[tiles, { kind: 'measured', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], extent: { width: 10, depth: 10 } }],
			[paint, { kind: 'none' }],
		]);
		const shelf = mount(AssetShelf, {
			props: {
				label: 'Material',
				collapsible: true,
				expanded: true,
				entries: [
					anEntry({ assetId: tiles, name: 'A tiles' }),
					anEntry({ assetId: paint, name: 'B paint' }),
				],
				outlineFor: (id: AssetId) => outlines.get(id) ?? null,
			},
		});

		const marks = shelf.findAll('svg.rp-al-mark');
		expect(marks[0]?.classes()).toContain('rp-al-mark--measured');
		expect(marks[1]?.classes()).toContain('rp-al-mark--none');
	});

	it('answers "not yet read" for every row when outlineFor is not supplied', () => {
		const shelf = mount(AssetShelf, {
			props: { label: 'Material', collapsible: true, expanded: true, entries: [anEntry()] },
		});

		expect(shelf.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--pending');
	});

	it('marks the selected row and none other', () => {
		const selectedId = createAssetId();
		const shelf = mount(AssetShelf, {
			props: {
				label: 'Material',
				collapsible: true,
				expanded: true,
				entries: [
					anEntry({ assetId: selectedId, name: 'A selected' }),
					anEntry({ assetId: createAssetId(), name: 'B other' }),
				],
				selectedId,
			},
		});

		const rows = shelf.findAll('.rp-al-row');
		expect(rows[0]?.attributes('aria-current')).toBe('true');
		expect(rows[1]?.attributes('aria-current')).toBeUndefined();
	});

	it('forwards a row select event with the asset id', async () => {
		const id = createAssetId();
		const shelf = mount(AssetShelf, {
			props: { label: 'Material', collapsible: true, expanded: true, entries: [anEntry({ assetId: id })] },
		});

		await shelf.get('.rp-al-row').trigger('click');

		expect(shelf.emitted('select')).toEqual([[id]]);
	});

	it('renders the disclosure mark rotated only while expanded', () => {
		const closed = mount(AssetShelf, {
			props: { label: 'Material', entries: [anEntry()], collapsible: true, expanded: false },
		});
		const open = mount(AssetShelf, {
			props: { label: 'Material', entries: [anEntry()], collapsible: true, expanded: true },
		});

		expect(closed.get('.rp-al-shelf__chevron').classes()).not.toContain('rp-al-shelf__chevron--open');
		expect(open.get('.rp-al-shelf__chevron').classes()).toContain('rp-al-shelf__chevron--open');
	});
});
