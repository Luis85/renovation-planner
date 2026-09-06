/**
 * @vitest-environment jsdom
 *
 * The dialog content `accessibility.test.ts`'s own 450-line budget has no room for (V7):
 * `NewAssetForm` in both `catalogueFrozen` states, `NewPlanForm`, `AssetDimensionsDialog` —
 * which no case anywhere scans — and `ConfirmDialog`/`DeleteReferenceDialog` with a
 * descriptor shaped like a real caller's rather than that file's generic `it.each` stub.
 *
 * Same mount, same store, same `./axeOptions` — shared rather than copied, for the reason
 * that file's header states: a second copy of `LAYOUT_DEPENDENT_RULES` is a second copy that
 * can fall out of step with the one claim this suite makes about what it can honestly grade.
 * See `accessibility.test.ts`'s header for that ceiling in full; it applies here unchanged.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { mountHarness } from './mount';
import { runOptions } from './axeOptions';
import { useDialogStore } from '../../src/presentation/dialogs/dialog-store';
import { err, ok } from '../../src/core/result/Result';
import NewAssetForm from '../../src/presentation/views/NewAssetForm.vue';
import NewPlanForm from '../../src/presentation/views/NewPlanForm.vue';
import { makeAsset, makePlan } from '../helpers/entities';
import { recorder } from '../helpers/logger';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { ObservationToken } from '../../src/application/ports/versioning';

beforeEach(() => {
	document.body.innerHTML = '';
});

/** Sets a control's value and fires the `input` event `onFieldInput`/`onNameInput` listen for. */
function type(el: Element | null, value: string): void {
	(el as HTMLInputElement).value = value;
	el?.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('axe against dialog content accessibility.test.ts has no room for', () => {
	it('reports no semantic violations with the New Asset form open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'form',
			title: 'New asset',
			component: NewAssetForm,
			props: {
				createAsset: () => Promise.resolve(ok(makeAsset())),
				setFootprintFromDimensions: () => Promise.resolve(ok('wrote')),
				logger: recorder,
				defaultCurrency: 'EUR',
			},
		});
		await nextTick();

		expect(view.contentEl.querySelector('.rp-dialog-form')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});

	/**
	 * `catalogueFrozen`'s TRUE arm, reached the way a user reaches it rather than by poking the
	 * ref: `createdAssetId` has no prop to set it through, and `FormDialog.onSubmit` resolves
	 * (and closes) the dialog the instant `NewAssetForm` emits `submit` — so the only way to
	 * see the frozen catalogue with the dialog still OPEN is the real path that leaves it open,
	 * a footprint write that fails after the asset was already created. `createAsset` succeeds,
	 * `setFootprintFromDimensions` refuses, `form.submit()` answers `false`, and the component
	 * never emits — exactly Rule 2 of its own header (the created id is kept and reused on
	 * retry, because a vault fault after the note is committed must not strand it).
	 */
	it('reports no semantic violations with the New Asset form open and the catalogue frozen', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'form',
			title: 'New asset',
			component: NewAssetForm,
			props: {
				createAsset: () => Promise.resolve(ok(makeAsset())),
				setFootprintFromDimensions: () =>
					Promise.resolve(err({ category: 'Vault', code: 'vault.unexpected-failure', message: 'x' })),
				logger: recorder,
				defaultCurrency: 'EUR',
			},
		});
		await nextTick();

		type(view.contentEl.querySelector('[data-field="name"]'), 'Kitchen island');
		type(view.contentEl.querySelector('[data-field="unitCostAmount"]'), '450.00');
		type(view.contentEl.querySelector('[data-field="width"]'), '2');
		type(view.contentEl.querySelector('[data-field="depth"]'), '3');
		view.contentEl
			.querySelector('form.rp-dialog-form')
			?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await flushPromises();
		await nextTick();

		// Load-bearing for the reason every other presence assertion in this file's sibling is:
		// a scan of nothing at all also reports zero violations, and it also proves the dialog
		// stayed open rather than resolving on the failed retry.
		expect(view.contentEl.querySelector('.rp-new-asset__created')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});

	it('reports no semantic violations with the New Plan form open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'form',
			title: 'New plan',
			component: NewPlanForm,
			props: {
				projectId: 'project-1',
				dispatch: () =>
					Promise.resolve(
						ok({
							plan: {
								entity: makePlan({ projectId: 'project-1' as ProjectId }),
								version: { revision: 1, observed: 'observed-1' as ObservationToken },
							},
						}),
					),
				logger: recorder,
			},
		});
		await nextTick();

		expect(view.contentEl.querySelector('.rp-dialog-form')).not.toBeNull();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});

	/**
	 * A `danger` confirmation, the shape `calibrationDeps.confirmRecalibration`
	 * (`src/presentation/designer/runtime.ts`) opens for real — rather than
	 * `accessibility.test.ts`'s placeholder `it.each`, whose `confirm` case never sets that
	 * flag. That case exists to prove the FRAMEWORK's markup; this one scans the danger
	 * styling `ConfirmDialog.vue` applies to its confirm button, which nothing else does.
	 */
	it('reports no semantic violations with the Confirm dialog open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'confirm',
			title: 'Delete this project?',
			message: 'This removes the project and every plan, zone and requirement in it.',
			confirmLabel: 'Delete',
			danger: true,
		});
		await nextTick();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});

	/**
	 * Two rows rather than the generic `it.each`'s one: `deleteAssetFlow.ts`'s own
	 * `listReferencing` answers one `ReferencingGroup` PER PROJECT an asset's requirements
	 * reference it from, so a catalogue entry used in more than one project is the realistic
	 * multi-row case that stub never renders.
	 */
	it('reports no semantic violations with the Delete Reference dialog open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'delete-reference',
			entityLabel: 'Porcelain tile',
			references: [
				{ label: 'Kitchen renovation', count: 3 },
				{ label: 'Guest bathroom', count: 1 },
			],
		});
		await nextTick();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});

	it('reports no semantic violations with the Asset Dimensions dialog open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'asset-dimensions',
			title: 'Edit the footprint',
			initial: { width: 2, depth: 3 },
		});
		await nextTick();

		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});
});
