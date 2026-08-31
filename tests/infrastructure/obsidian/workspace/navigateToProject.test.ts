/**
 * Decision 6's two steps, and each case here FAILS against the design the spec shipped with —
 * which is why they exist. `revealView(deps, type, { projectId })` does not compile
 * (`revealView` takes no state); `revealCandidate` sets state only on a leaf it CREATED, so
 * the normal case (an already-open pane) would have been left where it was; and `requestKey`
 * is the type plus the serialized state, which for a SINGLETON is the wrong key — two
 * invocations naming different projects produce two keys, neither joins the other, and both
 * create a leaf.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWorkspace } from '../../../helpers/workspace';
import type { FakeLeaf } from '../../../helpers/workspace';
import type { navigateToProject as NavigateToProject } from '../../../../src/infrastructure/obsidian/workspace/navigateToProject';

const TYPE = 'renovation-project';

/**
 * `chains` (and its `PALETTE_LANE` entry) are module state in `navigateToProject.ts` — a
 * `WeakMap` of per-target tickets and write chains since the split-pane supersession fix, but
 * still module-scoped state for the same reason `activating` next door is, and the module's
 * own comment says so — so a case left holding a previous case's ticket or a rejected write
 * chain would make the next case's result a fact about test ORDER rather than about that
 * case's own scenario — measured while writing this file: a case that poisons the chain on
 * purpose (see below) turned the very next `it` here red too, for a reason that had nothing to
 * do with its own body. `vi.resetModules()` plus a fresh dynamic import re-runs the module's
 * top-level `const` initializers for every case, which is the same idiom `harness.test.ts`
 * uses for the same reason.
 */
let navigateToProject: typeof NavigateToProject;

type NavigateArgs = Parameters<typeof NavigateToProject>;

/**
 * The fake's shape is the real one's; the cast is the module boundary the mock stands in for.
 * ONE cast, in one place, named for what it is — the idiom `revealView.test.ts` next door
 * already uses for the same `FakeWorkspace` against the same `RevealDeps`, rather than an
 * `as never` at each of this file's fifteen call sites.
 *
 * It builds the whole `RevealDeps` rather than just the workspace, for that file's own
 * reason: `reportFault` is REQUIRED, so a case that left it out would pass until something
 * faulted and then die with `deps.reportFault is not a function`. Every case here passes its
 * own spy, because most of them assert on the count.
 */
const depsFor = (workspace: FakeWorkspace, reportFault: (cause: unknown) => void): NavigateArgs[0] =>
	({ workspace, reportFault }) as unknown as NavigateArgs[0];

/** Same boundary, the other parameter: `targetLeaf` is a real `WorkspaceLeaf` in production. */
const targetOf = (leaf: FakeLeaf): NavigateArgs[3] => leaf as unknown as NavigateArgs[3];

beforeEach(async () => {
	vi.resetModules();
	({ navigateToProject } = await import(
		'../../../../src/infrastructure/obsidian/workspace/navigateToProject'
	));
});

/** Every state actually written through the leaf's `setViewState`, in order. */
function recordSetViewState(leaf: FakeLeaf): { projectId: unknown }[] {
	const written: { projectId: unknown }[] = [];
	const original = leaf.setViewState.bind(leaf);
	leaf.setViewState = (state) => {
		written.push(state.state as { projectId: unknown });
		return original(state);
	};
	return written;
}

/**
 * Lets a test hold the FIRST `setViewState` call open until it chooses to release it, so a
 * second navigation can be made to arrive mid-write rather than before or after it.
 */
function slowSetViewState(leaf: FakeLeaf): {
	firstWriteStarted: Promise<void>;
	releaseFirst: () => void;
} {
	const original = leaf.setViewState.bind(leaf);
	let started: (() => void) | undefined;
	const firstWriteStarted = new Promise<void>((resolve) => {
		started = resolve;
	});
	let release: (() => void) | undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let first = true;
	leaf.setViewState = (state) => {
		if (first) {
			first = false;
			started?.();
			return held.then(() => original(state));
		}
		return original(state);
	};
	return {
		firstWriteStarted,
		releaseFirst: () => release?.(),
	};
}

describe('navigateToProject', () => {
	it('navigates a leaf that is already open', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);

		await navigateToProject(depsFor(workspace, vi.fn<(cause: unknown) => void>()), TYPE, 'project-1');

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-1' });
	});

	/**
	 * `projectId` is `string | null` — the empty-state selection, before any project is
	 * chosen — and the write step falls back to `''` rather than writing `null` into the
	 * leaf's view state, which is what `?? ''` is for.
	 */
	it('writes an empty projectId when navigating to no project', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);

		await navigateToProject(depsFor(workspace, vi.fn<(cause: unknown) => void>()), TYPE, null);

		expect(leaf.getViewState().state).toEqual({ projectId: '' });
	});

	/**
	 * Driven with two DIFFERENT projects on purpose: the same project passes against a key
	 * that coalesces on the request, and the singleton breaks only where they differ.
	 */
	it('leaves exactly one leaf for two invocations in one tick naming different projects', async () => {
		const workspace = new FakeWorkspace();
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());

		await Promise.all([
			navigateToProject(deps, TYPE, 'project-1'),
			navigateToProject(deps, TYPE, 'project-2'),
		]);

		expect(workspace.getLeavesOfType(TYPE)).toHaveLength(1);
	});

	/**
	 * The superseded request writes NOTHING — which is the ticket's own job, and the half the
	 * write chain does not do. A chain alone would remount to the first project and then to
	 * the second, which is the flicker the ticket exists to avoid, and asserting only the
	 * final state cannot tell the two apart.
	 *
	 * An earlier draft of this plan had a `deferredSetViewState` case here instead, awaiting
	 * both navigations and only then releasing the held write — which cannot finish, because
	 * neither navigation resolves until that write does. It would have timed out rather than
	 * checked an ordering, and with the write chain in place the scenario it described is
	 * unreachable anyway. Reported by a review bot; the helper is deleted with the case.
	 */
	it('performs no write at all for a request superseded in the same tick', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const written = recordSetViewState(leaf);
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());

		await Promise.all([
			navigateToProject(deps, TYPE, 'project-1'),
			navigateToProject(deps, TYPE, 'project-2'),
		]);

		expect(written.map((state) => state.projectId)).toEqual(['project-2']);
	});

	/**
	 * **The window the ticket alone does not close**, and it is separate from the case above
	 * because the two calls do NOT overlap at the ticket check: the first passes it, begins a
	 * slow write, and only then does the second arrive. Without the write chain the first
	 * settles last and restores the project the user navigated away from. Reported by a review
	 * bot; the same-tick case passes against that build.
	 */
	it('ends on the later project when a second navigation arrives mid-write', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());
		const writes = slowSetViewState(leaf); // first write resolves only when released

		const first = navigateToProject(deps, TYPE, 'project-1');
		await writes.firstWriteStarted;
		const second = navigateToProject(deps, TYPE, 'project-2');
		writes.releaseFirst();
		await Promise.all([first, second]);

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * The case that fails against any build inferring success from the leaf being there —
	 * which every other case here passes with.
	 */
	it('navigates nothing when revealing an existing leaf faulted', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		workspace.revealLeaf = () => Promise.reject(new Error('boom'));

		await navigateToProject(depsFor(workspace, vi.fn<(cause: unknown) => void>()), TYPE, 'project-1');

		expect(leaf.getViewState().state).toBeUndefined();
	});

	/**
	 * **The case the boolean does not cover**, in the implementation's own words: a
	 * successful activation whose leaf has since gone, and the create path having produced
	 * none. `revealView` answers `true` — the reveal itself worked — but the write step's
	 * own re-read of `getLeavesOfType` is a SEPARATE call, made after an `await`, and nothing
	 * guarantees the leaf it found a moment ago is still there when it asks again.
	 */
	it('writes nothing when the leaf is gone by the time the write step re-reads it', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const reportFault = vi.fn<(cause: unknown) => void>();
		const original = workspace.getLeavesOfType.bind(workspace);
		let calls = 0;
		workspace.getLeavesOfType = (type: string) => {
			calls += 1;
			// Call 1 is `revealView`'s own candidate lookup, which finds the leaf and
			// succeeds; call 2 is the write step's own re-read, answered as empty.
			return calls === 1 ? original(type) : [];
		};

		await navigateToProject(depsFor(workspace, reportFault), TYPE, 'project-1');

		expect(reportFault).not.toHaveBeenCalled();
		expect(leaf.getViewState().state).toBeUndefined();
	});

	/**
	 * **A throwing candidate lookup must not poison the chain**, which is the half that
	 * outlives the gesture: an uncaught throw settles `navigationWrites` rejected, every later
	 * `.then(step)` skips its callback, and project navigation is dead for the rest of the
	 * session with nothing on screen to say why. Both assertions are load-bearing — reporting
	 * the fault is equally true of a build whose chain never recovers. Reported by a review
	 * bot.
	 */
	it('reports a throwing leaf lookup and still navigates afterwards', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const reportFault = vi.fn<(cause: unknown) => void>();
		const deps = depsFor(workspace, reportFault);
		const healthy = workspace.getLeavesOfType.bind(workspace);
		workspace.getLeavesOfType = () => {
			throw new Error('boom');
		};

		await navigateToProject(deps, TYPE, 'project-1');
		workspace.getLeavesOfType = healthy;
		await navigateToProject(deps, TYPE, 'project-2');

		expect(reportFault).toHaveBeenCalledTimes(1);
		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * **The case above does not actually discriminate the invariant its own docblock names**,
	 * measured by running Step 4's third mutation against it: `getLeavesOfType` throws
	 * unconditionally there, so `revealView`'s OWN candidate lookup — the exact same function,
	 * called FIRST — already reports the fault and answers `false`, and `navigateToProject`
	 * returns before `navigationWrites` is ever touched. The write step's own `try` is never
	 * reached either way, mutated or not, so that case stays green against the mutation it was
	 * written to catch.
	 *
	 * This one lets `revealView`'s own lookup succeed (the leaf is already open, so its single
	 * candidate call passes) and throws only on the SECOND `getLeavesOfType` call — the write
	 * step's own re-read, the one `if (leaf === undefined)` exists to guard and the one the
	 * class docblock is actually about. Watched against the mutation: both this call and the
	 * next one throw uncaught, which is the "dead for the rest of the session" the docblock
	 * describes, since `navigationWrites` stays rejected across calls.
	 */
	it('reports a throwing leaf lookup from the write step itself, and recovers on the next call', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const reportFault = vi.fn<(cause: unknown) => void>();
		const deps = depsFor(workspace, reportFault);
		const healthy = workspace.getLeavesOfType.bind(workspace);
		let calls = 0;
		workspace.getLeavesOfType = (type: string) => {
			calls += 1;
			// Call 1 is `revealView`'s own candidate lookup (the leaf is already open, so it
			// succeeds); call 2 is the write step's own re-read, which is the one this case
			// exists to fault.
			if (calls === 2) throw new Error('boom');
			return healthy(type);
		};

		await navigateToProject(deps, TYPE, 'project-1');
		expect(reportFault).toHaveBeenCalledTimes(1);
		expect(leaf.getViewState().state).toBeUndefined();

		workspace.getLeavesOfType = healthy;
		await navigateToProject(deps, TYPE, 'project-2');
		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * **The singleton assumption breaks the moment the pane is split.** Obsidian's own split
	 * action duplicates a leaf with its view state intact, so a vault with the Renovation
	 * Project pane split genuinely has TWO leaves of the type — and writing to
	 * `getLeavesOfType(type)[0]` regardless would let a row click or Back raised inside the
	 * SECOND pane silently retarget the first, leaving the pane the user actually clicked in
	 * showing its stale state. This case fails against exactly that build: a version that
	 * ignores `targetLeaf` writes to `first`, since `first` is the type lookup's own index-0
	 * answer.
	 */
	it('writes to the leaf navigation was raised from, leaving a second leaf of the type untouched', async () => {
		const workspace = new FakeWorkspace();
		const first = workspace.withOpen(TYPE, { projectId: 'project-1' });
		const second = workspace.withOpen(TYPE, { projectId: 'project-2' });
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());

		await navigateToProject(deps, TYPE, 'project-3', targetOf(second));

		expect(second.getViewState().state).toEqual({ projectId: 'project-3' });
		expect(first.getViewState().state).toEqual({ projectId: 'project-1' });
	});

	/**
	 * **Two reviewers found this independently on the first version of `targetLeaf`.** The
	 * ticket and the write chain were module-scoped — one shared lane, correct only while every
	 * call resolved to the same singleton leaf. `targetLeaf` was added to let two split panes
	 * navigate INDEPENDENTLY, and a shared lane broke that: a navigation for leaf B, arriving
	 * before leaf A's queued write ran, bumped the one shared ticket and made A's own
	 * supersession check see itself as superseded by an unrelated target — dropping A's write
	 * down the same path a legitimate supersession takes, silently, with `reportFault` never
	 * called because nothing actually faulted. This case fails against exactly that build:
	 * `first`'s write is dropped because `second`'s call bumps the one shared counter before
	 * `first`'s chained step re-reads it.
	 */
	it('lands both writes when two navigations target different leaves concurrently', async () => {
		const workspace = new FakeWorkspace();
		const first = workspace.withOpen(TYPE, { projectId: 'project-1' });
		const second = workspace.withOpen(TYPE, { projectId: 'project-2' });
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());

		await Promise.all([
			navigateToProject(deps, TYPE, 'project-a', targetOf(first)),
			navigateToProject(deps, TYPE, 'project-b', targetOf(second)),
		]);

		expect(first.getViewState().state).toEqual({ projectId: 'project-a' });
		expect(second.getViewState().state).toEqual({ projectId: 'project-b' });
	});

	/** A door in this directory that REJECTS has no one to catch it. */
	it('reports a rejecting setViewState and still resolves', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		leaf.setViewState = () => Promise.reject(new Error('boom'));
		const reportFault = vi.fn<(cause: unknown) => void>();

		await expect(
			navigateToProject(depsFor(workspace, reportFault), TYPE, 'project-1'),
		).resolves.toBeUndefined();
		expect(reportFault).toHaveBeenCalledTimes(1);
	});
});
