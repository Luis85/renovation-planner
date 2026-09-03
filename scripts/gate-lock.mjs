import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Run a command while holding a machine-wide lock, so two gates QUEUE instead of racing.
 *
 * `npm run check` is about 200 seconds of a four-core box: 160 of them are the suite, and
 * the suite's own cost is dominated by per-file overhead that is CPU and nothing else.
 * Two of those runs at once therefore do not cost 2x — they thrash, and the failure is not
 * a slow run but a WRONG one. CLAUDE.md already names both shapes: `coverage/` is a shared
 * directory, so the second run deletes the first's `coverage/.tmp/coverage-N.json`
 * mid-write ("Something removed the coverage directory"), and every `tests/build/` file
 * that boots a type-aware ESLint has a `beforeAll` budget that a contended machine blows —
 * a red that reads exactly like a real one until somebody reads the other agent's log.
 *
 * That guidance has existed as a SENTENCE for several increments, which is the reason this
 * file exists rather than a longer sentence: subagents run in parallel by design, and a
 * rule kept by remembering is a rule some door is not following.
 *
 * NOT wrapped around `check` itself, deliberately. `tests/build/harness-shot.test.ts`
 * asserts what `pkg.scripts.check` CONTAINS, and moving the gate's four steps behind an
 * indirection would leave that guard reading a wrapper — true, vacuous, and exactly the
 * shadowed-test defect this repository has already paid for twice. `check` stays the
 * literal gate CI runs; this is the door an agent uses instead.
 */

/**
 * One lock per machine, named for the package rather than for the checkout.
 *
 * Keyed on neither `process.cwd()` nor the git common directory, and that is the point: a
 * worktree is a separate path running the same suite on the same cores, so a per-checkout
 * lock would let two worktrees contend — the case this exists for, since `.worktrees/` is
 * where parallel agents actually work.
 */
// `RP_GATE_LOCK` overrides it, and that exists for ONE caller rather than as a
// convenience: `tests/build/gate-lock.test.ts` runs inside the suite, and the suite runs
// inside the gate. A test taking the real lock while `check:queued` holds it would wait
// STALE_MS for itself — a deadlock whose symptom is a twenty-minute hang, not a failure.
const LOCK = process.env.RP_GATE_LOCK ?? path.join(tmpdir(), "renovation-planner-gate.lock");

/**
 * How long a lock may sit untouched before the next waiter takes it.
 *
 * A holder that is Ctrl+C'd between `mkdir` and its own `finally` leaves the directory
 * behind, and a lock nobody can clear wedges every later gate — worse than the contention
 * it prevents. The bound is generous against the thing being timed: a gate is ~200s on a
 * quiet box and the worst measured contended run is a few minutes, so twenty minutes is
 * "nobody is running this" rather than "somebody is slow". A PID check would be tighter
 * and is not portable enough to be worth it here.
 */
const STALE_MS = 20 * 60 * 1000;

const POLL_MS = 2000;

/**
 * Who holds the lock, and the file that says so.
 *
 * A release used to be "remove whatever is at `LOCK`", which is a claim about a PATH rather
 * than about a HOLD — and the two come apart in exactly the window `reclaimIfStale` names
 * below: a waiter can move our lock aside while we run, a third process can then claim the
 * path, and our release would delete THAT process's lock. The nonce makes the release say
 * what it means: remove the lock only while it is still the one we took.
 */
const HOLDER = path.join(LOCK, "holder");

const NONCE = `${process.pid} ${Date.now()} ${Math.random().toString(36).slice(2)}\n`;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Whether `target`'s mtime has not moved in `STALE_MS`. A path that is gone is not stale. */
const isStale = (target) => {
	try {
		return Date.now() - statSync(target).mtimeMs > STALE_MS;
	} catch {
		return false;
	}
};

/**
 * Return a live lock we should not have moved, without ever leaving the path free.
 *
 * `renameSync` replaces an existing EMPTY directory atomically — measured on this platform,
 * not assumed — so while our placeholder is still standing the lock goes back and the path
 * is never once unoccupied. Windows cannot rename onto an existing directory at all, so
 * there the placeholder is removed first; that directory is OURS rather than a holder's, so
 * removing it takes nobody's lock, and the gap it opens is the residue named below.
 *
 * `occupied` is false only when a third process claimed the path in the instant between our
 * two calls. Then `LOCK` is somebody's real lock and must not be touched, so the live lock
 * we are holding has nowhere to go and is dropped — which is safe rather than merely
 * unavoidable, because a release checks its own nonce and so cannot delete the claimant's.
 */
const putBack = (aside, occupied) => {
	try {
		renameSync(aside, LOCK);
		return;
	} catch {
		// Windows, or a placeholder we never got. Both are decided by `occupied` below.
	}

	if (occupied) {
		rmSync(LOCK, { recursive: true, force: true });

		try {
			renameSync(aside, LOCK);
			return;
		} catch {
			// Claimed inside the gap this branch exists to admit.
		}
	}

	rmSync(aside, { recursive: true, force: true });
};

/**
 * Take the path the instant it is free, so the validation below never runs over a claimable
 * lock. Answers whether the placeholder is OURS: the one thing that can beat us here is
 * another process's real claim, which must then be left alone.
 *
 * Its own function rather than an inline `try`, for the reason the last round of this file
 * already paid once: `scripts/` sits outside the coverage include, so fallow scores every
 * function here as 0% covered and a cyclomatic 5 lands exactly on the CRAP threshold.
 */
const occupy = () => {
	try {
		mkdirSync(LOCK);

		return true;
	} catch {
		return false;
	}
};

/**
 * Reclaim a lock whose holder is gone — without unlinking a live one, and without leaving
 * the path free while we work out which we took. Answers whether the lock is now OURS.
 *
 * The first version read `stat(LOCK)` then `rm(LOCK)`, and its comment called the gap
 * between them harmless. It is not, and a review bot said so: if the stale holder releases
 * after the `stat` and a new process claims the path before the `rm`, that `rm` deletes the
 * NEW holder's lock. The "harmless" the old comment described is a DIFFERENT race (two
 * waiters both reclaiming one dead lock), which is the shape its author had in mind.
 *
 * The first rule that closes it: **decide staleness on the directory you already hold, not
 * on the path you are about to delete.** `renameSync` is the arbitration — atomic, so
 * exactly one waiter can move a given directory and every other one fails — and it carries
 * the mtime with it, so the same question is re-asked of something nothing can swap out.
 *
 * The second rule cost another review round, because the first one alone was not enough:
 * **validation may not run over a free path.** Moving the lock aside and only then judging
 * it left `LOCK` claimable for the length of a `stat`, so a third process could take it
 * while a live lock sat in our hands — the reported race rebuilt one step further along,
 * with a put-back that then failed and dropped somebody's live lock. So the placeholder
 * goes up in the statement after the rename, and every decision below is made behind it.
 *
 * TWO RESIDUES, named rather than implied. A third process can still claim the path in the
 * instant between the `rename` and the `mkdir`, which is two syscalls with nothing between
 * them rather than a `stat` — and its consequence is now bounded by the holder nonce rather
 * than by luck. And a holder that genuinely runs longer than `STALE_MS` is stale by this
 * definition and can be reclaimed while alive; the bound is twenty minutes against a gate
 * measured at three, and the obvious remedy — a holder touching its own lock on a timer —
 * cannot work here, because `spawnSync` blocks the event loop for the whole run it times.
 */
const reclaimIfStale = () => {
	if (!isStale(LOCK)) return false;

	const aside = `${LOCK}.reclaim-${process.pid}`;

	try {
		renameSync(LOCK, aside);
	} catch {
		// Released, or another waiter moved it first. Either way it is no longer ours to judge.
		return false;
	}

	// Occupy the path before judging what we took. Everything below is validation, and a
	// validation performed over a free path is what turns a put-back into an overlap.
	const occupied = occupy();

	if (isStale(aside)) {
		rmSync(aside, { recursive: true, force: true });
		return occupied;
	}

	putBack(aside, occupied);

	return false;
};

/** Whether the lock is ours now. Answers false rather than throwing, so the caller polls. */
const claim = () => {
	try {
		mkdirSync(LOCK);
	} catch (error) {
		if (error.code !== "EEXIST") throw error;

		// A reclaim that succeeded leaves us holding the placeholder it put up, so the claim
		// is finished by writing the nonce below rather than by waiting for the next poll.
		if (!reclaimIfStale()) return false;
	}

	writeFileSync(HOLDER, NONCE);

	return true;
};

/**
 * Drop the lock — but only while it is still the one we took.
 *
 * An unconditional `rm` here is a claim about a PATH, and this script's whole subject is
 * that a path and a hold are different things. A waiter reclaiming inside the window
 * `reclaimIfStale` names can leave us running with our lock moved aside and somebody else
 * legitimately holding `LOCK`; removing it then would hand a third gate the path while that
 * holder still ran, which is the reported defect one step further on. Reading the nonce
 * first makes that case a no-op instead.
 */
const release = () => {
	try {
		if (readFileSync(HOLDER, "utf8") !== NONCE) return;
	} catch {
		// Already gone, or a placeholder mid-reclaim. Neither is ours to remove.
		return;
	}

	rmSync(LOCK, { recursive: true, force: true });
};

/**
 * Whether this command has to go through a shell — on Windows, and only there.
 *
 * `npm` is `npm.cmd`, which `CreateProcess` cannot execute directly, so the one command this
 * script exists to run needs a shell. A shell RE-PARSES the argument vector, though, and
 * Windows quoting is not JavaScript quoting: `node -e "...\"C:\\x\\y\"..."` reaches the
 * child mangled, the child never runs, and the failure surfaces as a missing output file
 * with no error from the wrapper at all. That is not a hypothesis — it is what
 * `verify (windows-latest, 22)` reported on this file's first commit while all three Ubuntu
 * legs were green.
 *
 * So the shell is asked for only where it is needed. An `.exe` is executable directly, which
 * covers `process.execPath` and therefore every argument-sensitive caller; everything else on
 * Windows may be a `.cmd` or a `.bat` and gets one. On any other platform there is no shell
 * at all and arguments are passed as written.
 */
const needsShell = (bin) => process.platform === "win32" && !bin.toLowerCase().endsWith(".exe");

const command = process.argv.slice(2);

if (command.length === 0) {
	console.error("usage: node scripts/gate-lock.mjs <command> [args...]");
	process.exit(2);
}

let waited = false;

while (!claim()) {
	if (!waited) {
		console.error(`Another gate is running. Waiting for ${LOCK} — a queued gate is faster than two contended ones.`);
		waited = true;
	}
	sleep(POLL_MS);
}

// Every exit path releases, including the signals a person actually uses. Without this an
// interrupted gate leaves a lock that the next one waits STALE_MS for, which is the
// wedged-gate failure this file's own bound exists to bound rather than to permit.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
	process.on(signal, () => {
		release();
		process.exit(1);
	});
}

// The exit is OUTSIDE the `try`, and that is the whole of why this is three statements
// rather than one: `process.exit()` terminates immediately and does NOT run a pending
// `finally`, so exiting from inside the block released nothing — every later gate on the
// machine then waited STALE_MS for a holder that had already finished. Measured rather
// than reasoned: two sequential runs left the lock directory standing and the second
// blocked on it.
let status = 1;

try {
	const [bin, ...args] = command;
	status = spawnSync(bin, args, { stdio: "inherit", shell: needsShell(bin) }).status ?? 1;
} finally {
	release();
}

process.exit(status);
