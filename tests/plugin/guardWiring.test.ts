/**
 * @vitest-environment jsdom
 *
 * Design slice 11's Error Boundary, as the COMPOSITION applies it — slice 10's twelve
 * services, and the calibration transaction, which is the one command presentation gets
 * from a factory rather than from `PersistenceServices`.
 *
 * The claim under test is the composition, not the guard: `guardCommand`/`guardQuery` have
 * their own suite (`tests/application/errors/guardAgainstThrowing.test.ts`), and a wrapper
 * that is never applied passes every one of those tests. So this file asks the ROOT — is
 * each slice-10 command and query a WRAPPER when it leaves, and does a fault below it
 * arrive as a resolved failed `Result` with the boundary's own event in the log?
 *
 * What is left here is the BEHAVIOURAL half: a real throw driven through one command and
 * one query, arriving as a resolved refusal with the boundary's own event in the log.
 * "Not an instance of the class" is also true of any other object — only the refusal plus
 * the named log line say that the thing wrapping a service IS the boundary.
 *
 * The IDENTITY half used to live here too, as twelve `not.toBeInstanceOf` lines, and it is
 * gone rather than kept beside its replacement: `tests/plugin/guardCategory.test.ts` walks
 * everything the root hands out and drives a fault through every DOOR it finds, requiring
 * the boundary's mapped refusal back. That is a stronger statement than the twelve — it
 * covers members nobody listed, it asks about doors rather than about objects, and it
 * proves the guarantee rather than an identity. Two mechanisms for one guarantee is how the
 * weaker of them goes on being maintained.
 *
 * What stays here is what the category check cannot say: the boundary's own EVENT NAME.
 * `guards undo under its own event name` below is also the covering test for the one door
 * the category check carves out — an `undo` before any `execute` refuses without throwing,
 * so no fault can be driven through it there.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../helpers/deviceStorage';
import { VAULT_EXCEPTION_MAPPER, guardCalibratePlan } from '../../src/plugin/guardedServices';
import { guardZoneEdit } from '../../src/plugin/guardedZoneEdit';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { ok } from '../../src/core/result/Result';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { installObsidianDom } from '../helpers/dom';
import { lines, recorder, resetRecorder } from '../helpers/logger';

installObsidianDom();

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [], getMarkdownFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

function composed() {
	const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
	const persistence = root.persistence;
	if (persistence === null) throw new Error('expected a composed persistence stack');
	return persistence;
}

/**
 * Shadow every port method on a composed repository with a thrower. Own properties, so the
 * prototype's methods are hidden without touching the class — and the commands hold THIS
 * instance, which is the whole point: the fault has to originate below the boundary.
 */
function detonate(repository: object): void {
	const methods = ['getById', 'save', 'delete', 'listAll', 'listByProject', 'listByPlan', 'listByZone', 'listByAsset', 'markStale'];
	for (const method of methods) {
		Object.defineProperty(repository, method, {
			configurable: true,
			value: () => {
				throw new Error('the vault exploded');
			},
		});
	}
}

describe('slice 10 leaves the composition root guarded', () => {
	/**
	 * The override commands have TWO public doors, and the one the app actually uses is the
	 * second: the Inspector's reversible adapters dispatch through `executeWithVersion`.
	 * Guarding `execute` alone would have wrapped the door nobody reaches, so the composed
	 * service carries both, each wrapped and each with its own event.
	 */
	it('guards BOTH doors of each override command', async () => {
		resetRecorder();
		const persistence = composed();
		detonate(persistence.requirements);

		const quantity = await persistence.setRequirementQuantityOverride.executeWithVersion({
			requirementId: 'req-1' as never,
			quantity: 3,
		});
		const cost = await persistence.setRequirementCostOverride.executeWithVersion({
			requirementId: 'req-1' as never,
			cost: null,
		});

		expect(quantity.ok).toBe(false);
		expect(cost.ok).toBe(false);
		expect(lines.map((line) => line.event)).toEqual([
			'command.setRequirementQuantityOverride.with-version.failed',
			'command.setRequirementCostOverride.with-version.failed',
		]);
	});

	it('turns a thrown fault inside a slice-10 command into a resolved refusal, logged at the boundary', async () => {
		resetRecorder();
		const persistence = composed();
		detonate(persistence.requirements);

		const result = await persistence.recalculateRequirement.execute({ requirementId: 'req-1' as never });

		expect(result.ok).toBe(false);
		// Mapped by the vault exception mapper, so the caller gets a coded error rather than
		// the raw `Error` — and the log line names THIS service's boundary, not a shared one.
		expect(result.ok === false && result.error.category).toBe('Persistence');
		const logged = lines.filter((line) => line.event === 'command.recalculateRequirement.failed');
		expect(logged).toHaveLength(1);
		expect(logged[0].context?.cause).toBeInstanceOf(Error);
	});

	it('turns a thrown fault inside a slice-10 query into a resolved refusal, logged at the boundary', async () => {
		resetRecorder();
		const persistence = composed();
		detonate(persistence.assets);

		const result = await persistence.requirementQueries.listAssets.execute();

		expect(result.ok).toBe(false);
		const logged = lines.filter((line) => line.event === 'query.listAssets.failed');
		expect(logged).toHaveLength(1);
	});
});

/**
 * `calibratePlan` is the one command presentation is handed as a FACTORY — each gesture
 * needs its own inverse state — so it never passes through `PersistenceServices` and
 * `composeGuarded` cannot reach it. It was therefore the last raw command in the app, and
 * `CalibrateToolDeps`' own docblock records that the dispatch path has no `.catch`: a throw
 * inside it was an unhandled rejection, not a refusal. `planEditorDeps` wraps it per call.
 *
 * Both halves are driven, because a calibration is undone long after it was executed and
 * the two carry different event names for exactly that reason.
 */
describe('the calibration transaction leaves the composition root guarded', () => {
	function editorCommands() {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const deps = planEditorDeps(root, {} as never, {} as never, createEditorClipboard(), memoryDeviceStorage());
		return { persistence, deps };
	}

	it('turns a thrown fault inside execute into a resolved refusal, logged at the boundary', async () => {
		resetRecorder();
		const { persistence, deps } = editorCommands();
		detonate(persistence.plans);

		const result = await deps.commands.calibratePlan().execute({
			planId: 'plan-1' as never,
			pointA: { x: 0, y: 0 },
			pointB: { x: 10, y: 0 },
			knownDistance: 1000,
		});

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.code).toBe('vault.unexpected-failure');
		expect(lines.filter((line) => line.event === 'command.calibratePlan.failed')).toHaveLength(1);
	});

	/**
	 * Driven at the WRAPPER rather than through a real gesture: an `undo` before any
	 * `execute` refuses with a coded Result and never throws, so the only way to reach the
	 * undo half's catch is to hand the guard a transaction whose `undo` throws. This is the
	 * assertion that says `command.calibratePlan.undo.failed` names something real.
	 */
	it('guards undo under its own event name', async () => {
		resetRecorder();
		const guarded = guardCalibratePlan(
			{
				execute: () => Promise.reject(new Error('never reached')),
				undo: () => {
					throw new Error('the sidecar exploded');
				},
			},
			recorder,
			VAULT_EXCEPTION_MAPPER,
		);

		const result = await guarded.undo();

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.code).toBe('vault.unexpected-failure');
		expect(lines.map((line) => line.event)).toEqual(['command.calibratePlan.undo.failed']);
	});
});

/**
 * The Inspector's two per-EDIT zone writes, guarded the same way and for the same reason.
 *
 * `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` were built in
 * `presentation/editor/inspector-wiring.ts` straight against the raw `ZoneRepository` port
 * until BP-02 slice 4 — ADR-0034's Coverage paragraph names both by file and line as outside
 * the `guardCommand` chokepoint, which is tracker limitation L-05. Like `calibratePlan` they
 * hold one edit's inverse, so they cross as FACTORIES and are guarded per call.
 *
 * BOTH doors of each, because `undo()` is the door ADR-0034's own Consequences correction
 * records as the one every other reversible adapter still leaves open, and because an
 * `execute` guarded beside a raw `undo` is a wrapper by every structural test anyone can
 * write — the shape `guardCategory.test.ts`'s header exists to refuse.
 *
 * The door list is TWO per adapter, measured rather than assumed — and it takes THREE
 * measurements, because the single grep an earlier version of this header quoted could not see
 * the whole of what the sentence beneath it claimed. All run 2026-09-17 over
 * `src/application/commands/zone/EditZoneDetails.ts` and
 * `src/application/commands/zone/reversible-rename-zone-command.ts`:
 *
 * 1. Members indented exactly one level, with a literal tab in the pattern (`grep -E` does not
 *    read `\t` as one, which is why an earlier spelling printed nothing and would have been a
 *    false "no second door"): `grep -nE "^<TAB>[a-z]" <both files>` printed 14 lines — nine for
 *    `EditZoneDetails.ts` (four `EditZoneDetailsInput` fields, `private generation`, the
 *    constructor, `execute`, `undo`, `private async dispatch`) and five for the rename adapter
 *    (the same, minus the input fields). In what it prints, exactly `execute()` and `undo()`
 *    are public.
 * 2. Neither class has a base, so there is no inherited member for (1) to have missed:
 *    `grep -nE "^export class .*\bextends\b" <both files>` printed nothing (exit 1).
 * 3. Neither declares an accessor, which (1) would have printed looking like a method:
 *    `grep -nE "\b(get|set)[[:space:]]+[a-zA-Z_]" <both files>` printed nothing (exit 1).
 *
 * What none of the three can see is a member indented other than one tab. Neither file has one
 * — read whole — but that is a reading rather than a check, and this header says so rather than
 * letting the greps be quoted for more than they cover.
 */
describe("the Inspector's zone edits leave the composition root guarded", () => {
	const ZONE_ID = 'zone-1' as never;
	const EXPECTED = { revision: 1, observed: 'observed-1' as never };
	const DETAILS_INPUT = {
		zoneId: ZONE_ID,
		forward: { name: 'Kitchen', zoneType: 'Room' as const },
		inverse: { name: 'Küche', zoneType: 'Room' as const },
		expected: EXPECTED,
	};
	const RENAME_INPUT = { zoneId: ZONE_ID, name: 'Kitchen', inverse: 'Küche', expected: EXPECTED };

	function editorCommands() {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const deps = planEditorDeps(root, {} as never, {} as never, createEditorClipboard(), memoryDeviceStorage());
		return { persistence, deps };
	}

	it.each([
		['editZoneDetails', 'execute', 'command.editZoneDetails.failed'],
		['editZoneDetails', 'undo', 'command.editZoneDetails.undo.failed'],
		['renameZone', 'execute', 'command.renameZone.failed'],
		['renameZone', 'undo', 'command.renameZone.undo.failed'],
	] as const)('turns a thrown fault at %s#%s into a resolved refusal under its own event name', async (factory, door, event) => {
		resetRecorder();
		const { persistence, deps } = editorCommands();
		detonate(persistence.zones);

		const transaction = factory === 'editZoneDetails'
			? deps.commands.editZoneDetails(new SessionWriteLedger(), DETAILS_INPUT)
			: deps.commands.renameZone(new SessionWriteLedger(), RENAME_INPUT);
		const result = await (door === 'execute' ? transaction.execute() : transaction.undo());

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.code).toBe('vault.unexpected-failure');
		expect(lines.map((line) => line.event)).toEqual([event]);
	});

	/**
	 * The regression that matters most, since the cheapest way to pass every case above is to
	 * refuse unconditionally: with no incident open the wrapper CALLS the transaction and hands
	 * its answer back untouched, at both doors.
	 */
	it('passes a clean write straight through at both doors', async () => {
		resetRecorder();
		const called: string[] = [];
		const guarded = guardZoneEdit(
			{
				execute: () => { called.push('execute'); return Promise.resolve(ok('wrote' as const)); },
				undo: () => { called.push('undo'); return Promise.resolve(ok('no-write' as const)); },
			},
			{ execute: 'test.execute.failed', undo: 'test.undo.failed' },
			recorder,
		);

		expect(await guarded.execute()).toEqual(ok('wrote'));
		expect(await guarded.undo()).toEqual(ok('no-write'));
		expect(called).toEqual(['execute', 'undo']);
		expect(lines).toEqual([]);
	});
});
