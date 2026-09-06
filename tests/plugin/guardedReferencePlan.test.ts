import { describe, expect, it, vi } from 'vitest';
import { guardedReferencePlan } from '../../src/plugin/guardedReferencePlan';
import type { ReferencePlanServices } from '../../src/application/commands/plan/ConfigurePlanReference';
import { recorder } from '../helpers/logger';

const fault = () => Promise.reject(new Error('disk unavailable'));

describe('reference application boundary', () => {
	it('maps and logs thrown baseline, execute and undo faults through the argument-taking factory', async () => {
		const raw: ReferencePlanServices = { read: fault, command: vi.fn<ReferencePlanServices['command']>(() => ({ execute: fault, undo: fault })) };
		const guarded = guardedReferencePlan(raw, recorder);
		expect(await guarded.read('floor' as never)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		const baseline = {} as never, input = {} as never, command = guarded.command(baseline, input);
		expect(raw.command).toHaveBeenCalledWith(baseline, input);
		for (const result of [await command.execute(), await command.undo()]) expect(result).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
	});
});
