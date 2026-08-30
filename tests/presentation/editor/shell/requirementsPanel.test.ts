// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { settle, settleUntil as until } from '../../../helpers/editor';
import { click, pointer, rig, toolbarButton } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/**
 * The Requirements panel (design slice 10's Inspector integration), driven through the
 * REAL mounted Plan Editor: a zone is selected, an asset is assigned through the panel's
 * own control, and the row that appears carries the figures, the override affordances and
 * the reset path — every edit dispatched through the ONE commit path into command
 * history, against REAL in-memory repositories.
 */

async function rigWithAssets(names: string[]) {
	return await rig(async ({ assets }) => {
		for (const name of names) {
			await assets.save(
				makeAsset({ name, unit: 'm2', wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			);
		}
	});
}

	async function selectZoneAndAssign(r: Awaited<ReturnType<typeof rig>>, assetId: string): Promise<void> {
	toolbarButton(r.harness, 'Select').click();
	click(r.harness.canvasEl as HTMLElement, 300, 300);
	await until(() => r.harness.wrapper.text().includes('Assign'), 'assign control visible');

	// The picker's options hydrate off the plan read; wait for the asset to be offered
	// rather than setting a value no <option> backs yet.
	await until(() => {
		const el = r.harness.wrapper.find('#rp-assign-asset').element as HTMLSelectElement;
		return [...el.options].some((option) => option.value === assetId);
	}, 'the asset appears in the picker');

	const select = r.harness.wrapper.find('#rp-assign-asset');
	if (!select.exists()) throw new Error('no assign picker');
	await select.setValue(assetId);
	await settle();

	const assignButtons = r.harness.wrapper.findAll('button');
	const assignButton = assignButtons.find((button) => button.text() === 'Assign');
	if (!assignButton) throw new Error('no Assign button');
	await assignButton.trigger('click');
}

describe('the Requirements panel', () => {
		it('says the zone has no requirements before anything is assigned', async () => {
			const r = await rig();
			toolbarButton(r.harness, 'Select').click();
			click(r.harness.canvasEl as HTMLElement, 300, 300);
			await until(
				() => r.harness.wrapper.text().includes('No requirements reference this zone yet.'),
				'empty requirements message',
			);
			expect(expectOk(await r.requirementsRepo.listByZone('zone-a' as never))).toEqual([]);
			r.harness.unmount();
		});

	it('assigns an asset through the picker and renders its row with effective figures', async () => {
		const r = await rigWithAssets(['Floor tiles']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];

		await selectZoneAndAssign(r, areaAsset.entity.id);

		// The picker option already contains the asset name; the ROW appears once the
		// post-command refresh has re-run the requirements query.
		await until(
			() => r.harness.wrapper.text().includes('Floor tiles')
				&& !r.harness.wrapper.text().includes('No requirements reference this zone yet.'),
			'the requirement row appears',
		);

		// The zone is 2.9 m x 1.9 m; x 1.10 waste drives the effective quantity, and the
		// asset's unit cost prices it. Asserting on the SHAPE here — figures come from the
		// cost pipeline's own tests.
		const text = r.harness.wrapper.text();
		expect(text).toContain('m2');
		expect(text).toContain('EUR');
		r.harness.unmount();
	});

	it('applies a quantity override with an Overridden badge, then resets to calculated', async () => {
		const r = await rigWithAssets(['Plaster']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];

		await selectZoneAndAssign(r, areaAsset.entity.id);
		await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'the row override inputs render');

		// Type an override quantity and blur to commit it (design slice 16: the field
		// dispatches on blur rather than on a separate Apply button).
		const qtyInput = r.harness.wrapper.find('input[data-field="quantity"]');
		if (!qtyInput.exists()) throw new Error('no quantity override input');
		await qtyInput.setValue('7');
		await qtyInput.trigger('blur');

		await until(() => r.harness.wrapper.text().includes('Overridden'), 'overridden badge');
		expect(r.harness.wrapper.text()).toContain('7 m2');

		// Undo through the toolbar: the reversible adapter restores the WHOLE requirement,
		// so the typed figure is gone, not merely hidden.
		toolbarButton(r.harness, 'Undo').click();
		await until(
			() => !r.harness.wrapper.text().includes('Overridden'),
			'override undone',
		);

		// Re-apply, then Reset sends null: back to calculated, badge gone.
		await qtyInput.setValue('7');
		await qtyInput.trigger('blur');
		await until(() => r.harness.wrapper.text().includes('Overridden'), 'overridden again');

		await r.harness.wrapper.find('.rp-requirement-reset-quantity').trigger('click');
		await until(
			() => !r.harness.wrapper.text().includes('Overridden'),
			'override cleared',
		);
		r.harness.unmount();
	});

	/**
	 * Reset on a row that holds NO override must dispatch NOTHING, and the instrument is the
	 * REVISION rather than the rendered figure: clearing an override that was never set leaves
	 * the screen identical either way, so every assertion about what the user sees passes on
	 * both the defect and the fix. The vault is the only place the difference exists.
	 *
	 * `useFieldCommit`'s own "nothing to commit" guard cannot cover this and the case is here to
	 * say so: it tests for a clean field, and `resetQuantity` used to mint a draft with
	 * `onInput('')` before ever reaching it, so the guard was unreachable from this path by
	 * construction. A vault write, a revision bump and an undo entry, for no visible change —
	 * and a second Reset bought a second set.
	 */
	it('writes nothing when Reset is pressed on a field that holds no override', async () => {
		const r = await rigWithAssets(['Screed']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];

		await selectZoneAndAssign(r, areaAsset.entity.id);
		await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'the row override inputs render');

		const before = expectOk(await r.requirementsRepo.listByZone('zone-a' as never));
		expect(before).toHaveLength(1);
		expect(r.harness.wrapper.text()).not.toContain('Overridden');

		// Both fields, and twice each: the second press is what caught the pre-existing shape
		// where a successful reset left the row able to clear an override it no longer had.
		for (let round = 0; round < 2; round += 1) {
			await r.harness.wrapper.find('.rp-requirement-reset-quantity').trigger('click');
			await r.harness.wrapper.find('.rp-requirement-reset-cost').trigger('click');
			await settle();
		}

		const after = expectOk(await r.requirementsRepo.listByZone('zone-a' as never));
		expect(after).toHaveLength(1);
		expect(after[0].version.revision).toBe(before[0].version.revision);
		r.harness.unmount();
	});

	/**
	 * Closes the map-to-raise-site link end to end, through the REAL command rather than a
	 * mock: `RequirementRow`'s `QUANTITY_ERRORS` hand-spells `requirement.negative-quantity`,
	 * and `SetRequirementQuantityOverride.ts` mints that exact code independently — a
	 * previous round of this slice had the map and its own unit tests agree on a code the
	 * command never raises, and stayed green because nothing drove the real raise site. This
	 * case fails the moment either side of that pairing drifts from the other.
	 */
	it('shows the negative-quantity refusal under the quantity input, from the real command', async () => {
		const r = await rigWithAssets(['Underlay']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];

		await selectZoneAndAssign(r, areaAsset.entity.id);
		await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'the row override inputs render');

		const qtyInput = r.harness.wrapper.find('input[data-field="quantity"]');
		if (!qtyInput.exists()) throw new Error('no quantity override input');
		await qtyInput.setValue('-5');
		await qtyInput.trigger('blur');

		await until(
			() => r.harness.wrapper.find('.rp-field-error__message').exists(),
			'the inline refusal message',
		);
		expect(r.harness.wrapper.get('.rp-field-error__message').text()).toContain('A quantity cannot be negative.');
		expect(qtyInput.attributes('aria-invalid')).toBe('true');
		// Never committed as an override: the command refused it, so the requirement's own
		// figure never moved.
		expect(r.harness.wrapper.text()).not.toContain('Overridden');
		r.harness.unmount();
	});

	it('pressing Assign with nothing picked dispatches nothing', async () => {
		// The picker starts on the empty value, so the first thing a user can do is press
		// Assign without choosing — which must be inert rather than a refused command.
		const r = await rigWithAssets(['Skirting']);
		toolbarButton(r.harness, 'Select').click();
		click(r.harness.canvasEl as HTMLElement, 300, 300);
		await until(() => r.harness.wrapper.text().includes('Assign'), 'assign control visible');

		const assignButton = r.harness.wrapper.findAll('button').find((button) => button.text() === 'Assign');
		if (!assignButton) throw new Error('no Assign button');
		await assignButton.trigger('click');
		await settle();

		expect(expectOk(await r.requirementsRepo.listByZone('zone-a' as never))).toEqual([]);
		r.harness.unmount();
	});

	/**
	 * The state `delete-anyway` on an ASSET deliberately creates: the requirement survives
	 * with nothing to name it. `RequirementInspectorDTO.assetName` is nullable exactly so
	 * this row can be BUILT — typed `string`, the query would have to fail or drop the row,
	 * and the stale warning would be unreachable for the rows that most need it.
	 */
	it('renders a requirement whose asset is gone from its id, with the reason', async () => {
		const r = await rigWithAssets(['Doomed']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];
		if (areaAsset === undefined) throw new Error('expected a seeded asset');

		await selectZoneAndAssign(r, areaAsset.entity.id);
		// On the REPOSITORY, not on the panel text: the asset's name is in the picker's
		// options too, so "the text says Doomed" is already true before the row exists —
		// and deleting the asset mid-assignment makes the command refuse instead.
		await until(
			async () => expectOk(await r.requirementsRepo.listByZone('zone-a' as never)).length === 1,
			'the requirement exists',
		);

		// The asset leaves the catalog under the requirement — the dangling reference.
		expectOk(await r.assetsRepo.delete(areaAsset.entity.id, areaAsset.version));
		// Re-select, which is what re-runs the panel's query.
		click(r.harness.canvasEl as HTMLElement, 900, 900);
		await until(() => !r.harness.wrapper.text().includes('Delete zone'), 'the zone is deselected');
		click(r.harness.canvasEl as HTMLElement, 300, 300);

		await until(
			() => r.harness.wrapper.text().includes('Asset missing from the catalog.'),
			'the missing-asset row',
		);
		// Built from the id, and never reported "current" for a figure it cannot re-derive.
		expect(r.harness.wrapper.text()).toContain(areaAsset.entity.id);
		expect(r.harness.wrapper.text()).toContain('Figures are out of date');
		r.harness.unmount();
	});

	/**
	 * The THIRD writer of this panel, and the one an assign-only test cannot stand in for: a
	 * Zone-geometry commit changes the requirement's inputs, and the cascade that
	 * recalculates it runs inside the dispatch precisely so slice 8's ONE post-command
	 * re-query finds finished numbers rather than racing them.
	 */
	it('a zone reshape leaves the RECALCULATED figures on screen, with no reselect', async () => {
		const r = await rigWithAssets(['Screed']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];
		if (areaAsset === undefined) throw new Error('expected a seeded asset');

		await selectZoneAndAssign(r, areaAsset.entity.id);
		await until(
			async () => expectOk(await r.requirementsRepo.listByZone('zone-a' as never)).length === 1,
			'the requirement exists',
		);
		const before = expectOk(await r.requirementsRepo.listByZone('zone-a' as never))[0];
		if (before === undefined) throw new Error('expected the requirement');
		const beforeCost = before.entity.estimatedCost.calculated.amount;

		// Drag vertex 0, exactly as `zoneEditing.test.ts` does — a reshape rather than a
		// move, because a translation preserves area and would change no figure at all.
		const canvas = r.harness.canvasEl as HTMLElement;
		pointer(canvas, 'pointerdown', 199, 199);
		pointer(canvas, 'pointermove', 250, 250);
		pointer(canvas, 'pointerup', 250, 250);

		await until(
			async () => {
				const live = expectOk(await r.requirementsRepo.listByZone('zone-a' as never))[0];
				return live !== undefined && live.entity.estimatedCost.calculated.amount !== beforeCost;
			},
			'the cascade recalculated the requirement',
		);
		const after = expectOk(await r.requirementsRepo.listByZone('zone-a' as never))[0];
		if (after === undefined) throw new Error('expected the requirement');

		// On the PANEL, without a reselect: the whole point of the assertion. The vault
		// holding the new figure would be true of a stale panel too.
		await until(
			() => r.harness.wrapper.text().includes(after.entity.estimatedCost.calculated.amount),
			'the panel carries the recalculated cost',
		);
		expect(r.harness.wrapper.text()).not.toContain(beforeCost);

		// And undoing the GEOMETRY command puts the requirement's figures back with it —
		// one history entry, not two: a single Undo is enough.
		toolbarButton(r.harness, 'Undo').click();
		await until(
			() => r.harness.wrapper.text().includes(beforeCost),
			'the panel carries the pre-drag cost again',
		);
		r.harness.unmount();
	});

	it('applies a COST override the same way, and resets it', async () => {
		const r = await rigWithAssets(['Grout']);
		const areaAsset = expectOk(await r.assetsRepo.listAll())[0];

		await selectZoneAndAssign(r, areaAsset.entity.id);
		await until(() => r.harness.wrapper.find('input[data-field="cost"]').exists(), 'the cost override input renders');

		const costInput = r.harness.wrapper.find('input[data-field="cost"]');
		if (!costInput.exists()) throw new Error('no cost override input');
		await costInput.setValue('99.99');
		await costInput.trigger('blur');

		await until(() => r.harness.wrapper.text().includes('99.99 EUR'), 'effective cost overridden');
		expect(r.harness.wrapper.text()).toContain('Overridden');

		await r.harness.wrapper.find('.rp-requirement-reset-cost').trigger('click');
		await until(
			() => !r.harness.wrapper.text().includes('Overridden'),
			'cost override cleared',
		);
		r.harness.unmount();
	});
});
