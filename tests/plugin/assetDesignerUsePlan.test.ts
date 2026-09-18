/**
 * @vitest-environment jsdom
 *
 * AD13's forward door, composed: `assetDesignerUsePlan`, the seam `AssetDesignerDeps.usePlan`
 * is bound to.
 *
 * jsdom rather than node because the no-plans arm raises a real `Notice`, which the mock builds
 * out of DOM elements through `installObsidianDom`.
 *
 * What is driven here is the DESTINATION rule and the activation it shares, never a second
 * placement mechanism: a plan already open is continued into, anything else asks, a dismissal
 * reaches nothing, and every accepted pick goes through the one `revealPlanEditor` door the
 * palette command and the project surface also take. `designerUsePlan.test.ts` drives the
 * control that calls this.
 */
import { beforeEach, describe, expect, it } from 'vitest';
// Mock-only surface, imported BY NAME — `opened`/`choose`/`shown` are the fake's own members
// and the real `obsidian` module declares none of them, the same reason
// `assetDesignerCommands.test.ts` imports it this way. The vitest alias points the bare
// specifier at this very file, so these are the classes the code under test constructs.
import { FuzzySuggestModal, Notice } from '../helpers/obsidian-mock';
import { assetDesignerUsePlan } from '../../src/plugin/renovationProjectOpenSeams';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import { t } from '../../src/presentation/i18n/strings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { recorder } from '../helpers/logger';
import { FakeWorkspace } from '../helpers/workspace';
import { createEntityId } from '../../src/core/identity/generateId';
import type { ProjectIndex, ProjectIndexEntry } from '../../src/application/ports/ProjectIndex';
import type { ContinueContext } from '../../src/application/continueContext';

installObsidianDom();

const GROUND = createEntityId('plan');
const FIRST = createEntityId('plan');
const PROJECT = createEntityId('project');
/** The asset every press below carries — see `wired`. */
const ASSET = createEntityId('asset');

/**
 * An index holding two plans and a project, so the picker's own type filter is asked to reject
 * something: an unfiltered `entries()` would satisfy every assertion below about a plan row.
 *
 * `GROUND` carries a `projectId` and `FIRST` deliberately does not. `ProjectIndexEntry.projectId`
 * is optional, and the Continue arm below is guarded on it — so an index where every plan had one
 * would leave that guard's other branch undriven and the seam free to drop the check.
 */
function index(): ProjectIndex {
	const built = new InMemoryProjectIndex();
	built.upsert({ id: PROJECT, type: 'renovation-project', path: 'Renovation/Flat.md' });
	built.upsert({ id: GROUND, type: 'renovation-plan', path: 'Renovation/Plans/Ground floor.md', projectId: PROJECT });
	built.upsert({ id: FIRST, type: 'renovation-plan', path: 'Renovation/Plans/First floor.md' });
	return built;
}

function wired(options: { readonly index?: ProjectIndex | undefined; readonly workspace?: unknown } = {}) {
	// Cast for the same reason `planEditorCommands.test.ts` casts its own override: a workspace
	// planted to FAULT models only the two members the reveal path reaches, and the cases that
	// use the real fake still want its recorders.
	const workspace = (options.workspace ?? new FakeWorkspace()) as FakeWorkspace;
	const remembered: ContinueContext[] = [];
	// ANNOTATED at the signature ICR 1-H gives this seam, not at the one it has. `() => void` is
	// assignable to `(assetId: string) => void`, so this line compiles on both sides of that
	// change and the extra argument is simply dropped by today's build — which is exactly the
	// silence the pending case below exists to break. Every case presses through the wrapper, so
	// the widening needs no edit to any of them.
	const send: (assetId: string) => void = assetDesignerUsePlan(
		{ workspace } as never,
		'index' in options ? options.index : index(),
		recorder,
		(context) => remembered.push(context),
	);
	return { workspace, usePlan: () => { send(ASSET); }, remembered };
}

/** The picker this call opened, typed to the two members these cases drive. */
function pickerAt(position: number): FuzzySuggestModal<ProjectIndexEntry> {
	const picker = FuzzySuggestModal.opened[position];
	if (picker === undefined) throw new Error(`no picker was opened at position ${String(position)}`);
	return picker as FuzzySuggestModal<ProjectIndexEntry>;
}

/**
 * The seam dispatches through a promise chain it deliberately does not return — every door here
 * is detached — so a macrotask hop rather than a counted number of `await`s, for
 * `assetDesignerCommands.test.ts`'s own reason: the chain's length is an implementation detail.
 */
function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

beforeEach(() => {
	Notice.shown.length = 0;
	FuzzySuggestModal.opened.length = 0;
	// A notice is INERT until something activates the queue — per test, since dedup would fold
	// two identical sentences from separate cases into one `(×2)`.
	activateNotices();
});

describe('use in plan', () => {
	/**
	 * The rule's first arm, and the one AD13's second acceptance criterion rests on: with one plan
	 * open there is nothing to ask, so the user is taken straight back to it. **Revealed, never
	 * re-stated** — `revealCandidate` calls `setViewState` only on a leaf it CREATED, so the
	 * editor's camera and selection survive.
	 *
	 * **`toBe`, not `toEqual`, and the first version of this case got that wrong in a way worth
	 * recording.** It asserted `open.state?.state` deep-equal to `{ planId: GROUND }` and claimed
	 * that proved no re-state. It proves nothing: a re-state writes
	 * `{ type, active: true, state: { planId: GROUND } }`, whose `.state` is deep-equal to the
	 * planted one, so the assertion passes either way. The identity of the whole `state` OBJECT is
	 * what a re-state cannot survive, which is the form
	 * `tests/infrastructure/obsidian/workspace/revealPlanEditor.test.ts`'s
	 * `does not re-set the view state of a leaf it found` already uses — that case is where this
	 * property is pinned at the layer that owns it, and this one now pins it through the seam too.
	 */
	it('continues into the one Plan Editor already open, asking nothing', async () => {
		const { workspace, usePlan } = wired();
		const open = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });
		const before = open.state;

		usePlan();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(workspace.revealed).toEqual([open]);
		expect(open.state).toBe(before);
		// No leaf was created: `getLeaf` pushes onto `leaves`, and the planted one is all there is.
		expect(workspace.leaves).toEqual([open]);
	});

	/** Two leaves on ONE plan is still one plan — a split pane, or a restored layout. */
	it('treats two leaves showing the same plan as that one plan', async () => {
		const { workspace, usePlan } = wired();
		const first = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });
		workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });

		usePlan();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		// The first candidate, which is `revealCandidate`'s own `candidates()[0]`.
		expect(workspace.revealed).toEqual([first]);
	});

	/** Two DIFFERENT plans open is genuinely ambiguous, so it asks rather than guessing. */
	it('asks which plan when two different ones are open', async () => {
		const { workspace, usePlan } = wired();
		workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });
		workspace.withOpen(PLAN_EDITOR_VIEW, { planId: FIRST });

		usePlan();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(1);
		expect(workspace.revealed).toHaveLength(0);
	});

	/**
	 * A leaf whose state carries no `planId` is not a candidate — the shape a Plan Editor leaf
	 * restored before its own state arrives really has, which `planIdOf` answers `undefined` for.
	 * Without it, one such leaf would read as "one plan open" and reveal a plan called
	 * `undefined`.
	 */
	it('does not count a Plan Editor leaf that names no plan', async () => {
		const { workspace, usePlan } = wired();
		workspace.withOpen(PLAN_EDITOR_VIEW, {});

		usePlan();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(1);
	});

	it('asks which plan when none is open, and opens the one picked', async () => {
		const { workspace, usePlan } = wired();

		usePlan();
		const picker = pickerAt(0);
		// Opening the picker must open no leaf: choosing is what acts.
		expect(workspace.leaves).toHaveLength(0);
		expect(picker.getItems().map((item) => item.id)).toEqual([GROUND, FIRST]);
		const first = picker.getItems().find((item) => item.id === FIRST);
		if (first === undefined) throw new Error('the picker offered no first-floor plan');
		picker.choose(first);
		await flush();

		const [created] = workspace.leaves;
		expect(created?.state).toEqual({ type: PLAN_EDITOR_VIEW, active: true, state: { planId: FIRST } });
		expect(workspace.revealed).toEqual([created]);
	});

	/**
	 * CLAUDE.md's two-activations-in-one-tick shape, one layer above the leaf: everything from the
	 * press to `.open()` is synchronous, so without the guard a double click stacked two modals
	 * and the user was left picking in one while a second waited behind it. Driven by calling the
	 * seam twice with no `await` between, which is what a double click IS.
	 *
	 * No leaf assertion belongs here — `revealCandidate`'s own in-flight map answers for
	 * duplicate leaves and this seam creates none until something is chosen.
	 */
	it('opens one picker for two presses in the same tick', () => {
		const { usePlan } = wired();

		usePlan();
		usePlan();

		expect(FuzzySuggestModal.opened).toHaveLength(1);
	});

	/**
	 * The guard's OFF position, which is the half a flag set and never cleared would lose — and it
	 * would lose it silently, leaving a button that works exactly once per session. Asserted
	 * through a DISMISSAL rather than a choice, because dismissal is the path with no callback of
	 * its own: `Modal.close()` runs `onClose`, and that is the whole release mechanism.
	 */
	it('asks again after a picker is dismissed', () => {
		const { usePlan } = wired();

		usePlan();
		pickerAt(0).close();
		usePlan();

		expect(FuzzySuggestModal.opened).toHaveLength(2);
	});

	/**
	 * A plan reached through "Use in plan" enters `ProjectList`'s `Continue` group, exactly as one
	 * reached through the palette picker does (`openPlanPicker` records the same context on the
	 * same `'opened'` condition). Without this the gesture opened a plan the Continue group had
	 * never heard of.
	 */
	it('records the Continue context for the plan it picked', async () => {
		const { usePlan, remembered } = wired();

		usePlan();
		const ground = pickerAt(0).getItems().find((item) => item.id === GROUND);
		if (ground === undefined) throw new Error('the picker offered no ground-floor plan');
		pickerAt(0).choose(ground);
		await flush();

		expect(remembered).toEqual([{ projectId: PROJECT, planId: GROUND }]);
	});

	/**
	 * The third arm of the same condition: `'opened'`. A reveal that FAILED opened no editor, so
	 * there is nowhere for the user to continue and recording one would name a place they are not.
	 *
	 * The fault shape is not `planEditorCommands.test.ts`'s — a candidate leaf whose
	 * `getViewState` throws — because this seam ENUMERATES the plan-editor leaves itself before
	 * the picker, so such a leaf would throw in the seam rather than inside `revealCandidate`. An
	 * empty candidate list with a throwing `getLeaf` reaches the same outer boundary through the
	 * creation path instead.
	 */
	it('records nothing when the reveal fails', async () => {
		const exploding = {
			getLeavesOfType: () => [],
			getLeaf: (): never => {
				throw new Error('leaf exploded');
			},
		};
		const { usePlan, remembered } = wired({ workspace: exploding });

		usePlan();
		const ground = pickerAt(0).getItems().find((item) => item.id === GROUND);
		if (ground === undefined) throw new Error('the picker offered no ground-floor plan');
		pickerAt(0).choose(ground);
		await flush();

		expect(remembered).toEqual([]);
	});

	/**
	 * `ProjectIndexEntry.projectId` is OPTIONAL, and a `ContinueContext` without a project is not
	 * a context — `ProjectList` resolves the row by project first. So the absent case records
	 * nothing rather than recording a hole, which is `openPlanPicker`'s own condition. `FIRST` is
	 * the fixture's plan with no project for this reason.
	 */
	it('records nothing for a picked plan whose entry names no project', async () => {
		const { workspace, usePlan, remembered } = wired();

		usePlan();
		const first = pickerAt(0).getItems().find((item) => item.id === FIRST);
		if (first === undefined) throw new Error('the picker offered no first-floor plan');
		pickerAt(0).choose(first);
		await flush();

		expect(remembered).toEqual([]);
		// The plan still OPENED: the missing project id costs the Continue record and nothing else.
		expect(workspace.revealed).toHaveLength(1);
	});

	/**
	 * Criteria 4's cancel arm. Not a guard in the seam but a property of the mechanism —
	 * `onChooseItem` is the only path out of the modal that calls anything — which is exactly why
	 * it is asserted on the WORKSPACE rather than on a flag: no leaf created, none revealed, so
	 * there is no plan for a placement to be written into and nothing to leave an orphan behind.
	 */
	it('creates and reveals nothing when the pick is dismissed', async () => {
		const { workspace, usePlan } = wired();

		usePlan();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(1);
		expect(workspace.leaves).toHaveLength(0);
		expect(workspace.revealed).toHaveLength(0);
	});

	it('says so rather than opening an empty picker, in a vault with no plans', async () => {
		const { workspace, usePlan } = wired({ index: new InMemoryProjectIndex() });

		usePlan();
		await flush();

		expect(Notice.shown).toEqual([t('en', 'plan.none')]);
		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * The unrecovered-settings session composes no index at all, which `entriesOfType` answers
	 * for exactly as it answers for an empty vault. Driven because `undefined` is a separate
	 * branch from an index that holds nothing, and a seam that reached for `.entries()` on it
	 * would throw inside a click handler with no awaiter.
	 */
	it('says the same thing when no index is composed at all', async () => {
		const { workspace, usePlan } = wired({ index: undefined });

		usePlan();
		await flush();

		expect(Notice.shown).toEqual([t('en', 'plan.none')]);
		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * **ICR 1-H's assertion, and it is RED on purpose at this commit.** The three files that would
	 * make it pass are outside this card's lease and are named in
	 * `docs/tasks/asset-designer-expansion/reports/AD13-asset-handoff.md`; this is the instrument
	 * that fails until they land and turns green when they do, which the ledger asks for in place of
	 * a change request nothing can check.
	 *
	 * **What is asserted is the ORIGIN on the leaf, on both arms, because that is the whole of the
	 * hand-off.** `renovationProjectOpenPlan` takes an `origin?: ProjectOrigin`, `revealPlanEditor`
	 * turns one into a `prepareEditorArrival(origin)` and that queue writes
	 * `{ ...state, active: true, state: { ...state.state, planId, origin } }` onto whichever leaf was
	 * revealed. Today `assetDesignerUsePlan` passes no origin on either arm, so no arrival is
	 * prepared, nothing is written, and `state.origin` is `undefined` — which is the red.
	 *
	 * Read on the LEAF rather than on a spy, for `planEditorHostReturn.test.ts`'s reason: the arrival
	 * queue is a different mechanism from `revealCandidate`'s own `setViewState`, and asserting the
	 * wrong one of the two is recorded as F3 of AD13's navigation half.
	 */
	it('carries the asset into the Plan Editor it continues into', async () => {
		const { workspace, usePlan } = wired();
		const open = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });

		usePlan();
		await flush();

		expect(workspace.revealed).toEqual([open]);
		expect(open.state?.state?.['origin']).toEqual({ planId: GROUND, assetId: ASSET });
	});

	/** The picker arm of the same claim: the asset has to survive the question, not only the reveal. */
	it('carries the asset into the plan it picked', async () => {
		const { workspace, usePlan } = wired();

		usePlan();
		const first = pickerAt(0).getItems().find((item) => item.id === FIRST);
		if (first === undefined) throw new Error('the picker offered no first-floor plan');
		pickerAt(0).choose(first);
		await flush();

		const [created] = workspace.leaves;
		expect(created?.state?.state?.['origin']).toEqual({ planId: FIRST, assetId: ASSET });
	});
});
