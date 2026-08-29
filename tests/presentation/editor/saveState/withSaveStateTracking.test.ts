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

	/**
	 * **The case that would fail if `Domain` left the pre-write set**, and the reason it is here:
	 * this predicate's first draft counted a `Domain` failure, on a docblock claiming a field
	 * commit that fails a domain rule resolves a `ValidationError`. It does not.
	 * `SetRequirementQuantityOverride` refuses a negative quantity as `Domain` and re-wraps the
	 * entity's own `Validation` errors as `Domain` too, all of it BEFORE `requirements.save` —
	 * and the Inspector's override fields are `type="text"`, so `-5` is one keystroke away.
	 * Spelled out rather than built through `errorOf`, which prefixes `zone.`: the code here is
	 * transcribed from that raise site. Nothing checks the two still agree — the predicate's own
	 * header says so rather than implying a mechanism.
	 */
	it('ignores a pre-write Domain refusal, the one a user can type into an override field', () => {
		expect(affectsSaveState({
			category: 'Domain',
			code: 'requirement.negative-quantity',
			message: 'A requirement quantity cannot be negative; got -5.',
		})).toBe(false);
	});

	it('ignores the Domain refusal both reversible adapters raise with nothing to undo', () => {
		expect(affectsSaveState({
			category: 'Domain',
			code: 'undo.before-execute',
			message: 'Nothing to undo yet.',
		})).toBe(false);
	});

	/**
	 * **The case that would fail if `Reference` left the pre-write set**, and the reason it is
	 * here: this predicate's second draft counted every `Reference` failure, because the grep
	 * that justified adding `Domain` only ever looked for `'Domain'`. All nineteen `Reference`
	 * raise sites are referent lookups that came back empty, and `reference.set-changed` is the
	 * sharpest of them — its own developer message reads "nothing was written", and it settled a
	 * sticky "Save error" badge anyway, one confirm click from the Inspector's Delete button.
	 * Spelled out rather than built through `errorOf`, which prefixes `zone.`: these codes are
	 * transcribed from `deleteResolution.ts` and `reversible-assign-asset-command.ts`. Nothing
	 * checks that they still agree — the predicate's own header says so rather than implying a
	 * mechanism.
	 */
	it.each([
		'reference.set-changed',
		'reference.entity-gone',
		'reference.referents-exist',
		'reference.reassign-target-gone',
		'requirement.zone-not-found',
		'requirement.asset-not-found',
	])('ignores the pre-write Reference refusal %s', (code) => {
		expect(affectsSaveState({
			category: 'Reference',
			code,
			message: 'a referent lookup that came back empty',
		})).toBe(false);
	});

	it.each(['Persistence', 'Geometry', 'Migration', 'Calculation', 'Import'] as const)(
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

	// The carve-out is applied to the whole pre-write set, not to `Validation` alone. Nothing
	// raises these two codes under `Domain` or `Reference` today — this pins the direction a
	// future site that did would fail in, which is toward reporting rather than away from it.
	it.each(WRITE_BOUNDARY_CODES)('counts a %s under Domain too, failing toward reporting', (suffix) => {
		expect(affectsSaveState(errorOf('Domain', suffix))).toBe(true);
	});

	it.each(WRITE_BOUNDARY_CODES)('counts a %s under Reference too, failing toward reporting', (suffix) => {
		expect(affectsSaveState(errorOf('Reference', suffix))).toBe(true);
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

	it.each(OPERATIONS)('settles %s NEUTRALLY for a domain refusal that wrote nothing', async (operation) => {
		const history = historyResolving(err(errorOf('Domain', 'negative-quantity')));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		// The user-reachable one: an override field refused for a negative quantity. Before
		// `Domain` joined the pre-write set this settled `resolveErr` and raised a persistent
		// "Save error" badge about data nothing had touched.
		expect(save.resolveNeutral).toHaveBeenCalledTimes(1);
		expect(save.resolveErr).not.toHaveBeenCalled();
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
