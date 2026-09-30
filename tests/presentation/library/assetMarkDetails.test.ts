/**
 * @vitest-environment jsdom
 *
 * AD18-R39: a Grid tile and the inspector's Shape preview draw the asset's DETAILS inside its
 * footprint — a vanity's carcass, basin and tap hole rather than a bare rectangle — while the 20px
 * row mark stays footprint-only (§3.4, "mush at 20px"). The outlines are the shipped presets' own,
 * mapped by `outlineOf`, the one mapping the batch and the preview share.
 */
import { describe, expect, it } from 'vitest';
import { mount, shallowMount } from '@vue/test-utils';
import AssetMark from '../../../src/presentation/library/AssetMark.vue';
import AssetTile from '../../../src/presentation/library/AssetTile.vue';
import AssetRow from '../../../src/presentation/library/AssetRow.vue';
import AssetInspectorShape from '../../../src/presentation/library/AssetInspectorShape.vue';
import { outlineOf, type AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { expectDefined, expectOk } from '../../helpers/domain';
import { shapeWithOpenGraphic } from '../../helpers/assetShapes';
import { anEntry } from '../../helpers/entities';
import { assetDesign } from '../../helpers/assetDesign';

const preset = (id: string): AssetShape => {
	const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
	return expectOk(found.build(defaultValues(found)));
};
const outlineFor = (shape: AssetShape): AssetOutline => outlineOf(shape, expectOk(dimensionsOf(shape.footprint)));

const VANITY = outlineFor(preset('vanity'));
const TABLE = outlineFor(preset('rect-table'));

/** Every `<path>` a wrapper's mark draws, as `[class, d]`. */
const paths = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll('.rp-al-mark path').map((path) => [path.attributes('class') ?? '', path.attributes('d') ?? '']);

/** The bounding box of one path's coordinates, in the mark's own 20-unit box. */
function boxOf(d: string): number[] {
	const numbers = (d.match(/-?\d+\.\d+/g) ?? []).map(Number);
	const xs = numbers.filter((_, index) => index % 2 === 0);
	const ys = numbers.filter((_, index) => index % 2 === 1);
	return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/** A mark at tile size, as `AssetTile` and the inspector preview mount it. */
const at = (outline: AssetOutline | null) => shallowMount(AssetMark, { props: { outline, withDetails: true } });

const tile = (outline: AssetOutline | null) => mount(AssetTile, { props: { entry: anEntry({ category: 'fixture' }), outline, selected: false, ordinal: 0 } });

/** The inspector's Shape section, answered for `shape`. */
const preview = (shape: AssetShape) =>
	mount(AssetInspectorShape, {
		props: { design: assetDesign({ shape, dimensions: expectOk(dimensionsOf(shape.footprint)) }), status: 'ready', error: null, background: null },
	});

describe('AssetMark with details (AD18-R39)', () => {
	it('draws the footprint first, then each detail placed by the FOOTPRINT\'s fit, the carcass dashed', () => {
		const drawn = paths(mount(AssetMark, { props: { outline: VANITY, withDetails: true } }));

		expect(drawn.map(([cls]) => cls)).toEqual(['', 'rp-al-mark__detail rp-al-mark__detail--dashed', 'rp-al-mark__detail', 'rp-al-mark__detail']);
		// 800 × 450 fitted into 16 units: scale 0.02, the top at 5.5. The 760 × 430 carcass sits flush
		// at the back (-y) and 20 mm in at the sides — its OWN fit would have filled 2..18 instead.
		expect(boxOf(expectDefined(drawn[1], 'carcass')[1])).toEqual([2.4, 17.6, 5.5, 14.1]);
		expect(drawn.every(([, d]) => d.endsWith(' Z'))).toBe(true);
	});

	it('keeps the 20px row mark footprint-only, whatever the outline carries', () => {
		expect(paths(mount(AssetMark, { props: { outline: VANITY } }))).toHaveLength(1);
	});

	it('draws the footprint alone for a preset with no details', () => {
		expect(paths(mount(AssetMark, { props: { outline: TABLE, withDetails: true } }))).toHaveLength(1);
	});

	it('leaves an open graphic unclosed', () => {
		const drawn = paths(mount(AssetMark, { props: { outline: outlineFor(shapeWithOpenGraphic()), withDetails: true } }));

		expect(drawn.map(([, d]) => d.endsWith(' Z'))).toEqual([true, true, true, false]);
	});

	it('keeps the five states at tile size: details only on a drawn outline, dashed with it when unscaled', () => {
		const unscaled = outlineFor({ ...preset('vanity'), footprintOrigin: 'traced', footprintPending: true });
		const refused: AssetOutline = { kind: 'refused', code: 'asset-geometry.corrupt', sidecarPath: undefined };

		expect(at(unscaled).classes()).toContain('rp-al-mark--unscaled');
		expect(at(unscaled).findAll('.rp-al-mark__detail')).toHaveLength(3);
		expect([at(null), at({ kind: 'none' }), at(refused)].map((mark) => mark.findAll('.rp-al-mark__detail').length)).toEqual([0, 0, 0]);
		expect(at(null).findAll('circle')).toHaveLength(3);
		expect(at({ kind: 'none' }).element.childElementCount).toBe(0);
		expect(at(refused).findAll('rect')).toHaveLength(1);
	});
});

describe('where the details are drawn (AD18-R39)', () => {
	it('draws a vanity tile\'s details and a table tile\'s footprint alone', () => {
		expect(paths(tile(VANITY))).toHaveLength(4);
		expect(paths(tile(TABLE))).toHaveLength(1);
	});

	it('keeps the design-less tile\'s category icon in place of the mark', () => {
		const none = tile({ kind: 'none' });

		expect(none.find('.rp-al-mark').exists()).toBe(false);
		expect(none.find('.rp-al-tile__category-icon').exists()).toBe(true);
	});

	it('keeps the list row\'s 20px mark footprint-only for the same vanity', () => {
		const row = mount(AssetRow, { props: { entry: anEntry(), outline: VANITY, selected: false, ordinal: 0 } });

		expect(paths(row)).toHaveLength(1);
	});

	it('draws the inspector preview\'s details for a vanity and the footprint alone for a table', () => {
		expect(paths(preview(preset('vanity'))).map(([cls]) => cls.includes('rp-al-mark__detail'))).toEqual([false, true, true, true]);
		expect(paths(preview(preset('rect-table')))).toHaveLength(1);
	});
});
