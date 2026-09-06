import { describe, expect, it, vi } from 'vitest';
import { guardedStructure } from '../../src/plugin/guardedStructure';
import type { StructureServices } from '../../src/application/commands/spatial/StructureCommand';
import { recorder } from '../helpers/logger';
import { structureStack } from '../helpers/structure';

const fault = () => Promise.reject(new Error('disk unavailable'));
describe('spatial application boundary', () => {
	it('maps and logs thrown read, execute and undo faults; forwards Room history construction', async () => {
		const { services } = await structureStack();
		const raw: StructureServices = { ...services, read: fault, command: vi.fn<StructureServices['command']>(() => ({ execute: fault, undo: fault })) };
		const guarded = guardedStructure(raw, recorder);
		expect(await guarded.read('floor' as never)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		const input = {} as never, command = guarded.command(input);
		expect(raw.command).toHaveBeenCalledWith(input);
		for (const result of [await command.execute(), await command.undo()]) expect(result).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		expect(guarded.roomHistory()).toBeDefined();
	});
});
