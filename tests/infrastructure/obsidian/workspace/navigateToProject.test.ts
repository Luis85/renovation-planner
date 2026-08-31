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
 * `chains` and `issued` are module state in `navigateToProject.ts` — a `WeakMap` of per-leaf
 * write chains, and the monotonic counter that fixes supersession order at arrival — module
 * scoped for the same reason `activating` next door is, and the module's own comments say so —
 * so a case left holding a previous case's ticket or a rejected write
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
 * `as never` at every call site here — stated as the rule rather than as a count, because the
 * count was written as "fifteen" and was eighteen by the time anyone read it again.
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
	 * **The write lands on the leaf the reveal ANSWERED, not on whatever a fresh lookup says a
	 * moment later — the fourth instalment of one shape in this module: a value re-derived
	 * after an `await` is a value that may have changed.** The earlier three were the target
	 * leaf re-derived by type, the ticket re-derived across targets, and the lane re-derived
	 * from how a call was raised.
	 *
	 * `revealView` used to answer a BOOLEAN, so the leaf it had actually revealed was discarded
	 * and re-derived by `getLeavesOfType(type)[0]` on the far side of the `await`. Obsidian's
	 * workspace is free to move in that window — the revealed pane closed, a drag or a split
	 * reordering the leaves — and the palette command then revealed one pane and wrote the
	 * project state into another, with no error anywhere and the pane the user was looking at
	 * showing its stale state.
	 *
	 * Driven exactly that way: two leaves of the type (a split pane, which is what makes index
	 * 0 an unsafe description at all), the reveal held across a microtask, and the order
	 * reversed while it is in flight so that `[0]` afterwards is the OTHER leaf. Both
	 * assertions discriminate and they discriminate differently — the revealed pane must carry
	 * the write, and the pane the stale lookup would have chosen must be untouched.
	 *
	 * **Watched failing against the boolean signature**: the write landed on `other`, leaving
	 * `revealed` with no project state at all.
	 */
	it('writes to the leaf the reveal answered, not the one the lookup would answer afterwards', async () => {
		const workspace = new FakeWorkspace();
		const revealed = workspace.withOpen(TYPE);
		const other = workspace.withOpen(TYPE);
		const reportFault = vi.fn<(cause: unknown) => void>();
		workspace.revealLeaf = async (leaf) => {
			workspace.revealed.push(leaf);
			await Promise.resolve();
			// The workspace moves WHILE the reveal is in flight, which is the whole scenario:
			// after this, `getLeavesOfType(TYPE)[0]` is `other` and no longer the revealed pane.
			workspace.leaves.reverse();
		};

		await navigateToProject(depsFor(workspace, reportFault), TYPE, 'project-1');

		expect(workspace.revealed).toEqual([revealed]);
		expect(revealed.getViewState().state).toEqual({ projectId: 'project-1' });
		expect(other.getViewState().state).toBeUndefined();
		expect(reportFault).not.toHaveBeenCalled();
	});

	/**
	 * **A throwing candidate lookup must not poison the chain**, which is the half that
	 * outlives the gesture: an uncaught throw settles this lane's `writes` rejected, every
	 * later `.then(step)` skips its callback, and project navigation is dead for the rest of
	 * the session with nothing on screen to say why. Both assertions are load-bearing —
	 * reporting the fault is equally true of a build whose chain never recovers. Reported by a
	 * review bot.
	 *
	 * `getLeavesOfType` is called in ONE place on this path now — the thunk `revealView` hands
	 * `revealCandidate`, inside that function's own fault boundary — so the throw is reported
	 * there and answered as no leaf, and `navigateToProject` returns before anything is queued.
	 * A second case used to sit beside this one, faulting a SECOND lookup that `revealedLeaf`
	 * made after the reveal resolved; that lookup is what the leaf-answering signature deleted,
	 * so the case went with it rather than being weakened to pass.
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

	/**
	 * **The third link in that chain, and the one per-target lanes created.** Keying the lane on
	 * `targetLeaf` gave a call with no leaf — the command palette's case — a module-level
	 * sentinel lane of its own, while an in-view call naming the very leaf that call reveals was
	 * keyed on the leaf. Two lanes for ONE physical pane, and two lanes are not serialized
	 * against each other: neither the ticket nor the chain could see the other. So a palette
	 * navigation mid-write, plus a row click or Back in that same pane, issued CONCURRENT
	 * `setViewState` calls, and the earlier palette write could settle last and overwrite the
	 * user's later, in-pane choice — the exact window the write chain closes for two calls that
	 * do share a lane.
	 *
	 * **Both assertions discriminate, and they discriminate differently**, which is why the
	 * recorder is installed BEFORE the hold: `slowSetViewState` then wraps it, so what `written`
	 * records is the order the writes actually REACHED the leaf rather than the order they were
	 * requested. Requested order is `['project-1', 'project-2']` in both builds and pins
	 * nothing. Against the two-lane build the in-view write runs while the palette write is
	 * still held, so the leaf sees `['project-2', 'project-1']` and ends on `project-1` — the
	 * reported symptom. Against this one the in-view call joins the palette call's own lane and
	 * cannot start until it finishes, so the leaf sees them in issue order and ends where the
	 * user last asked to be. Watched red both ways before this case was kept.
	 */
	it('ends on the in-view project when it is issued while a palette write is held', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const written = recordSetViewState(leaf);
		const writes = slowSetViewState(leaf); // wraps the recorder: holds the first write
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());

		const palette = navigateToProject(deps, TYPE, 'project-1');
		await writes.firstWriteStarted;
		const inView = navigateToProject(deps, TYPE, 'project-2', targetOf(leaf));
		writes.releaseFirst();
		await Promise.all([palette, inView]);

		expect(written.map((state) => state.projectId)).toEqual(['project-1', 'project-2']);
		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * **Which call is LATER is decided at arrival, and this is the case that says so.** Choosing
	 * the lane from the resolved leaf means a palette call cannot take a lane's ticket until its
	 * reveal has settled — so a per-lane `++chain.ticket` taken there would make supersession
	 * order RESUME order, and resume order is not arrival order. `revealCandidate` coalesces
	 * only its CREATE path; revealing a leaf that is already open is an ordinary
	 * `await workspace.revealLeaf(...)` per call, and two of those can settle in either order,
	 * because the real one activates a tab and may expand a collapsed sidebar to do it.
	 *
	 * Driven exactly that way: the FIRST navigation's reveal is held (it reaches `revealLeaf`
	 * synchronously, so it is the one that gets the hold), the second's resolves at once and
	 * completes its whole write, and only then does the first resume. The user asked for
	 * `project-2` last, so `project-2` is where the pane must end — and the earlier call must
	 * write NOTHING rather than remount on top of it.
	 *
	 * **It is the only case here that discriminates two designs the rest of the file cannot
	 * see**, both measured green against the other thirteen: a per-lane increment taken after the
	 * reveal hands the LOWER ticket to the call the user made SECOND, and a plain
	 * `chain.ticket = issue` instead of the MAX lets the late-resuming earlier call lower what
	 * the later one already recorded. Both end on `project-1`.
	 */
	it('ends on the later-issued project when an earlier call reveals more slowly', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const written = recordSetViewState(leaf);
		const deps = depsFor(workspace, vi.fn<(cause: unknown) => void>());
		let releaseReveal: (() => void) | undefined;
		const heldReveal = new Promise<void>((resolve) => {
			releaseReveal = resolve;
		});
		let firstReveal = true;
		workspace.revealLeaf = () => {
			if (!firstReveal) return Promise.resolve();
			firstReveal = false;
			return heldReveal;
		};

		const first = navigateToProject(deps, TYPE, 'project-1');
		const second = navigateToProject(deps, TYPE, 'project-2');
		await second;
		releaseReveal?.();
		await first;

		expect(written.map((state) => state.projectId)).toEqual(['project-2']);
		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * A door in this directory that REJECTS has no one to catch it — and the SECOND half is
	 * what pins the chain's own recovery. An uncaught throw inside the chained step settles
	 * that lane's `writes` REJECTED, after which every later `.then(step)` skips its callback
	 * and navigation is dead for this pane for the rest of the session, silently. `setViewState`
	 * is now the only thing inside that boundary — the candidate lookup that used to share it
	 * moved out with the lane change — so this is the case that would go red if the `try` were
	 * dropped, and reporting the fault is equally true of a build whose chain never recovers.
	 */
	it('reports a rejecting setViewState, still resolves, and navigates afterwards', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.withOpen(TYPE);
		const healthy = leaf.setViewState.bind(leaf);
		leaf.setViewState = () => Promise.reject(new Error('boom'));
		const reportFault = vi.fn<(cause: unknown) => void>();
		const deps = depsFor(workspace, reportFault);

		await expect(navigateToProject(deps, TYPE, 'project-1')).resolves.toBeUndefined();
		expect(reportFault).toHaveBeenCalledTimes(1);

		leaf.setViewState = healthy;
		await navigateToProject(deps, TYPE, 'project-2');

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});
});
