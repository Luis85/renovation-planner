import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { DispatchOutcome } from '../../../src/application/commands/DispatchOutcome';
import type { AppError } from '../../../src/core/errors/AppError';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { InspectorEdit } from '../../../src/presentation/editor/inspector/inspector-store';
import type {
	DeleteReferenceDialogResult,
	ReferenceRow,
} from '../../../src/presentation/dialogs/dialog-store';
import type { ReferencingGroup } from '../../../src/application/queries/ListRequirementsReferencing';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import {
	deleteZoneWithReferences,
	rowsFor,
	type DeleteZoneFlowDeps,
} from '../../../src/presentation/editor/deleteZoneFlow';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import { en } from '../../../src/presentation/i18n/locales/en';
import { de } from '../../../src/presentation/i18n/locales/de';

/**
 * The Inspector's delete-with-references flow (design slice 10's closing task, and slice
 * 15's Definition of Done items 6, 8 and 8a).
 *
 * Every assertion here is on what reached the COMMAND, not on whether a dialog opened. A
 * caller that sent `delete-anyway` straight to the command and opened nothing satisfies "a
 * dialog opened" just as well; a caller that dropped `resolvedReferents` still opens a
 * dialog and still dispatches, and the deletion it silently widened is invisible from
 * outside. The input is the only place those two are distinguishable.
 */

const ZONE = 'zone-1' as ZoneId;
const R1 = 'req-1' as RequirementId;
const R2 = 'req-2' as RequirementId;
const R3 = 'req-3' as RequirementId;
const PROJECT = 'project-1' as ProjectId;

/**
 * A read, as the query answers one since design slice 19: GROUPS, not a flat set.
 *
 * A Zone belongs to ONE project, so every case below states its read as the ids in that
 * one group — and an empty read is NO group rather than an empty one, because
 * `ListRequirementsReferencing` builds a group only for a project that has at least one
 * referent. Spelling the equivalence here rather than in each case is what keeps the
 * flow's zero branch asserted on the same thing it was before.
 */
function groupOf(ids: readonly RequirementId[]): readonly ReferencingGroup[] {
	if (ids.length === 0) return [];
	return [{ projectId: PROJECT, projectName: 'Kitchen refit', requirementIds: ids }];
}

interface Rig {
	readonly deps: DeleteZoneFlowDeps;
	readonly dispatched: InspectorEdit[];
	readonly asked: { entityLabel: string; references: readonly ReferenceRow[] }[];
	readonly pickerOpened: { title: string; candidates: readonly { id: string; label: string }[] }[];
}

function referenceError(code: string): AppError {
	return { category: 'Reference', code, message: `refused: ${code}` };
}

/**
 * `reads` is consumed one answer per call, so a test states the sequence the flow should
 * see rather than a mutable variable the assertions then have to reason about.
 * `dispatchResults` works the same way, defaulting to success once exhausted.
 */
function rig(options: {
	reads: readonly (readonly RequirementId[])[];
	answers?: readonly DeleteReferenceDialogResult[];
	// `DispatchOutcome`, not `void`: slice 13 made every dispatch report whether it wrote, so
	// the save-state indicator cannot infer one from a bare `ok`. This option type was still
	// the pre-slice-13 shape.
	dispatchResults?: readonly Result<DispatchOutcome, AppError>[];
	targets?: readonly { id: string; label: string }[];
	picks?: readonly ({ readonly id: string } | 'cancel')[];
}): Rig {
	const dispatched: InspectorEdit[] = [];
	const asked: { entityLabel: string; references: readonly ReferenceRow[] }[] = [];
	const pickerOpened: { title: string; candidates: readonly { id: string; label: string }[] }[] = [];
	const reads = [...options.reads];
	const answers = [...(options.answers ?? [])];
	const results = [...(options.dispatchResults ?? [])];
	const picks = [...(options.picks ?? [])];

	const deps: DeleteZoneFlowDeps = {
		listReferents: () => {
			const next = reads.shift();
			if (next === undefined) throw new Error('the flow read the referents more times than the test scripted');
			return Promise.resolve(ok(groupOf(next)));
		},
		listReassignmentTargets: () => Promise.resolve(ok(options.targets ?? [])),
		askResolution: (entityLabel, references) => {
			asked.push({ entityLabel, references });
			const next = answers.shift();
			if (next === undefined) throw new Error('the flow opened the dialog more times than the test scripted');
			return Promise.resolve(next);
		},
		askReassignTarget: (title, candidates) => {
			pickerOpened.push({ title, candidates: candidates as readonly { id: string; label: string }[] });
			return Promise.resolve(picks.shift() ?? 'cancel');
		},
		dispatch: (edit) => {
			dispatched.push(edit);
			// `'wrote'`, not `undefined`: since slice 13 every dispatch reports a `DispatchOutcome`
			// so the save-state indicator cannot infer a write from a bare `ok`. This double still
			// answered the old `Result<void, …>`.
			return Promise.resolve(results.shift() ?? ok('wrote'));
		},
		copy: {
			reassignTitle: 'Move to which zone?',
		},
	};
	return { deps, dispatched, asked, pickerOpened };
}

describe('the Inspector delete-with-references flow', () => {
	it('shows exactly the referents the query answered, and dispatches the set it showed (DoD 6, 8a)', async () => {
		const r = rig({ reads: [[R1, R2]], answers: [{ action: 'remove-references' }] });

		const outcome = await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');

		expect(outcome).toEqual({ kind: 'deleted' });
		expect(r.asked).toEqual([
			{ entityLabel: 'Bathroom', references: [{ label: 'Kitchen refit', count: 2 }] },
		]);
		// The IDs the row was built from, not a count and not a re-read.
		expect(r.dispatched).toEqual([
			{ kind: 'delete', zoneId: ZONE, resolution: 'remove-references', resolvedReferents: [R1, R2] },
		]);
	});

	it('each of the three non-cancel actions reaches the command as its own resolution', async () => {
		for (const action of ['remove-references', 'delete-anyway'] as const) {
			const r = rig({ reads: [[R1]], answers: [{ action }] });
			await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');
			expect(r.dispatched[0]).toMatchObject({ resolution: action, resolvedReferents: [R1] });
		}

		const reassign = rig({
			reads: [[R1]],
			answers: [{ action: 'reassign' }],
			targets: [{ id: 'zone-2', label: 'Hallway' }],
			picks: [{ id: 'zone-2' }],
		});
		await deleteZoneWithReferences(reassign.deps, ZONE, 'Bathroom');
		expect(reassign.pickerOpened).toEqual([
			{ title: 'Move to which zone?', candidates: [{ id: 'zone-2', label: 'Hallway' }] },
		]);
		expect(reassign.dispatched[0]).toMatchObject({
			resolution: 'reassign',
			reassignTo: 'zone-2',
			resolvedReferents: [R1],
		});
	});

	it('Cancel dispatches nothing at all', async () => {
		const r = rig({ reads: [[R1]], answers: [{ action: 'cancel' }] });

		expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'cancelled' });
		expect(r.dispatched).toEqual([]);
	});

	it('cancelling the reassign PICKER dispatches nothing either', async () => {
		const r = rig({
			reads: [[R1]],
			answers: [{ action: 'reassign' }],
			targets: [{ id: 'zone-2', label: 'Hallway' }],
			picks: ['cancel'],
		});

		expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'cancelled' });
		expect(r.dispatched).toEqual([]);
	});

	it('reports that Reassign is unavailable rather than opening a picker with no options', async () => {
		const r = rig({ reads: [[R1]], answers: [{ action: 'reassign' }], targets: [] });

		const outcome = await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');

		expect(outcome).toMatchObject({ kind: 'failed', error: { code: 'reference.no-reassignment-target' } });
		expect(r.pickerOpened).toEqual([]);
		expect(r.dispatched).toEqual([]);
	});

	/**
	 * The assertion that would have caught the defect the case above could not see, because
	 * asserting the CODE says nothing about what a user reads.
	 *
	 * This refusal used to be built from a `message` the caller passed in — already
	 * translated, resolved by `runtime.ts` from the string table — into the field slice 11
	 * defines as developer English for a log line. `notifyError` never reads `message`, so
	 * the sentence somebody wrote and translated reached nobody and the user got the
	 * Validation category fallback: "This data is not in the expected form." about a project
	 * that simply has one zone.
	 *
	 * Both halves are pinned. That the code RESOLVES (an entry exists, in both locales, and
	 * it is not the category sentence), and that `message` is NOT the user's string — which
	 * is what makes putting one back there a red rather than a silent regression.
	 */
	it("resolves that refusal's user text from the locale table, never from AppError.message", async () => {
		const r = rig({ reads: [[R1]], answers: [{ action: 'reassign' }], targets: [] });

		const outcome = await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');
		const { error } = outcome as { error: AppError };

		expect(toUserMessage('en', error)).toBe(en['reference.no-reassignment-target']);
		expect(toUserMessage('de', error)).toBe(de['reference.no-reassignment-target']);
		expect(toUserMessage('en', error)).not.toBe(en['error.category.validation']);
		expect(error.message).not.toBe(en['reference.no-reassignment-target']);
	});

	describe('the zero branch (DoD 8)', () => {
		it('dispatches the ABSENT-resolution form and opens nothing', async () => {
			const r = rig({ reads: [[]] });

			expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'deleted' });
			// No `resolution` key at all — a `delete-anyway` inferred from a zero count would
			// be consent the user was never asked for.
			expect(r.dispatched).toEqual([{ kind: 'delete', zoneId: ZONE }]);
			expect(r.asked).toEqual([]);
		});

		it('a referents-exist refusal opens the dialog with the RE-READ count', async () => {
			const r = rig({
				reads: [[], [R1, R2, R3]],
				dispatchResults: [err(referenceError('reference.referents-exist'))],
				answers: [{ action: 'remove-references' }],
			});

			expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'deleted' });
			expect(r.asked).toEqual([
				{ entityLabel: 'Bathroom', references: [{ label: 'Kitchen refit', count: 3 }] },
			]);
			expect(r.dispatched[1]).toMatchObject({ resolvedReferents: [R1, R2, R3] });
		});

		it('a re-read of nothing surfaces the refusal instead of opening a dialog with an empty row', async () => {
			const r = rig({
				reads: [[], []],
				dispatchResults: [err(referenceError('reference.referents-exist'))],
			});

			const outcome = await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');

			expect(outcome).toMatchObject({ kind: 'failed', error: { code: 'reference.referents-exist' } });
			expect(r.asked).toEqual([]);
		});

		it('any OTHER refusal of the bare form is reported, not turned into a dialog', async () => {
			const r = rig({ reads: [[]], dispatchResults: [err(referenceError('zone.zone-not-found'))] });

			expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toMatchObject({
				kind: 'failed',
				error: { code: 'zone.zone-not-found' },
			});
			expect(r.asked).toEqual([]);
		});
	});

	describe('a reference set that moved under the dialog (DoD 8a)', () => {
		it('re-asks once against the live set, and the second dispatch carries the NEW ids', async () => {
			const r = rig({
				reads: [[R1, R2], [R2, R3]],
				answers: [{ action: 'remove-references' }, { action: 'remove-references' }],
				dispatchResults: [err(referenceError('reference.set-changed'))],
			});

			expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'deleted' });
			expect(r.asked.map((ask) => ask.references[0]?.count)).toEqual([2, 2]);
			expect(r.dispatched[0]).toMatchObject({ resolvedReferents: [R1, R2] });
			expect(r.dispatched[1]).toMatchObject({ resolvedReferents: [R2, R3] });
		});

		it('a set that churns forever opens the dialog exactly twice and then surfaces the error', async () => {
			const r = rig({
				reads: [[R1], [R2], [R3]],
				answers: [{ action: 'remove-references' }, { action: 'remove-references' }, { action: 'remove-references' }],
				dispatchResults: [
					err(referenceError('reference.set-changed')),
					err(referenceError('reference.set-changed')),
					err(referenceError('reference.set-changed')),
				],
			});

			const outcome = await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom');

			expect(outcome).toMatchObject({ kind: 'failed', error: { code: 'reference.set-changed' } });
			expect(r.asked).toHaveLength(2);
			expect(r.dispatched).toHaveLength(2);
		});

		it('every referent vanishing during the dialog falls back to the bare form', async () => {
			const r = rig({
				reads: [[R1], []],
				answers: [{ action: 'remove-references' }],
				dispatchResults: [err(referenceError('reference.set-changed'))],
			});

			expect(await deleteZoneWithReferences(r.deps, ZONE, 'Bathroom')).toEqual({ kind: 'deleted' });
			expect(r.dispatched[1]).toEqual({ kind: 'delete', zoneId: ZONE });
			expect(r.asked).toHaveLength(1);
		});
	});

	it('a failed re-read after the set changed is reported, not retried blindly', async () => {
		let call = 0;
		const base = rig({ reads: [[R1]], answers: [{ action: 'remove-references' }] });
		const deps: DeleteZoneFlowDeps = {
			...base.deps,
			listReferents: () => {
				call += 1;
				return call === 1
					? Promise.resolve(ok(groupOf([R1])))
					: Promise.resolve(err({ category: 'Persistence', code: 'vault.unreadable', message: 'no' } as AppError));
			},
			dispatch: () => Promise.resolve(err(referenceError('reference.set-changed'))),
		};

		expect(await deleteZoneWithReferences(deps, ZONE, 'Bathroom')).toMatchObject({
			kind: 'failed',
			error: { code: 'vault.unreadable' },
		});
	});

	it('a failed re-read in the ZERO branch is reported', async () => {
		let call = 0;
		const base = rig({ reads: [[]] });
		const deps: DeleteZoneFlowDeps = {
			...base.deps,
			listReferents: () => {
				call += 1;
				return call === 1
					? Promise.resolve(ok(groupOf([])))
					: Promise.resolve(err({ category: 'Persistence', code: 'vault.unreadable', message: 'no' } as AppError));
			},
			dispatch: () => Promise.resolve(err(referenceError('reference.referents-exist'))),
		};

		expect(await deleteZoneWithReferences(deps, ZONE, 'Bathroom')).toMatchObject({
			kind: 'failed',
			error: { code: 'vault.unreadable' },
		});
	});

	describe('a failed read is reported rather than guessed at', () => {
		const failing = (at: number): DeleteZoneFlowDeps => {
			const base = rig({
				reads: [[R1]],
				answers: [{ action: 'reassign' }],
			});
			let calls = 0;
			return {
				...base.deps,
				listReferents: () => {
					calls += 1;
					return calls === at
						? Promise.resolve(err({ category: 'Persistence', code: 'vault.unreadable', message: 'no' } as AppError))
						: base.deps.listReferents(String(ZONE));
				},
				listReassignmentTargets: () =>
					Promise.resolve(err({ category: 'Persistence', code: 'vault.unreadable', message: 'no' } as AppError)),
			};
		};

		it('the first referent read', async () => {
			expect(await deleteZoneWithReferences(failing(1), ZONE, 'Bathroom')).toMatchObject({
				kind: 'failed',
				error: { code: 'vault.unreadable' },
			});
		});

		it('the reassignment-target read', async () => {
			expect(await deleteZoneWithReferences(failing(0), ZONE, 'Bathroom')).toMatchObject({
				kind: 'failed',
				error: { code: 'vault.unreadable' },
			});
		});
	});
});

/**
 * Slice 15's Definition of Done item 6, driven against the MAPPING rather than through the
 * flow — which is what that item asks for and why: every Zone fixture is single-group, so a
 * caller that read `groups[0]` and ignored the rest would pass every case above.
 *
 * One localized key per label, never a translated fragment concatenated with a name
 * ([[Multilanguage]]): word order and the punctuation around an interpolated name are the
 * translator's to choose, which is exactly what a second key buys.
 */
describe('the reference-row mapping (slice 15 item 6)', () => {
	const group = (
		name: string,
		ids: readonly RequirementId[],
		path?: string,
	): ReferencingGroup => ({ projectId: PROJECT, projectName: name, projectPath: path, requirementIds: ids });

	it("renders one row per project, labelled by name, counted by that project's referents", () => {
		expect(
			rowsFor([
				{ projectId: PROJECT, projectName: 'Kitchen refit', requirementIds: [R1, R2] },
				{ projectId: PROJECT, projectName: 'Bathroom', requirementIds: [R3] },
			]),
		).toEqual([
			{ label: 'Kitchen refit', count: 2 },
			{ label: 'Bathroom', count: 1 },
		]);
	});

	it('disambiguates two projects sharing a name by path, and leaves the distinct one plain', () => {
		expect(
			rowsFor([
				group('Kitchen refit', [R1], 'Renovation/Kitchen refit'),
				group('Kitchen refit', [R2], 'Renovation/Kitchen refit 2'),
				group('Bathroom', [R3]),
			]).map((row) => row.label),
		).toEqual([
			'Kitchen refit — Renovation/Kitchen refit',
			'Kitchen refit — Renovation/Kitchen refit 2',
			'Bathroom',
		]);
	});

	/**
	 * The query writes `projectPath` as an EXPLICIT `undefined` where an ambiguous project
	 * cannot be placed — the index holds no note for it — so `'projectPath' in group` answers
	 * true with no value and a mapper keyed on it renders `Kitchen refit — undefined`. The
	 * test asks for the value, because that is the mistake available here.
	 */
	it('falls back to the plain label for an ambiguous project the index cannot place', () => {
		const unplaceable: ReferencingGroup = {
			projectId: PROJECT,
			projectName: 'Kitchen refit',
			projectPath: undefined,
			requirementIds: [R1],
		};

		expect('projectPath' in unplaceable).toBe(true);
		expect(rowsFor([unplaceable])).toEqual([{ label: 'Kitchen refit', count: 1 }]);
	});

	it('answers no rows for no groups', () => {
		expect(rowsFor([])).toEqual([]);
	});
});
