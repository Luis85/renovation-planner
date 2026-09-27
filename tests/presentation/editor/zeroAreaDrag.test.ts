/**
 * @vitest-environment jsdom
 *
 * L-23 through the real mounted Plan Editor — real `SelectTool`, real snapping, real dispatcher,
 * the real `MoveSpatialObjectCommand` — over the rig's in-memory zone repository.
 *
 * The gesture is the one the tracker recorded: a triangle with two corners on one horizontal
 * line, and its third dragged onto that line. The editor's own snapping is what makes the result
 * exactly collinear, and until ruling 34 the drag wrote it. "Nothing was written" is asserted as
 * the repository's listing — every zone and its version — equal to a snapshot taken before the
 * gesture; the rig has no vault files to compare.
 *
 * What the user SEES is read through the instruments `toolRefusalSurfaces.test.ts` uses —
 * `Notice.shown` and the save indicator's rendered label — and it is MEASURED, not chosen here:
 * a refusal from a dispatched gesture is carried by the save indicator alone
 * (`reportDispatchFailure`), and `Geometry` is outside `affectsSaveState`'s pre-write set, so
 * the indicator reads "Save error" and no notice is raised. No sentence names the cause. That is
 * the routing every dispatched geometry refusal already takes; this pins it for this one rather
 * than changing it, and the report that landed this names it as an owner question.
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
/** "Save error" on the indicator, and no notice: see the header for why this is what the user gets. */
function expectShownAsSaveError(harness: Awaited<ReturnType<typeof rig>>['harness']) {
	expect(indicator(harness).text()).toBe('Save error');
	expect(refused(harness)).toBe(true);
	expect(Notice.shown).toEqual([]);
}

describe('a vertex drag that would leave a room enclosing no area', () => {
	it('is refused through SelectTool.commit, writes nothing, and reads as a save error', async () => {
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

			pointer(canvas, 'pointerdown', 648, 199);
			pointer(canvas, 'pointermove', 648, 300);
			pointer(canvas, 'pointermove', 648, 388);
			pointer(canvas, 'pointerup', 648, 388);
			// Either outcome ends the wait, so a drag that WRITES reads as a failed assertion below rather than a timeout.
			await settleUntil(async () => Notice.shown.length > 0 || refused(harness) || JSON.stringify(await listing(zonesRepo)) !== JSON.stringify(before), 'the drag to be refused or written');

			expect(await listing(zonesRepo)).toEqual(before);
			expectShownAsSaveError(harness);
		} finally {
			harness.unmount();
		}
	});
});

describe('a room stored without an area', () => {
	/**
	 * STOP-ZERO 4: the drag that FIXES it is taken, and undoing that fix is refused, because the
	 * outline it would restore is exactly the one that can no longer be saved. The fixed outline
	 * stays in the vault.
	 */
	it('is fixed by a vertex drag, and the undo of that fix is refused as a save error', async () => {
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

			actionButton(harness, 'Undo').click();
			await settleUntil(() => Notice.shown.length > 0 || refused(harness), 'the undo refusal to reach the user');

			expectShownAsSaveError(harness);
			expect((await listing(zonesRepo)).find(zone => zone.entity.id === SLIVER)?.entity.geometry.points).toEqual(fixed);
		} finally {
			harness.unmount();
		}
	});
});
