// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { settleUntil as until } from '../../../helpers/editor';
import { actionButton, click, PROJECT_ID, rig } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * The Inspector's Delete action end to end (slice 15's Definition of Done 6, 8 and 8a),
 * through the REAL mounted Plan Editor: the real `DialogHost`, the real `DialogStore`, the
 * real `ListRequirementsReferencing` over real in-memory repositories, and the real
 * `DeleteZoneCommand`.
 *
 * `deleteZoneFlow.test.ts` is where the flow's decisions are asserted against doubles; what
 * this file adds is that the pieces are actually WIRED — a flow with the right logic and a
 * query nobody passed it would pass every test there and open a dialog reading zero here.
 */

/** The dialog's own buttons, addressed by `data-rp-action` rather than by position. */
function dialogButton(harness: Awaited<ReturnType<typeof rig>>['harness'], action: string) {
	const found = harness.wrapper.find(`[data-rp-action="${action}"]`);
	if (!found.exists()) throw new Error(`no dialog button for ${action}`);
	return found;
}

async function selectZoneWithRequirements(count: number) {
	const r = await rig(async ({ assets }) => {
		for (let index = 0; index < count; index += 1) {
			await assets.save(
				makeAsset({
					name: `Asset ${index}`,
					unit: 'm2',
					wasteFactorDefault: new Decimal('0.10'),
				}),
				'absent',
			);
		}
	});

	actionButton(r.harness, 'Select').click();
	click(r.harness.canvasEl as HTMLElement, 300, 300);
	await until(() => r.harness.wrapper.text().includes('Assign'), 'the panel shows the zone');

	// Assign every seeded asset through the panel's own control, so the referents exist the
	// way a user would have made them.
	for (const asset of expectOk(await r.assetsRepo.listAll())) {
		await until(() => {
			const el = r.harness.wrapper.find('#rp-assign-asset').element as HTMLSelectElement;
			return [...el.options].some((option) => option.value === asset.entity.id);
		}, 'the asset is offered');
		await r.harness.wrapper.find('#rp-assign-asset').setValue(asset.entity.id);
		const assign = r.harness.wrapper.findAll('button').find((b) => b.text() === 'Assign');
		if (!assign) throw new Error('no Assign button');
		await assign.trigger('click');
	}
	await until(
		async () => expectOk(await r.requirementsRepo.listByZone('zone-a' as never)).length === count,
		`${count} requirements exist`,
	);
	return r;
}

describe('deleting a Zone that Requirements reference', () => {
	it('opens the dialog showing the count the QUERY answered, and remove-references deletes both', async () => {
		const r = await selectZoneWithRequirements(2);

		actionButton(r.harness, 'Delete').click();
		await until(() => r.harness.wrapper.find('[data-rp-action="delete-anyway"]').exists(), 'the dialog');

		// The row the descriptor was built from — the count AND the project name came from
		// `ListRequirementsReferencing`, not from anything the dialog recomputed. Slice 15's
		// item 6: exactly one row, naming the owning project, because a Zone yields one group.
		const rows = r.harness.wrapper.findAll('.rp-dialog-reference-row');
		expect(rows).toHaveLength(1);
		expect(rows[0]?.text()).toContain('Kitchen refit');
		expect(rows[0]?.text()).toContain('2');

		await dialogButton(r.harness, 'remove-references').trigger('click');
		await until(
			async () => expectOk(await r.zonesRepo.getById('zone-a' as never)) === null,
			'the zone is deleted',
		);
		expect(expectOk(await r.requirementsRepo.listByZone('zone-a' as never))).toEqual([]);
		r.harness.unmount();
	});

	it('delete-anyway strands the requirements marked stale rather than deleting them', async () => {
		const r = await selectZoneWithRequirements(1);

		actionButton(r.harness, 'Delete').click();
		await until(() => r.harness.wrapper.find('[data-rp-action="delete-anyway"]').exists(), 'the dialog');
		await dialogButton(r.harness, 'delete-anyway').trigger('click');

		await until(
			async () => expectOk(await r.zonesRepo.getById('zone-a' as never)) === null,
			'the zone is deleted',
		);
		const stranded = expectOk(await r.requirementsRepo.listByZone('zone-a' as never));
		expect(stranded).toHaveLength(1);
		expect(stranded[0]?.entity.recalculationStatus).toBe('stale');
		r.harness.unmount();
	});

	it('Cancel leaves the zone and its requirements exactly as they were', async () => {
		const r = await selectZoneWithRequirements(1);

		actionButton(r.harness, 'Delete').click();
		await until(() => r.harness.wrapper.find('[data-rp-action="cancel"]').exists(), 'the dialog');
		await dialogButton(r.harness, 'cancel').trigger('click');
		await until(() => !r.harness.wrapper.find('[data-rp-action="cancel"]').exists(), 'the dialog closed');

		expect(expectOk(await r.zonesRepo.getById('zone-a' as never))).not.toBeNull();
		expect(expectOk(await r.requirementsRepo.listByZone('zone-a' as never))).toHaveLength(1);
		r.harness.unmount();
	});

	it('a zone nothing references is deleted with no dialog at all', async () => {
		const r = await rig();
		actionButton(r.harness, 'Select').click();
		click(r.harness.canvasEl as HTMLElement, 300, 300);
		await until(() => r.harness.wrapper.text().includes('Delete'), 'the panel shows the zone');

		actionButton(r.harness, 'Delete').click();
		await until(
			async () => expectOk(await r.zonesRepo.getById('zone-a' as never)) === null,
			'the zone is deleted',
		);
		// The zero branch dispatches the absent-resolution form; nothing was ever asked.
		expect(r.harness.wrapper.find('[data-rp-action="delete-anyway"]').exists()).toBe(false);
		r.harness.unmount();
	});

	it('Reassign moves the requirements onto the picked zone and then deletes', async () => {
		const r = await selectZoneWithRequirements(1);
		// A second zone in the same project — the only eligible reassignment target.
		const target = expectOk(
			await r.zonesRepo.save(
				makeZone({
					projectId: PROJECT_ID,
					planId: 'plan-e2e' as PlanId,
					id: 'zone-b' as ZoneId,
					name: 'Hallway',
				}),
				'absent',
			),
		);

		actionButton(r.harness, 'Delete').click();
		await until(() => r.harness.wrapper.find('[data-rp-action="reassign"]').exists(), 'the dialog');
		await dialogButton(r.harness, 'reassign').trigger('click');

		await until(() => r.harness.wrapper.find('.rp-dialog-candidate').exists(), 'the picker');
		await r.harness.wrapper.find('.rp-dialog-candidate').trigger('click');

		await until(
			async () => expectOk(await r.zonesRepo.getById('zone-a' as never)) === null,
			'the zone is deleted',
		);
		const moved = expectOk(await r.requirementsRepo.listByZone(target.entity.id));
		expect(moved).toHaveLength(1);
		r.harness.unmount();
	});
});
