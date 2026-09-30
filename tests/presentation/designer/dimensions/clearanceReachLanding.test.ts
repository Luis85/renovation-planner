/**
 * @vitest-environment jsdom
 *
 * A typed clearance REACH that lands away from the number typed says so (AD18-R41's fix round), through
 * the same `landTyped` warning a typed Width gets (AD18-R24) — not silently, which is what the first
 * version of `reached` did: a curved boundary whose kept bulges cannot reach the asked extent lands at
 * `solveScale`'s nearest, and the label read back a different number with nothing said.
 *
 * Driven through `designerRig`, the real designer and the real write path. The clearance is a TRACED
 * curved triangle, one of its three edges bulged, around the round table's 900 mm circle — the shape of
 * the review's own finds, rounded from one this card's random sweep produced. Its box is 1862 x 1811 and
 * its right reach reads 770; typed 870 it lands exactly, typed 2270 it asks for 3362 wide and the kept
 * bulge stops it at about 2646 (measured), so the right reach reads about 1554, not 2270.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { circle } from '../../../../src/domain/asset/presets/presetGeometry';
import { partMeasure, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { t } from '../../../../src/presentation/i18n/strings';
import { activateNotices } from '../../../../src/presentation/notices/notify';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { installObsidianDom } from '../../../helpers/dom';
import { expectDefined } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';
import { Notice } from '../../../helpers/obsidian-mock';

const TRIANGLE = { points: [{ x: 1220, y: 440 }, { x: -642, y: 1081 }, { x: -207, y: -730 }], bulges: [0, 0, -0.4] };
const traced = (): AssetShape => editableShape({ footprint: circle(900), clearance: TRIANGLE, details: [] });

let shownBefore = 0;
/** The accessible name each typed label carried, as the button's `aria-label` composes it. */
const named: string[] = [];
const raised = (): readonly string[] => Notice.shown.slice(shownBefore);

beforeEach(() => {
	installObsidianDom();
	activateNotices();
	shownBefore = Notice.shown.length;
});

async function typeReach(rig: DesignerRig, side: string, value: string): Promise<PartBox> {
	// All dimensions, since the resting state draws the overall pair alone while a footprint this small is under 240 px across.
	await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);
	await settle();
	named.push(rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="clearance-offset-${side}"]`).attributes('aria-label') ?? '');
	(rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="clearance-offset-${side}"]`).element as HTMLButtonElement).click();
	await settle();
	await rig.wrapper.get('.rp-designer-dimension__form input').setValue(value);
	await rig.wrapper.get('.rp-designer-dimension__form').trigger('submit');
	await settle();
	return partMeasure(expectDefined((await rig.document()).shape ?? undefined, 'a written shape'), { kind: 'clearance' }) as PartBox;
}

describe('a typed clearance reach that cannot land', () => {
	it('warns with the size the clearance landed at, as a typed Width does', async () => {
		const rig = await designerRig({ shape: traced(), camera: 'opened' });
		try {
			const box = await typeReach(rig, 'right', '2270');

			expect(box.width).toBeGreaterThan(2600);
			expect(box.width).toBeLessThan(3000);
			expect(raised()).toEqual([t('en', 'designer.typed-size.landed', { width: String(Math.round(box.width)), depth: String(Math.round(box.depth)) })]);
		} finally {
			rig.unmount();
		}
	});

	it('says nothing when the reach lands where it was typed', async () => {
		const rig = await designerRig({ shape: traced(), camera: 'opened' });
		try {
			const box = await typeReach(rig, 'right', '870');

			// The left edge held at -642, the width 100 wider, the depth untouched.
			expect(box.centre.x - box.width / 2).toBeCloseTo(-642, 6);
			expect([box.width, box.depth]).toEqual([1962, 1811]);
			// Its accessible name says what the number is: a reach beyond the edge (fix round 1).
			expect(named.at(-1)).toBe(t('en', 'designer.dimension.value', { name: t('en', 'designer.dimension.reach-right'), value: '770' }));
			expect(named.at(-1)).toBe('Clearance beyond the right edge 770 mm');
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});
