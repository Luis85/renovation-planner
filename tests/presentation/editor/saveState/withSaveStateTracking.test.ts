import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError, ErrorCategory } from '../../../../src/core/errors/AppError';
import {
	markUncompensated,
	type DispatchOutcome,
} from '../../../../src/application/commands/DispatchOutcome';
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

type DispatchResult = Result<DispatchOutcome, AppError>;

const tracker = () => ({
	beginSaving: vi.fn<() => void>(),
	resolveOk: vi.fn<() => void>(),
	resolveErr: vi.fn<() => void>(),
	resolveNeutral: vi.fn<() => void>(),
});

const command = {} as UndoableCommand;

const historyResolving = (result: DispatchResult) => ({
	run: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(result)),
	undo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(result)),
	redo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(result)),
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

	/**
	 * **The one code in that category that is NOT uniformly pre-write, pinned as what is TRUE
	 * rather than left as a claim in a comment.** `requirement.not-found` is pre-write at every
	 * raise site the fourth measurement enumerated — and post-write at the ninth caller it
	 * missed: `requirementResolutionSteps.markStalePersisted` calls `requirements.markStale`
	 * and THEN re-reads through `loadRequirement`, and `repointAndMarkStale` can refuse for any
	 * referent after `applyAll`'s earlier iterations have already saved. So a delete resolution
	 * over three referents that writes two and refuses the third resolves this code, and the
	 * indicator settles `Saved` over a half-written vault whose compensation is only logged if
	 * it fails too.
	 *
	 * Asserted as `false` on purpose, which is this repository's "pins the exposure as what is
	 * TRUE rather than leaving it as a claim in a comment" — the same shape as
	 * `errorPaths.test.ts`'s "is a READ gate" case. Closing the hole turns this case red, which
	 * is the point: the fix has to come with a decision about the false badge it buys on the
	 * PRE-write raise sites of the same code, and about the docblock paragraph that currently
	 * says so.
	 */
	it('does NOT count requirement.not-found, which a delete resolution can raise AFTER writing', () => {
		expect(affectsSaveState({
			category: 'Reference',
			code: 'requirement.not-found',
			message: 'Requirement r-3 not found.',
		})).toBe(false);
	});

	/**
	 * **The case that would fail if `Calculation` left the pre-write set.** The third draft kept
	 * it OUT on the strength of one sentence in `calculationError`'s own docblock — "raised on
	 * the path where the stale marker has already been persisted" — which describes the caller's
	 * state and not a write by the command raising it. All twenty-two raise sites are a
	 * derivation refusing its own inputs before anything was written. The two reachable through
	 * the editor's dispatcher are here: `ReversibleCalibratePlan` refuses before `geometry.write`
	 * (two clicks at the same point), and `AssignAsset` before `requirements.save` (a zone whose
	 * polygon cannot be measured). Transcribed from `Calibration.ts` and `AssignAsset.ts`.
	 */
	it.each([
		'calibration.coincident-points',
		'calibration.invalid-distance',
		'calibration.degenerate-scale',
		'requirement.area-failed',
		'quantity.negative',
		'money.currency-mismatch',
	])('ignores the pre-write Calculation refusal %s', (code) => {
		expect(affectsSaveState({
			category: 'Calculation',
			code,
			message: 'a derivation that refused its own inputs',
		})).toBe(false);
	});

	/**
	 * **The one refusal in a pre-write category that DID write, and the stamp that says so.**
	 * `deleteResolution.ts`'s `applyAll` saves a Requirement per referent, so a refusal on the
	 * third has already written the first two; when compensation then fails to restore them,
	 * `compensate` stamps the refusal it returns. The category is still `Reference` — nothing
	 * a message or a mapping reads has moved, which is what keeps this out of slice 17's
	 * territory — and the predicate answers from the stamp instead of from the category.
	 *
	 * Read against the case above it: a BARE `requirement.not-found` still answers `false`,
	 * because it is genuinely pre-write at its other raise sites. That pair is the whole reason
	 * this is a stamp rather than a carve-out by code — carving the code out would have put a
	 * sticky badge on an override of a Requirement somebody else deleted, which wrote nothing.
	 */
	it.each(['Reference', 'Domain', 'Validation', 'Calculation'] as const)(
		'counts a stamped %s refusal, which left writes standing despite its pre-write category',
		(category) => {
			expect(affectsSaveState(markUncompensated(errorOf(category)))).toBe(true);
		},
	);

	it.each(['Persistence', 'Geometry', 'Migration', 'Import'] as const)(
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

	it.each(WRITE_BOUNDARY_CODES)('counts a %s under Calculation too, failing toward reporting', (suffix) => {
		expect(affectsSaveState(errorOf('Calculation', suffix))).toBe(true);
	});

	it('reads the codes from versioning.ts rather than a copy', () => {
		expect([...WRITE_BOUNDARY_CODES]).toEqual(['revision-conflict', 'external-modification']);
		expect(revisionConflict('zone', 'z1').code).toBe('zone.revision-conflict');
		expect(externalModification('zone', 'z1').code).toBe('zone.external-modification');
	});
});

describe('withSaveStateTracking', () => {
	it.each(OPERATIONS)('reports %s beginning and succeeding', async (operation) => {
		const history = historyResolving(ok('wrote'));
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

	/**
	 * **The case the whole `DispatchOutcome` widening exists for**, and the one a reviewer
	 * found: a SUCCESS that wrote nothing. `AssignAssetCommand` answers `ok({ created: false })`
	 * from a read when the asset is already linked to the zone, and `CommandHistory` answers
	 * `ok` for an undo with an empty stack. Both used to resolve a bare success, which this
	 * tracker read as evidence of a write and settled to `Saved` — clearing a `save-error` a
	 * real persistence failure had raised, over data still unwritten. That is the exact false
	 * assurance `SaveStateStore`'s own header forbids ("only a write that actually succeeded
	 * may clear a save error"), and no amount of reading the `Result` could have told the two
	 * apart, which is why the command reports it.
	 */
	it.each(OPERATIONS)('settles %s NEUTRALLY for a SUCCESS that wrote nothing', async (operation) => {
		const history = historyResolving(ok('no-write'));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		expect(save.resolveNeutral).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
		expect(save.resolveErr).not.toHaveBeenCalled();
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
			run: vi.fn<() => Promise<DispatchResult>>(() => Promise.reject(boom)),
			undo: vi.fn<() => Promise<DispatchResult>>(() => Promise.reject(boom)),
			redo: vi.fn<() => Promise<DispatchResult>>(() => Promise.reject(boom)),
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
			run: vi.fn<() => Promise<DispatchResult>>(() => Promise.reject(new Error('boom'))),
			undo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote'))),
			redo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote'))),
		};
		await expect(withSaveStateTracking(throwing, store).run(command)).rejects.toThrow('boom');
		expect(store.state).toBe('save-error');

		const healthy = historyResolving(ok('wrote'));
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
			run: vi.fn<() => Promise<DispatchResult>>(() => {
				order.push('run');
				return Promise.resolve(ok('wrote'));
			}),
			undo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote'))),
			redo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote'))),
		};

		await withSaveStateTracking(history, save).run(command);
		expect(order).toEqual(['begin', 'run', 'ok']);
	});
});
