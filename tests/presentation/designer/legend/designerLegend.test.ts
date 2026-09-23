/**
 * @vitest-environment jsdom
 *
 * The designer's canvas legend as a mounted surface (AD18-R16 Task 4, board 01) — where it draws,
 * what it draws, where it refuses to, and the `View` menu's checkbox for it. The row arithmetic is
 * `legendRows.test.ts`'s, beside this.
 *
 * **Driven through `designerRig`, the REAL wiring**, not a bare mount: `DesignerLegend` injects
 * the leaf's `DesignerRuntime` for `showLegend`, exactly as `DesignerDimensions` does for
 * `allDimensions` — that component's own file states why a bare mount is not available here
 * either, and for the identical reason.
 */
import { describe, expect, it } from 'vitest';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { t } from '../../../../src/presentation/i18n/strings';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';

/** Every row's kind and label text, in DOM order. */
function rows(rig: DesignerRig): [string, string][] {
	return rig.wrapper.findAll('.rp-designer-legend .rp-designer-legend__row').map((row) => {
		const swatch = row.get('.rp-designer-legend__swatch').classes().find((name) => name.startsWith('rp-designer-legend__swatch--'));
		return [(swatch ?? '').replace('rp-designer-legend__swatch--', ''), row.text()];
	});
}

const viewToggle = (rig: DesignerRig) => rig.wrapper.get('.rp-designer-tools [data-rp-view="legend"]');

describe('what the designer’s legend draws', () => {
	it('mounts in the canvas overlay, over a full design’s five parts in board order', async () => {
		const rig = await designerRig({ shape: editableShape(), camera: 'default' });
		try {
			const overlay = rig.canvasEl.querySelector('.rp-plan-overlay');
			const drawn = rig.wrapper.get('.rp-designer-legend').element;
			expect(overlay?.contains(drawn)).toBe(true);

			expect(rows(rig)).toEqual([
				['clearance', t('en', 'designer.legend.clearance')],
				['footprint', t('en', 'designer.legend.footprint')],
				['details', t('en', 'designer.legend.details')],
				['placement', t('en', 'designer.legend.placement-point.centre')],
				['facing', t('en', 'designer.legend.front-direction')],
			]);
			expect(drawn.getAttribute('role')).toBe('group');
			expect(drawn.getAttribute('aria-label')).toBe(t('en', 'designer.legend'));
		} finally {
			rig.unmount();
		}
	});

	it('draws no Clearance row for a design with none, and no Details row for a design with none', async () => {
		const rig = await designerRig({ shape: editableShape({ clearance: null, details: [] }), camera: 'default' });
		try {
			expect(rows(rig).map(([kind]) => kind)).toEqual(['footprint', 'placement', 'facing']);
		} finally {
			rig.unmount();
		}
	});

	it('draws each row’s detail: the clearance’s figure where all four sides agree, and the placement point’s preset', async () => {
		// AD18-R17: a 1000 x 600 footprint inside a 1600 x 1200 clearance stands 300 off every side,
		// and an anchor on the back edge's middle is the Placement segment's `Back centre`.
		const rig = await designerRig({ shape: editableShape({ clearance: rect(1600, 1200), anchor: { x: -500, y: 0 } }), camera: 'default' });
		try {
			expect(rows(rig).filter(([kind]) => kind === 'clearance' || kind === 'placement')).toEqual([
				['clearance', t('en', 'designer.legend.clearance.uniform', { size: '300' })],
				['placement', t('en', 'designer.legend.placement-point.back-centre')],
			]);
		} finally {
			rig.unmount();
		}
	});

	it('draws no legend at all over the empty-state overlay a shapeless asset draws', async () => {
		const rig = await designerRig({ shape: null });
		try {
			expect(rig.wrapper.find('.rp-empty-state').exists()).toBe(true);
			expect(rig.wrapper.find('.rp-designer-legend').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});

describe('the legend’s View menu row', () => {
	it('is checked by default, and unchecking it hides the legend without touching its rows', async () => {
		const rig = await designerRig({ shape: editableShape(), camera: 'default' });
		try {
			expect((viewToggle(rig).element as HTMLInputElement).checked).toBe(true);
			expect(rig.wrapper.find('.rp-designer-legend').exists()).toBe(true);

			await viewToggle(rig).setValue(false);
			expect(rig.wrapper.find('.rp-designer-legend').exists()).toBe(false);

			await viewToggle(rig).setValue(true);
			await settle();
			expect(rows(rig)).toHaveLength(5);
		} finally {
			rig.unmount();
		}
	});
});
