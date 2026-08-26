import { describe, expect, it } from 'vitest';
import { isErr } from '../../../src/core/result/Result';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';

/**
 * The refusal write side for a session whose settings could not be recovered: every
 * member answers the same `settings.unrecovered` failure rather than throwing, so a
 * restored Plan Editor leaf stays mounted and gestures fail like any other failed write
 * (`docs/tasks/08-zone-editing.md` inherits slice 5's "TOTAL rather than nullable" rule).
 */
describe('unavailablePlanEditorCommands', () => {
	const commands = unavailablePlanEditorCommands();

	it('refuses every command with the unrecovered-settings error', async () => {
		expect(await commands.createZone.execute(undefined as never)).toMatchObject({
			ok: false,
			error: { code: 'settings.unrecovered' },
		});
		expect(await commands.moveObject.execute(undefined as never)).toMatchObject({
			ok: false,
			error: { code: 'settings.unrecovered' },
		});
		expect(await commands.deleteZone.execute(undefined as never)).toMatchObject({
			ok: false,
			error: { code: 'settings.unrecovered' },
		});
	});

	it('refuses every repository read and write', async () => {
		const zoneId = 'zone-x' as never;
		expect(await commands.zones.getById(zoneId)).toMatchObject({ ok: false });
		expect(await commands.zones.save(undefined as never, 'absent')).toMatchObject({ ok: false });
		expect(await commands.zones.delete(zoneId, undefined as never)).toMatchObject({ ok: false });
		expect(await commands.zones.listByProject('p' as never)).toMatchObject({ ok: false });
		expect(await commands.zones.listByPlan('p' as never)).toMatchObject({ ok: false });
	});

	it('refuses the Inspector query', async () => {
		expect(await commands.zoneInspector.execute({ zoneId: 'zone-x' as never })).toMatchObject({
			ok: false,
			error: { code: 'settings.unrecovered' },
		});
	});

	it('refuses a calibration when settings could not be recovered', async () => {
		const result = await unavailablePlanEditorCommands()
			.calibratePlan()
			.execute({ planId: 'p-1' as PlanId, pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, knownDistance: 1000 });

		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
	});

	it('refuses a calibration undo when settings could not be recovered', async () => {
		const result = await unavailablePlanEditorCommands().calibratePlan().undo();

		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
	});

	/**
	 * Design slice 10's Requirements panel edits. These are the REAL command classes,
	 * constructed over ports whose every member refuses — so what is asserted here is that
	 * a panel gesture in an unrecovered session fails with the same `settings.unrecovered`
	 * shape every other write does, rather than throwing out of a command that assumed a
	 * repository answered.
	 */
	describe('the Requirements panel edits', () => {
		it('refuses an assignment', async () => {
			const result = await commands.requirementEdits.assignAsset.execute({
				zoneId: 'zone-x' as never,
				assetId: 'asset-x' as never,
			});

			expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		});

		/**
		 * BOTH entry points of each override command. `execute` and `executeWithVersion` are
		 * two doors onto one write — the reversible adapters take the second, because an undo
		 * needs the version its own execute produced — and a refusal that only covered one
		 * would leave the door the panel actually uses untested.
		 */
		it('refuses both overrides, through either entry point', async () => {
			const { setQuantityOverride, setCostOverride } = commands.requirementEdits;
			const refusals = [
				await setQuantityOverride.execute({ requirementId: 'req-x' as never, quantity: 7 }),
				await setQuantityOverride.executeWithVersion({ requirementId: 'req-x' as never, quantity: 7 }),
				await setCostOverride.execute({ requirementId: 'req-x' as never, cost: null }),
				await setCostOverride.executeWithVersion({ requirementId: 'req-x' as never, cost: null }),
			];

			for (const refusal of refusals) {
				expect(isErr(refusal) && refusal.error.code).toBe('settings.unrecovered');
			}
		});

		/**
		 * The two ports the reversible adapters restore THROUGH. A member the proxy was
		 * never written for refuses too rather than answering `undefined` — which is the
		 * whole reason it is a proxy and not twelve hand-written methods, so the assertion
		 * covers a member this version does not declare.
		 */
		it('refuses every requirement and asset repository call, declared or not', async () => {
			expect(await commands.requirementEdits.requirements.getById('req-x' as never)).toMatchObject({
				ok: false,
			});
			expect(await commands.requirementEdits.assets.getById('asset-x' as never)).toMatchObject({
				ok: false,
			});
			expect(
				await (commands.requirementEdits.requirements as unknown as {
					aMemberThisVersionDoesNotDeclare(): Promise<unknown>;
				}).aMemberThisVersionDoesNotDeclare(),
			).toMatchObject({ ok: false });
		});
	});
});
