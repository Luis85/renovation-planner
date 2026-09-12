import { describe, expect, it, vi } from 'vitest';
import { guardedPlanNorth } from '../../src/plugin/guardedPlanNorth';
import type { PlanNorthServices } from '../../src/application/commands/plan/SetPlanNorth';
import { recorder } from '../helpers/logger';

const fault = () => Promise.reject(new Error('disk unavailable'));

describe('plan north application boundary', () => {
	it('maps and logs thrown execute and undo faults through the argument-taking factory', async () => {
		const raw: PlanNorthServices = { command: vi.fn<PlanNorthServices['command']>(() => ({ execute: fault, undo: fault })) };
		const command = guardedPlanNorth(raw, recorder).command('floor' as never, 90);
		expect(raw.command).toHaveBeenCalledWith('floor', 90);
		for (const result of [await command.execute(), await command.undo()]) expect(result).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
	});
});
