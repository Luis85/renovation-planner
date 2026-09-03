import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Whether `target`'s mtime has not moved in `STALE_MS`. A path that is gone is not stale. */
const isStale = (target) => {
	try {
		return Date.now() - statSync(target).mtimeMs > STALE_MS;
	} catch {
		return false;
	}
};

/** Return a lock we moved aside but should not have, or drop it if the path is taken again. */
const putBack = (aside) => {
	try {
		renameSync(aside, LOCK);
	} catch {
		rmSync(aside, { recursive: true, force: true });
	}
};

/**
 * Reclaim a lock whose holder is gone — WITHOUT ever unlinking a live one.
 *
 * The first version read `stat(LOCK)` and then `rm(LOCK)`, and its comment called the gap
 * between them harmless. It is not, and a review bot said so: if the stale holder releases
 * after the `stat` and a new process claims the path before the `rm`, that `rm` deletes the
 * NEW holder's lock, and the next poller then acquires a path someone is still working
 * under — two gates overlapping, which is the one thing this file exists to prevent. The
 * "harmless" the old comment described is a DIFFERENT race (two waiters both reclaiming one
 * dead lock), which is the shape its author had in mind.
 *
 * The rule that closes it: **decide staleness on the directory you already hold, not on the
 * path you are about to delete.** `renameSync` is the arbitration — atomic, so exactly one
 * waiter can move a given directory and every other one fails — and it carries the mtime
 * with it, so the SAME question asked of `aside` is being asked of a directory nothing can
 * swap out from under us. A replacement lock is by construction freshly made, so it answers
 * "not stale" and goes back where it came from.
 *
 * TWO RESIDUES, named rather than implied. Between our `rename` and `putBack`'s `rename`
 * the path is briefly free, so a third process can claim it — and then the lock we moved
 * aside is dropped, which is the overlap above with a far narrower window rather than none.
 * Closing that needs an atomic conditional rename, which the platform does not offer. And a
 * holder that genuinely runs longer than `STALE_MS` is stale by this definition and can be
 * reclaimed while alive; the bound is twenty minutes against a gate measured at three, and
 * the obvious remedy — a holder that touches its own lock on a timer — cannot work here,
 * because `spawnSync` blocks the event loop for the whole of the run it is timing.
 */
const reclaimIfStale = () => {
	if (!isStale(LOCK)) return;

	const aside = `${LOCK}.reclaim-${process.pid}`;

	try {
		renameSync(LOCK, aside);
	} catch {
		// Released, or another waiter moved it first. Either way it is no longer ours to judge.
		return;
	}

	if (isStale(aside)) rmSync(aside, { recursive: true, force: true });
	else putBack(aside);
};

/** Whether the lock is ours now. Answers false rather than throwing, so the caller polls. */
const claim = () => {
	try {
		mkdirSync(LOCK);
		writeFileSync(path.join(LOCK, "holder"), `${process.pid}\n`);
		return true;
	} catch (error) {
		if (error.code !== "EEXIST") throw error;

		reclaimIfStale();

		return false;
	}
};

const release = () => rmSync(LOCK, { recursive: true, force: true });

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
