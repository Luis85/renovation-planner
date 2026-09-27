/**
 * @vitest-environment jsdom
 *
 * L-23 through the real mounted Plan Editor — real `SelectTool`, real snapping, real dispatcher,
 * the real `MoveSpatialObjectCommand` — over the rig's in-memory zone repository.
 *
 * The gesture is the one the tracker recorded: a triangle with two corners on one horizontal
 * line, and its third dragged onto that line, which until ruling 34 the drag wrote. **This first
 * case does not show snapping doing it**: its drop, screen (648,388), maps to exactly (6000,3400)
 * under the rig's transform — already on the line, so it cannot tell a snap from none. The slanted
 * case at the end is the one where the snap decides the point — the drop maps to (5160,3320) and
 * the corner is written, before ruling 36, at the edge projection (5159.52…,3319.05…), about
 * 1.2e-10 mm² off collinear. "Nothing was written" is asserted as
 * the repository's listing — every zone and its version — equal to a snapshot taken before the
 * gesture; the rig has no vault files to compare.
 *
 * What the user SEES is read through the instruments `toolRefusalSurfaces.test.ts` uses —
 * `Notice.shown` and the save indicator's rendered label. Owner ruling 37: the refusal is raised
 * before anything is written, so `Geometry` is in `affectsSaveState`'s pre-write set and
 * `reportDispatchFailure` raises ONE notice carrying the category's sentence while the badge
 * keeps whatever it read before the gesture — the `undo.superseded` shape (rulings 17/27/30).
 * Until that ruling the indicator read "Save error", no notice named the cause, and the badge
 * stayed until the next successful save.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { actionButton, canvasOf, click, PLAN_DTO, PROJECT_ID, pointer, rig } from '../../helpers/planEditorRig';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { Zone } from '../../../src/domain/zone/Zone';
import type { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
beforeEach(() => { activateNotices(); Notice.shown.length = 0; });

const TRIANGLE = 'zone-triangle' as ZoneId;
const SLIVER = 'zone-sliver' as ZoneId;
const planId = PLAN_DTO.id as PlanId;
/**
 * World = 10 x screen - 480 per axis. Clear of the rig's own zone (x <= 4400), so nothing but
 * this zone's own edge is near the drop: corners at screen (548,388), (748,388) and (648,198).
 */
const TRIANGLE_POINTS = [{ x: 5000, y: 3400 }, { x: 7000, y: 3400 }, { x: 6000, y: 1500 }];
/** The same three corners with the apex already on the base line, as a vault from before ruling 34 can hold it. */
const SLIVER_POINTS = [{ x: 5000, y: 3400 }, { x: 7000, y: 3400 }, { x: 6000, y: 3400 }];

const listing = async (zones: InMemoryZoneRepository) => expectOk(await zones.listByPlan(planId)).loaded;
const indicator = (harness: Awaited<ReturnType<typeof rig>>['harness']) => harness.wrapper.find('.rp-save-state-label');
const refused = (harness: Awaited<ReturnType<typeof rig>>['harness']) => indicator(harness).classes().includes('rp-save-state-save-error');
/** One notice with the Geometry category's sentence, and the badge as it read before: see the header. */
function expectShownAsGeometryNotice(harness: Awaited<ReturnType<typeof rig>>['harness'], badge: string) {
	expect(Notice.shown).toEqual(['A geometry value is invalid.']);
	expect(refused(harness)).toBe(false);
	expect(indicator(harness).text()).toBe(badge);
}

describe('a vertex drag that would leave a room enclosing no area', () => {
	it('is refused through SelectTool.commit, writes nothing, and reads as a geometry notice', async () => {
		const { harness, zonesRepo } = await rig(async ({ zones }) => {
			await zones.save(makeZone({ id: TRIANGLE, projectId: PROJECT_ID, planId, name: 'Triangle', geometry: { points: TRIANGLE_POINTS } }), 'absent');
		});
		try {
			const canvas = canvasOf(harness);
			actionButton(harness, 'Select').click();
			await settle();
			click(canvas, 648, 330);
			await settle();
			expect(useSelectionStore(harness.pinia).selectedIds).toEqual([TRIANGLE]);
			const before = await listing(zonesRepo);
			const badge = indicator(harness).text();

			pointer(canvas, 'pointerdown', 648, 199);
			pointer(canvas, 'pointermove', 648, 300);
			pointer(canvas, 'pointermove', 648, 388);
			pointer(canvas, 'pointerup', 648, 388);
			// Either outcome ends the wait, so a drag that WRITES reads as a failed assertion below rather than a timeout.
			await settleUntil(async () => Notice.shown.length > 0 || refused(harness) || JSON.stringify(await listing(zonesRepo)) !== JSON.stringify(before), 'the drag to be refused or written');

			expect(await listing(zonesRepo)).toEqual(before);
			expectShownAsGeometryNotice(harness, badge);
		} finally {
			harness.unmount();
		}
	});
});

describe('a room stored without an area', () => {
	/**
	 * STOP-ZERO 4: the drag that FIXES it is taken, and undoing that fix is refused, because the
	 * outline it would restore is exactly the one that can no longer be saved. The fixed outline
	 * stays in the vault, and the badge keeps the "Saved" the fix earned (ruling 37).
	 */
	it('is fixed by a vertex drag, and the undo of that fix is refused as a geometry notice', async () => {
		const { harness, zonesRepo } = await rig(async ({ zones }) => {
			const stored = expectOk(Zone.fromStored({ id: SLIVER, projectId: PROJECT_ID, planId, name: 'Sliver', zoneType: 'Room', geometry: { points: SLIVER_POINTS } }));
			await zones.save(stored, 'absent');
		});
		try {
			const canvas = canvasOf(harness);
			actionButton(harness, 'Select').click();
			await settle();
			useSelectionStore(harness.pinia).select([SLIVER]);
			await settle();

			pointer(canvas, 'pointerdown', 648, 387);
			pointer(canvas, 'pointermove', 648, 300);
			pointer(canvas, 'pointermove', 648, 198);
			pointer(canvas, 'pointerup', 648, 198);
			const fixed = [...SLIVER_POINTS.slice(0, 2), { x: 6000, y: 1500 }];
			await settleUntil(async () => JSON.stringify((await listing(zonesRepo)).find(zone => zone.entity.id === SLIVER)?.entity.geometry.points) === JSON.stringify(fixed), 'the fixing drag to land');
			expect(Notice.shown).toEqual([]);
			expect(refused(harness)).toBe(false);
			const badge = indicator(harness).text();

			actionButton(harness, 'Undo').click();
			await settleUntil(() => Notice.shown.length > 0 || refused(harness), 'the undo refusal to reach the user');

			expectShownAsGeometryNotice(harness, badge);
			expect((await listing(zonesRepo)).find(zone => zone.entity.id === SLIVER)?.entity.geometry.points).toEqual(fixed);
		} finally {
			harness.unmount();
		}
	});
});

/**
 * Ruling 36, the review's case: the neighbour edge is SLANTED, so the snap that lands the corner
 * on it projects onto a line no float grid holds, and the "collinear" triangle keeps a residue of
 * about 1e-10 mm². An exact-zero test read that as a real area and the drag wrote it.
 */
describe('a vertex drag onto a slanted neighbour edge', () => {
	/** World (4594,3606)–(7436,2164) is screen (507.4,408.6)–(791.6,264.4); the neighbour lies below it. */
	const NEIGHBOUR = [{ x: 4594, y: 3606 }, { x: 7436, y: 2164 }, { x: 7436, y: 3606 }];
	/** The same edge as its base, and its apex above it at screen (548,248). */
	const SLANTED = [{ x: 4594, y: 3606 }, { x: 7436, y: 2164 }, { x: 5000, y: 2000 }];

	it('is refused, writes nothing, and reads as a geometry notice', async () => {
		const { harness, zonesRepo } = await rig(async ({ zones }) => {
			await zones.save(makeZone({ id: 'zone-neighbour' as ZoneId, projectId: PROJECT_ID, planId, name: 'Neighbour', geometry: { points: NEIGHBOUR } }), 'absent');
			await zones.save(makeZone({ id: TRIANGLE, projectId: PROJECT_ID, planId, name: 'Triangle', geometry: { points: SLANTED } }), 'absent');
		});
		try {
			const canvas = canvasOf(harness);
			actionButton(harness, 'Select').click();
			await settle();
			click(canvas, 610, 300);
			await settle();
			expect(useSelectionStore(harness.pinia).selectedIds).toEqual([TRIANGLE]);
			const before = await listing(zonesRepo);
			const badge = indicator(harness).text();

			pointer(canvas, 'pointerdown', 548, 249);
			pointer(canvas, 'pointermove', 556, 320);
			pointer(canvas, 'pointermove', 564, 380);
			pointer(canvas, 'pointerup', 564, 380);
			await settleUntil(async () => Notice.shown.length > 0 || refused(harness) || JSON.stringify(await listing(zonesRepo)) !== JSON.stringify(before), 'the drag to be refused or written');

			expect(await listing(zonesRepo)).toEqual(before);
			expectShownAsGeometryNotice(harness, badge);
		} finally {
			harness.unmount();
		}
	});
});
