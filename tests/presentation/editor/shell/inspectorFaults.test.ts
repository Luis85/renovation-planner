// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { Decimal } from 'decimal.js';
import { settleUntil as until } from '../../../helpers/editor';
import { click, PROJECT_ID, rig, toolbarButton } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/**
 * SDD §65's two failure halves, at the Inspector's own controls: a THROWN technical fault
 * and a RESOLVED refusal. Both must reach the user as a notice, and the leaf must keep
 * working afterwards — a panel button that silently stops responding is the one failure
 * mode worse than an error message.
 *
 * Driven through the REAL mounted editor because the seam being checked is the wiring:
 * every one of these paths is a `catch` or an `if (!result.ok)` that no unit test of the
 * flow or the store can reach, since neither owns the notice.
 */

async function selectedZone(seedAssets = 1) {
	const r = await rig(async ({ assets }) => {
		for (let index = 0; index < seedAssets; index += 1) {
			await assets.save(
				makeAsset({
					projectId: PROJECT_ID,
					name: `Asset ${index}`,
					unit: 'm2',
					wasteFactorDefault: new Decimal('0.10'),
				}),
				'absent',
			);
		}
	});
	toolbarButton(r.harness, 'Select').click();
	click(r.harness.canvasEl as HTMLElement, 300, 300);
	await until(() => r.harness.wrapper.text().includes('Delete zone'), 'the panel shows the zone');
	return r;
}

/** Pick the first offered asset and press Assign. */
async function assign(r: Awaited<ReturnType<typeof selectedZone>>): Promise<void> {
	const asset = expectOk(await r.assetsRepo.listByProject(PROJECT_ID))[0];
	if (asset === undefined) throw new Error('expected a seeded asset');
	await until(() => {
		const el = r.harness.wrapper.find('#rp-assign-asset').element as HTMLSelectElement;
		return [...el.options].some((option) => option.value === asset.entity.id);
	}, 'the asset is offered');
	await r.harness.wrapper.find('#rp-assign-asset').setValue(asset.entity.id);
	const button = r.harness.wrapper.findAll('button').find((b) => b.text() === 'Assign');
	if (!button) throw new Error('no Assign button');
	await button.trigger('click');
}

describe('a failure at an Inspector control', () => {
	it('a THROWN fault during an assignment reaches the user as a notice', async () => {
		const r = await selectedZone();
		const before = Notice.shown.length;
		// A technical fault at the port, not a refusal: `reportFault` is the only thing
		// between it and an unhandled rejection inside a click handler.
		r.requirementsRepo.save = () => {
			throw new Error('the vault exploded');
		};

		await assign(r);
		await until(() => Notice.shown.length > before, 'the fault notice');

		expect(Notice.shown.at(-1)).toContain('the vault exploded');
		r.harness.unmount();
	});

	it('a RESOLVED refusal during an assignment reaches the user as a notice', async () => {
		const r = await selectedZone();
		const before = Notice.shown.length;
		r.requirementsRepo.save = () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'vault.locked', message: 'The vault is read-only.' },
			}) as ReturnType<typeof r.requirementsRepo.save>;

		await assign(r);
		await until(() => Notice.shown.length > before, 'the refusal notice');

		// The notice carries the LOCALE table's copy for the error, never the error's own
		// `message` — 'The vault is read-only.' is log text, and slice 11's boundary is what
		// keeps it out of a Notice. `vault.locked` has no key of its own, so `toUserMessage`
		// falls back to the category line.
		expect(Notice.shown.at(-1)).toContain('The vault could not be read or written.');
		r.harness.unmount();
	});

	it('a THROWN fault while READING the referents of a delete reaches the user', async () => {
		const r = await selectedZone();
		const before = Notice.shown.length;
		// The delete flow runs outside `commitEdit`, so it carries its own last stop for a
		// thrown fault — without one this is an unhandled rejection and the button goes quiet.
		r.requirementsRepo.listByZone = () => {
			throw new Error('the index is gone');
		};

		toolbarButton(r.harness, 'Delete zone').click();
		await until(() => Notice.shown.length > before, 'the fault notice');

		expect(Notice.shown.at(-1)).toContain('the index is gone');
		// Still there: nothing was dispatched.
		expect(expectOk(await r.zonesRepo.getById('zone-a' as never))).not.toBeNull();
		r.harness.unmount();
	});

	it('a thrown NON-Error still reaches the user, as its own string', async () => {
		// `throw 'a string'` is legal JavaScript and a real hazard at a library boundary;
		// `cause instanceof Error` is false for it, and a notice reading "[object Object]"
		// or nothing at all is what the other arm of that expression exists to prevent.
		const r = await selectedZone();
		const before = Notice.shown.length;
		const notAnError: unknown = 'the index is a string fault';
		r.requirementsRepo.listByZone = () => {
			throw notAnError;
		};

		toolbarButton(r.harness, 'Delete zone').click();
		await until(() => Notice.shown.length > before, 'the fault notice');

		expect(Notice.shown.at(-1)).toContain('the index is a string fault');
		r.harness.unmount();
	});

	it('a Reassign with no eligible target is reported rather than opening an empty picker', async () => {
		const r = await selectedZone();
		await assign(r);
		await until(
			async () => expectOk(await r.requirementsRepo.listByZone('zone-a' as never)).length === 1,
			'the requirement exists',
		);

		const before = Notice.shown.length;
		toolbarButton(r.harness, 'Delete zone').click();
		await until(() => r.harness.wrapper.find('[data-rp-action="reassign"]').exists(), 'the dialog');
		await r.harness.wrapper.find('[data-rp-action="reassign"]').trigger('click');
		await until(() => Notice.shown.length > before, 'the unavailable notice');

		// This project has exactly one zone, so there is nothing to reassign to.
		expect(r.harness.wrapper.find('.rp-dialog-candidate').exists()).toBe(false);
		expect(expectOk(await r.zonesRepo.getById('zone-a' as never))).not.toBeNull();
		r.harness.unmount();
	});
});
