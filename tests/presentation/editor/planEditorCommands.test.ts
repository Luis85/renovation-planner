import { describe, expect, it } from 'vitest';
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
});
