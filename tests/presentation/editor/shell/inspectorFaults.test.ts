// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { Decimal } from 'decimal.js';
import { settleUntil as until } from '../../../helpers/editor';
import { click, PROJECT_ID, rig, toolbarButton } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { lines, resetRecorder } from '../../../helpers/logger';
import { activateNotices } from '../../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../../helpers/dom';

// `activateNotices` — reached here through the real plugin/editor wiring — appends its
// two live regions with Obsidian's `createDiv`, one of the prototype extensions the app
// installs globally and this suite installs per file.
installObsidianDom();

/**
 * SDD §65's two failure halves, at the Inspector's own controls: a THROWN technical fault
 * and a RESOLVED refusal. Both must reach the user as a notice, and the leaf must keep
 * working afterwards — a panel button that silently stops responding is the one failure
 * mode worse than an error message.
 *
 * Driven through the REAL mounted editor because the seam being checked is the wiring:
 * every one of these paths is a `catch` or an `if (!result.ok)` that no unit test of the
 * flow or the store can reach, since neither owns the notice.
 *
 * **Each thrown-fault case asserts BOTH representations**, which is SDD §66's "produced
 * together and must not drift into being produced from two independent code paths" turned
 * into an assertion rather than left as prose. These two doors stand where no guard did —
 * the ports beneath them are outside the Error Boundary by design — so if they printed
 * alone, the user would get a sentence and a developer would get nothing, and the raw cause
 * would be gone for good. The notice half is asserted on `Notice.shown`; the log half on
 * the recorder's `lines`, checking that the ORIGINAL exception is what `cause` carries.
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

/** One door's log line, or undefined — the recorder is shared across this file. */
function faultLine(event: string) {
	return lines.find((line) => line.event === event);
}

describe('a failure at an Inspector control', () => {
	beforeEach(() => {
		resetRecorder();
		// A notice is INERT until something activates the queue — `onload` is what does that
		// in production. Per TEST, because the queue DEDUPS: three cases here raise the SAME
		// mapped sentence, and against one shared queue the second and third would fold into
		// a `(×2)` and construct no `Notice`, so every delta assertion below would fail.
		activateNotices();
	});

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

		// EXACTLY one: `commitEdit` calls `commitField`, whose own guard must map and log a
		// thrown fault WITHOUT notifying, or this path — like the row's — would announce the
		// same fault twice. `Notice.shown.at(-1)` alone cannot see a duplicate; only a count
		// can.
		expect(Notice.shown.length - before).toBe(1);

		// MAPPED, not printed. The exception's own message is developer text — often an
		// engine's words, sometimes a file path — and the DoD forbids it in a user-facing
		// message outright. `notifyFault` turns the cause into the same coded
		// `PersistenceError` a guarded service would have produced and prints the locale
		// table's copy for it. The negative assertion is the one that fails if anybody
		// reverts to `notify(cause.message)`.
		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		expect(Notice.shown.at(-1)).not.toContain('the vault exploded');

		// The DEVELOPER half, from the same mapping step. The notice is deliberately free of
		// the exception's own words, so this line is the only place they survive at all —
		// which is why its absence would be a silent loss rather than a visible one.
		const logged = faultLine('editor.dispatch.faulted');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('the vault exploded');
		expect(logged?.context?.['code']).toBe('vault.unexpected-failure');
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

		// Mapped rather than printed, for the reason the first case gives — this is the
		// SECOND of the two thrown-fault doors in `runtime.ts`, and both go through
		// `notifyFault` so neither can drift back into printing the raw text.
		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		expect(Notice.shown.at(-1)).not.toContain('the index is gone');

		// Its OWN event name, so a log line says which of the two doors faulted — the same
		// reason `guardCommand` takes one per service rather than sharing a single key.
		const logged = faultLine('editor.deleteZone.faulted');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('the index is gone');
		// Still there: nothing was dispatched.
		expect(expectOk(await r.zonesRepo.getById('zone-a' as never))).not.toBeNull();
		r.harness.unmount();
	});

	it('a thrown NON-Error still reaches the user, as a mapped refusal', async () => {
		// `throw 'a string'` is legal JavaScript and a real hazard at a library boundary.
		// It used to be printed verbatim; now it is mapped like any other cause, so the user
		// gets the same sentence either way and a notice reading "[object Object]" or nothing
		// at all is impossible by construction rather than by a ternary.
		const r = await selectedZone();
		const before = Notice.shown.length;
		const notAnError: unknown = 'the index is a string fault';
		r.requirementsRepo.listByZone = () => {
			throw notAnError;
		};

		toolbarButton(r.harness, 'Delete zone').click();
		await until(() => Notice.shown.length > before, 'the fault notice');

		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		expect(Notice.shown.at(-1)).not.toContain('the index is a string fault');
		// A non-Error cause reaches the log VERBATIM, unlike the notice: the log line is
		// where the raw thing belongs, whatever shape it turned out to be.
		expect(faultLine('editor.deleteZone.faulted')?.context?.['cause']).toBe(notAnError);
		r.harness.unmount();
	});

	/**
	 * The fault guard `commitField` (`presentation/editor/commitField.ts`) exists for
	 * (design slice 16): binding a Requirement override's `commit` prop straight to
	 * `inspector.commit` would drop its `try`/`catch`, and every dispatch here is ultimately
	 * bound to a `@blur` handler whose promise nothing awaits — so a thrown fault would
	 * become an unhandled rejection reaching nobody, and the field would silently stop
	 * responding.
	 */
	it('a THROWN fault during a quantity override reaches the user as a notice, and the typed value survives', async () => {
		const r = await selectedZone();
		await assign(r);
		await until(
			async () => expectOk(await r.requirementsRepo.listByZone('zone-a' as never)).length === 1,
			'the requirement exists',
		);
		await until(() => r.harness.wrapper.find('input[data-field="quantity"]').exists(), 'the override input renders');

		const before = Notice.shown.length;
		r.requirementsRepo.save = () => {
			throw new Error('the vault exploded');
		};

		const qtyInput = r.harness.wrapper.find('input[data-field="quantity"]');
		await qtyInput.setValue('9');
		await qtyInput.trigger('blur');
		await until(() => Notice.shown.length > before, 'the fault notice');

		// EXACTLY one: `commitField` maps and logs the fault WITHOUT notifying, so the only
		// announcement is `useFieldCommit`'s own `notify` routing the unmapped code to the
		// banner. Two notices for one fault (`commitField` announcing it AND the composable
		// announcing it again) was this task's own review-round regression.
		expect(Notice.shown.length - before).toBe(1);

		// MAPPED, not printed — the same rule the assignment case above proves.
		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		expect(Notice.shown.at(-1)).not.toContain('the vault exploded');

		// The guard: `commitField` converts the fault it caught into a failed `Result`
		// rather than letting the promise reject, so `useFieldCommit` never
		// reads it as an accepted commit. A missing guard would either leave this an
		// unhandled rejection (failing the test outright) or — if the composable's own
		// success branch ran regardless — silently reset the input to blank.
		expect((qtyInput.element as HTMLInputElement).value).toBe('9');

		const logged = faultLine('editor.dispatch.faulted');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('the vault exploded');
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
