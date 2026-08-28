import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError, ErrorCategory } from '../../../../src/core/errors/AppError';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { affectsSaveState } from '../../../../src/presentation/editor/save-state/affects-save-state';
import { withSaveStateTracking } from '../../../../src/presentation/editor/save-state/with-save-state-tracking';
import {
	externalModification,
	revisionConflict,
	WRITE_BOUNDARY_CODES,
} from '../../../../src/application/ports/versioning';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

/**
 * Real-shaped, and NOT cast through `unknown`. An earlier draft built these with lowercase
 * categories and a cast, which compiled fine and concealed that `affectsSaveState` was
 * comparing against a literal outside `ErrorCategory` — a fake kinder than the real type,
 * hiding a source file that would not have built.
 */
const errorOf = (category: ErrorCategory, code = 'x'): AppError =>
	({ category, code: `zone.${code}`, message: 'developer text' }) as AppError;

type VoidResult = Result<void, AppError>;

const tracker = () => ({
	beginSaving: vi.fn<() => void>(),
	resolveOk: vi.fn<() => void>(),
	resolveErr: vi.fn<() => void>(),
	resolveNeutral: vi.fn<() => void>(),
});

const command = {} as UndoableCommand;

const historyResolving = (result: VoidResult) => ({
	run: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(result)),
	undo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(result)),
	redo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(result)),
});

const OPERATIONS = ['run', 'undo', 'redo'] as const;

describe('affectsSaveState', () => {
	it('ignores a pre-write validation refusal, which never reached the repository', () => {
		expect(affectsSaveState(errorOf('Validation', 'name-required'))).toBe(false);
	});

	it.each(['Persistence', 'Domain', 'Geometry', 'Migration', 'Reference', 'Calculation', 'Import'] as const)(
		'counts a %s failure, because the safe answer is "we might not have written your data"',
		(category) => {
			expect(affectsSaveState(errorOf(category))).toBe(true);
		},
	);

	// The two `ValidationError`s that mean the OPPOSITE of "wrote nothing": the command
	// reached the repository, the version had moved, and the user's edit was refused.
	it.each(WRITE_BOUNDARY_CODES)('counts a %s, despite its Validation category', (suffix) => {
		expect(affectsSaveState(errorOf('Validation', suffix))).toBe(true);
	});

	it('reads the codes from versioning.ts rather than a copy', () => {
		expect([...WRITE_BOUNDARY_CODES]).toEqual(['revision-conflict', 'external-modification']);
		expect(revisionConflict('zone', 'z1').code).toBe('zone.revision-conflict');
		expect(externalModification('zone', 'z1').code).toBe('zone.external-modification');
	});
});

describe('withSaveStateTracking', () => {
	it.each(OPERATIONS)('reports %s beginning and succeeding', async (operation) => {
		const history = historyResolving(ok(undefined));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		expect(save.beginSaving).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).toHaveBeenCalledTimes(1);
		expect(save.resolveErr).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('reports %s failing on a persistence error', async (operation) => {
		const history = historyResolving(err(errorOf('Persistence')));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		expect(save.resolveErr).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('settles %s NEUTRALLY for a validation refusal that wrote nothing', async (operation) => {
		const history = historyResolving(err(errorOf('Validation', 'name-required')));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		// Neither a failure to report nor evidence of a save. `resolveOk` here would let a
		// refusal that never touched the repository clear a real save error.
		expect(save.resolveNeutral).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
		expect(save.resolveErr).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('returns %s\'s own Result unchanged', async (operation) => {
		const result = err(errorOf('Persistence'));
		const history = historyResolving(result);
		const wrapped = withSaveStateTracking(history, tracker());

		const returned = await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());
		expect(returned).toBe(result);
	});

	it.each(OPERATIONS)('settles the batch when %s REJECTS rather than resolving', async (operation) => {
		const boom = new Error('the vault went away mid-write');
		const history = {
			run: vi.fn<() => Promise<VoidResult>>(() => Promise.reject(boom)),
			undo: vi.fn<() => Promise<VoidResult>>(() => Promise.reject(boom)),
			redo: vi.fn<() => Promise<VoidResult>>(() => Promise.reject(boom)),
		};
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await expect(
			operation === 'run' ? wrapped.run(command) : wrapped[operation](),
		).rejects.toBe(boom);

		expect(save.beginSaving).toHaveBeenCalledTimes(1);
		expect(save.resolveErr).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
	});

	it('leaves a later dispatch able to settle after a rejection, rather than wedging', async () => {
		// The real cost of a missed decrement: not a wrong reading, but an indicator that can
		// never settle again. Driven through the REAL store rather than a spy, because a spy
		// cannot show a counter that never returns to zero.
		setActivePinia(createPinia());
		const store = useSaveStateStore();

		const throwing = {
			run: vi.fn<() => Promise<VoidResult>>(() => Promise.reject(new Error('boom'))),
			undo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(ok(undefined))),
			redo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(ok(undefined))),
		};
		await expect(withSaveStateTracking(throwing, store).run(command)).rejects.toThrow('boom');
		expect(store.state).toBe('save-error');

		const healthy = historyResolving(ok(undefined));
		await withSaveStateTracking(healthy, store).run(command);
		expect(store.state).toBe('saved');
	});

	it('begins before the operation resolves, not after', async () => {
		const order: string[] = [];
		const save = {
			beginSaving: vi.fn<() => void>(() => {
				order.push('begin');
			}),
			resolveOk: vi.fn<() => void>(() => {
				order.push('ok');
			}),
			resolveErr: vi.fn<() => void>(),
			resolveNeutral: vi.fn<() => void>(),
		};
		const history = {
			run: vi.fn<() => Promise<VoidResult>>(() => {
				order.push('run');
				return Promise.resolve(ok(undefined));
			}),
			undo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(ok(undefined))),
			redo: vi.fn<() => Promise<VoidResult>>(() => Promise.resolve(ok(undefined))),
		};

		await withSaveStateTracking(history, save).run(command);
		expect(order).toEqual(['begin', 'run', 'ok']);
	});
});
