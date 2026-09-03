/**
 * @vitest-environment jsdom
 *
 * §3.5 section 2 — *Shape*: its three states, its per-coordinate-group pending warnings, and
 * the refusal table that is keyed on the CODE rather than on the error's union arm.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetInspectorShape from '../../../src/presentation/library/AssetInspectorShape.vue';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { AssetBackgroundRef } from '../../../src/domain/asset/Asset';
import type { SectionStatus } from '../../../src/presentation/library/ticketedSection';
import { assetDesign } from '../../helpers/assetDesign';

function mountShape(options: {
	design?: AssetDesignDto | null;
	status?: SectionStatus;
	error?: AssetDesignError | null;
	background?: AssetBackgroundRef | null;
}) {
	return mount(AssetInspectorShape, {
		props: {
			design: options.design === undefined ? assetDesign() : options.design,
			status: options.status ?? 'ready',
			error: options.error ?? null,
			background: options.background ?? null,
		},
	});
}

describe('AssetInspectorShape answered', () => {
	it('draws the footprint extent with its unit and the clearance as None when there is none', () => {
		const shape = mountShape({});

		expect(shape.text()).toContain('1200 × 800 mm');
		expect(shape.text()).toContain('None');
	});

	it('omits the footprint row entirely for an asset with no outline', () => {
		const shape = mountShape({ design: assetDesign({ shape: null, dimensions: null }) });

		expect(shape.text()).not.toContain('Footprint');
	});

	it('withholds the unit and warns per COORDINATE GROUP rather than per shape', () => {
		// A typed footprint beside a clearance traced before a scale existed: one flag per group,
		// so only the clearance withholds its unit and only the clearance is warned about.
		const design = assetDesign();
		const withClearance = assetDesign({
			shape: { ...design.shape as NonNullable<AssetDesignDto['shape']>, clearancePending: true, clearance: design.shape?.footprint ?? null },
			clearanceExtent: { width: 1400, depth: 400 },
		});
		const shape = mountShape({ design: withClearance });

		expect(shape.text()).toContain('1200 × 800 mm');
		expect(shape.text()).toContain('1400 × 400');
		expect(shape.text()).not.toContain('1400 × 400 mm');
		expect(shape.findAll('.rp-al-note')).toHaveLength(1);
	});

	it('withholds the footprint unit and warns about it when the FOOTPRINT is the pending group', () => {
		// The mirror of the case above, and not a duplicate of it: one flag per group means each
		// arm has to be driven from its own side, or the pair reads as checked with one half
		// never exercised.
		const design = assetDesign();
		const traced = assetDesign({
			shape: { ...(design.shape as NonNullable<AssetDesignDto['shape']>), footprintPending: true },
		});
		const shape = mountShape({ design: traced });

		expect(shape.text()).toContain('1200 × 800');
		expect(shape.text()).not.toContain('1200 × 800 mm');
		expect(shape.get('.rp-al-note').text()).toContain('traced before a scale existed');
	});
});

describe('AssetInspectorShape in flight', () => {
	it('states no absence while the shape read is in flight', () => {
		// `None` is a claim a read has to have RETURNED something to support. A version of these
		// rows fell back to it whenever no extent was present, so a sidecar that had not been
		// read yet reported "this asset has no clearance boundary".
		const shape = mountShape({ design: null, status: 'loading' });

		expect(shape.text()).not.toContain('None');
		expect(shape.text()).toContain('Loading shape…');
	});

	it('draws the spec sheet through both unanswered states, because it rides on the catalogue read', () => {
		const background: AssetBackgroundRef = { path: 'Specs/radiator.pdf', kind: 'pdf', page: 2 };

		for (const status of ['loading', 'failed'] as const) {
			const shape = mountShape({
				design: null,
				status,
				error: status === 'failed' ? { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } : null,
				background,
			});
			// The file's NAME, never the page a PDF reference carries: that page is what the
			// designer needs to open the right sheet, and it is not a row this inventory asks for.
			expect(shape.text()).toContain('radiator.pdf');
			expect(shape.text()).not.toContain('Specs/');
		}
	});
});

describe('AssetInspectorShape refused', () => {
	function refusalText(error: AssetDesignError): string {
		return mountShape({ design: null, status: 'failed', error }).get('.rp-al-inspector__refusal').text();
	}

	it('names the sidecar for a damaged one and never names a file for an unusable id', () => {
		// The two rows the grouped version of this table got wrong: `pathFor` refuses an unusable
		// id BEFORE looking for a sidecar at all, so telling the user their stored shape file
		// could not be read names a file that was never sought — a wrong sentence rather than a
		// missing one.
		expect(
			refusalText({
				category: 'Validation',
				code: 'asset-geometry.corrupt',
				message: 'x',
				sidecarPath: 'Renovation/Library/Geometry/tile.rpgeo',
			}),
		).toContain('Renovation/Library/Geometry/tile.rpgeo');

		const unusable = refusalText({ category: 'Validation', code: 'asset-geometry.unusable-id', message: 'x' });
		expect(unusable).toContain('cannot name a shape file');
		expect(unusable).not.toContain('.rpgeo');
	});

	it('reports a missing asset and an unmeasurable extent as their own two sentences', () => {
		// A single branch would have told a user whose asset had just been deleted that a stored
		// shape file could not be read. `Geometry` is `dimensionsOf` overflowing on a sidecar
		// that READ perfectly well, which is not a damaged file at all.
		expect(refusalText({ category: 'Reference', code: 'asset.not-found', message: 'x' })).toBe(
			'This asset no longer exists.',
		);
		expect(refusalText({ category: 'Geometry', code: 'polygon-area-overflow', message: 'x' })).toBe(
			'This shape is too large to measure.',
		);
	});

	it('states no absence and no extent for a refused read', () => {
		const shape = mountShape({
			design: null,
			status: 'failed',
			error: { category: 'Validation', code: 'asset-geometry.corrupt', message: 'x', sidecarPath: 'g.rpgeo' },
		});

		expect(shape.text()).not.toContain('None');
		expect(shape.find('.rp-al-fields__num').exists()).toBe(false);
	});
});
