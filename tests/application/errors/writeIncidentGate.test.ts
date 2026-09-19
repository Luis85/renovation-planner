import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError, PersistenceError } from '../../../src/core/errors/AppError';
import { persistenceError } from '../../../src/application/errors';
import { guardCommand, guardQuery, WRITES_PAUSED_CODE } from '../../../src/application/errors/guardAgainstThrowing';
import type { VaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import { markUncompensated } from '../../../src/application/commands/DispatchOutcome';
import {
	WriteIncidentRegistry,
	installWriteIncidentRegistry,
} from '../../../src/application/incidents/WriteIncidentRegistry';
import { InMemoryWriteIncidentStore } from '../../helpers/InMemoryWriteIncidentStore';
import { expectErr, expectOk } from '../../helpers/domain';
import { recorder, resetRecorder } from '../../helpers/logger';

/**
 * ADR-0034's gate, at the one chokepoint that sees every command dispatch.
 *
 * `installWriteIncidentRegistry` is module-level state, so every case here installs its own
 * and `afterEach` takes it back off — the reset is owed WITHIN this file, and vitest's
 * per-file module registry is what keeps it from reaching any other.
 */

const map: VaultExceptionMapper = (cause) => ({ ...persistenceError('vault.threw', 'threw', cause), technicalFault: true });

type Dispatch = (input: string) => Promise<Result<string, AppError>>;

function guarded(execute: Dispatch): { execute: (input: string) => Promise<Result<string, AppError | PersistenceError>>; spy: ReturnType<typeof vi.fn<Dispatch>> } {
	const spy = vi.fn<Dispatch>(execute);
	return { execute: guardCommand({ execute: spy }, 'command.test.failed', recorder, map).execute, spy };
}

async function openRegistry(): Promise<WriteIncidentRegistry> {
	const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
	await registry.record({ ...persistenceError('zone.sidecar-write-uncompensated', 'left standing'), uncompensatedWrite: [] });
	return registry;
}

describe('the write-incident gate on guardCommand', () => {
	beforeEach(resetRecorder);
	afterEach(() => installWriteIncidentRegistry(null));

	it('refuses a guarded command while an incident is open, without reaching its execute', async () => {
		installWriteIncidentRegistry(await openRegistry());
		const { execute, spy } = guarded(() => Promise.resolve(ok('wrote')));

		const refused = expectErr(await execute('anything'));

		expect(refused.code).toBe(WRITES_PAUSED_CODE);
		expect(refused.category).toBe('Persistence');
		// The not-called is the assertion that matters: a refusal AFTER the write would be the
		// same returned error over a vault this gate was supposed to leave alone.
		expect(spy).not.toHaveBeenCalled();
	});

	it('lets a guarded QUERY run while an incident is open, so the vault stays inspectable', async () => {
		installWriteIncidentRegistry(await openRegistry());
		const read = vi.fn<(input: string) => Promise<Result<string, AppError>>>(() => Promise.resolve(ok('data')));

		const answered = guardQuery({ execute: read }, 'query.test.failed', recorder, map);

		expect(expectOk(await answered.execute('anything'))).toBe('data');
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('runs the command normally while nothing is open', async () => {
		installWriteIncidentRegistry(new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder));
		const { execute, spy } = guarded(() => Promise.resolve(ok('wrote')));

		expect(expectOk(await execute('anything'))).toBe('wrote');
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('runs the command normally when no registry is installed at all', async () => {
		const { execute, spy } = guarded(() => Promise.resolve(ok('wrote')));
		expect(expectOk(await execute('anything'))).toBe('wrote');
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('records an incident from a failed result carrying the stamp, and shuts on the next command', async () => {
		const store = new InMemoryWriteIncidentStore();
		const registry = new WriteIncidentRegistry(store, recorder);
		installWriteIncidentRegistry(registry);
		const { execute } = guarded(() =>
			Promise.resolve(err(markUncompensated(persistenceError('zone.sidecar-write-uncompensated', 'left standing'), [{ entityKind: 'zone', entityId: 'zone-1' }]))),
		);

		expect(expectErr(await execute('anything')).code).toBe('zone.sidecar-write-uncompensated');
		expect(registry.anyOpen()).toBe(true);

		const second = guarded(() => Promise.resolve(ok('wrote')));
		expect(expectErr(await second.execute('anything')).code).toBe(WRITES_PAUSED_CODE);
		expect(second.spy).not.toHaveBeenCalled();
		expect(expectOk(await store.list())[0]?.affected).toEqual([{ entityKind: 'zone', entityId: 'zone-1' }]);
	});

	it('records an incident from a stamp that names NOTHING — a presence test, not an emptiness test', async () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		installWriteIncidentRegistry(registry);
		const { execute } = guarded(() => Promise.resolve(err(markUncompensated(persistenceError('plan.write-uncompensated', 'left standing'), []))));

		await execute('anything');

		expect(registry.anyOpen()).toBe(true);
	});

	it('records nothing for a failed result WITHOUT the stamp', async () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		installWriteIncidentRegistry(registry);
		const { execute } = guarded(() => Promise.resolve(err(persistenceError('zone.save-failed', 'nothing landed'))));

		await execute('anything');

		expect(registry.anyOpen()).toBe(false);
	});

	it('records nothing for a successful command', async () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		installWriteIncidentRegistry(registry);
		const { execute } = guarded(() => Promise.resolve(ok('wrote')));

		await execute('anything');

		expect(registry.anyOpen()).toBe(false);
	});

	it('records nothing for a THROW, which the boundary maps to a pre-write fault', async () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		installWriteIncidentRegistry(registry);
		const { execute } = guarded(() => Promise.reject(new Error('boom')));

		expect(expectErr(await execute('anything')).code).toBe('vault.threw');
		expect(registry.anyOpen()).toBe(false);
	});
});
