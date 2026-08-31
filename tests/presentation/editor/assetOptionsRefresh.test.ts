// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { ok } from '../../../src/core/result/Result';
import { fakeQueries, mountPlanEditor, settle, settleUntil as until } from '../../helpers/editor';
import { click, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';

/**
 * **The assign picker's options in a RESTORED leaf.**
 *
 * `PlanEditorView.sync()` mounts on the restored view state rather than on a resolved
 * plan, and Obsidian restores its leaves BEFORE `onLayoutReady` — so on the ordinary
 * restart path the runtime's one read of the asset catalogue lands against a still-empty
 * project index and answers nothing. `PlanEditorRoot` subscribes its own `hydrate` to
 * `onPlanChanged`, which carries `ProjectIndexRebuilt`, so the PLAN recovers when the
 * index is rebuilt; before this fix the OPTIONS did not, and the picker stayed empty for
 * the life of the leaf.
 *
 * Both halves are asserted, because a subscription and its disposal are two claims: the
 * options must repopulate when the event fires, and a leaf whose Vue tree is gone must
 * not read again for an event it no longer has any business hearing.
 */
describe('the assign picker options', () => {
	it('repopulates when the plan-change event fires after the index was empty at mount', async () => {
		// No assets at mount — the empty index a restored leaf reads.
		const r = await rig();
		toolbarButton(r.harness, 'Select').click();
		click(r.harness.canvasEl as HTMLElement, 300, 300);
		await until(() => r.harness.wrapper.text().includes('Assign'), 'assign control visible');

		const optionValues = (): string[] => {
			const select = r.harness.wrapper.find('#rp-assign-asset');
			if (!select.exists()) throw new Error('no assign picker');
			return [...(select.element as HTMLSelectElement).options].map((option) => option.value);
		};
		expect(optionValues()).toEqual([]);

		// The index catches up — a catalogue that was unreadable at mount is readable now.
		await r.assetsRepo.save(
			makeAsset({ name: 'Floor tiles', unit: 'm2', wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		);
		const asset = expectOk(await r.assetsRepo.listAll())[0];
		if (asset === undefined) throw new Error('expected the asset to have been saved');

		r.harness.changePlan();
		await until(
			() => optionValues().includes(asset.entity.id),
			'the asset appears in the picker after the plan-change event',
		);

		r.harness.unmount();
	});

	it('stops reading the catalogue once the leaf is unmounted', async () => {
		let reads = 0;
		const queries = {
			...fakeQueries(null),
			listAssets: () => {
				reads += 1;
				return Promise.resolve(ok([]));
			},
		};
		const harness = await mountPlanEditor({ plan: null, queries });
		expect(reads).toBe(1);

		harness.changePlan();
		await settle();
		expect(reads).toBe(2);

		// Obsidian REUSES a view, so a listener outliving its Vue tree would go on reading
		// through a retired context and writing into a ref nothing renders any more.
		harness.unmount();
		harness.changePlan();
		await settle();
		expect(reads).toBe(2);
	});
});
