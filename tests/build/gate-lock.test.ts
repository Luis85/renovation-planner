import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/repo';

/**
 * `scripts/gate-lock.mjs` — the serializer behind `npm run check:queued`.
 *
 * Why it exists at all is in the script's own header: `npm run check` is ~200s of a
 * four-core box and two of them at once do not cost 2x, they thrash, and the failure is a
 * WRONG red rather than a slow one (a destroyed `coverage/.tmp`, an ESLint `beforeAll`
 * over budget). Subagents run in parallel by design, so the rule had to stop being a
 * sentence in CLAUDE.md.
 *
 * What is checked here is the property, not the mechanism: two runs do not overlap, and
 * the lock does not survive its holder. A test that only asserted "the lock directory
 * appears" would pass against a wrapper that never waits for anything.
 */

const SCRIPT = path.join(REPO, 'scripts', 'gate-lock.mjs');

const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
	scripts: Record<string, string>;
};

/**
 * A private lock per case, through the env var the script reads.
 *
 * Not a tidiness measure: this file runs inside the suite, and the suite runs inside the
 * gate. A case taking the REAL lock while `npm run check:queued` holds it would wait
 * `STALE_MS` for itself — twenty minutes of hang rather than a failure, on the one command
 * this whole change exists to make usable.
 */
let lock = '';

const workspace = mkdtempSync(path.join(tmpdir(), 'rp-gate-lock-'));

afterEach(() => {
	rmSync(lock, { recursive: true, force: true });
});

/**
 * A command that appends `<tag>-in`, holds for `holdMs`, then appends `<tag>-out`.
 *
 * The path arrives in `RP_LOG` rather than baked into the `-e` source, and that is not
 * tidiness: a Windows path is full of backslashes, and embedding one puts quotes and escapes
 * into an argument that the wrapper may hand to a shell. This helper's subject is ordering,
 * so it should not be able to fail for a quoting reason — the passthrough case below is
 * where argument fidelity is actually asked about.
 */
const marker = (tag: string, holdMs: number): string[] => [
	'-e',
	`const f = require('fs'), p = process.env.RP_LOG;` +
		`f.appendFileSync(p, '${tag}-in\\n');` +
		`Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${holdMs});` +
		`f.appendFileSync(p, '${tag}-out\\n');`,
];

/**
 * Run the long marker and the short one together, and answer the order they actually
 * interleaved in. `wrapped` decides whether each goes through the serializer, which is what
 * lets one helper produce both the claim and its own control.
 */
const raceTwo = async (wrapped: boolean): Promise<string[]> => {
	const log = path.join(workspace, `${wrapped ? 'wrapped' : 'bare'}.log`);

	rmSync(log, { force: true });

	const argv = (tag: string, holdMs: number): string[] =>
		wrapped ? [SCRIPT, process.execPath, ...marker(tag, holdMs)] : marker(tag, holdMs);

	const env = { ...process.env, RP_GATE_LOCK: lock, RP_LOG: log };
	const first = spawn(process.execPath, argv('A', 600), { env, stdio: 'ignore' });

	// Long enough that the second process starts while the first is demonstrably inside its
	// hold — the bare control below is what proves this window is real rather than assumed.
	await new Promise<void>((resolve) => {
		setTimeout(resolve, 200);
	});

	spawnSync(process.execPath, argv('B', 0), { env, stdio: 'ignore' });

	await new Promise<void>((resolve) => {
		first.on('exit', () => {
			resolve();
		});
	});

	return readFileSync(log, 'utf8').trim().split('\n');
};

describe('the queued gate', () => {
	it('is wired as an npm script pointing at a file that exists', () => {
		expect(pkg.scripts['check:queued']).toBe('node scripts/gate-lock.mjs npm run check');
		expect(existsSync(SCRIPT)).toBe(true);
	});

	/**
	 * `check` itself stays the literal four steps CI runs, and that is a DECISION rather
	 * than an omission. `tests/build/harness-shot.test.ts` asserts what `pkg.scripts.check`
	 * contains; moving those steps behind a wrapper would leave that guard reading the
	 * wrapper — still green, and blind to the thing it exists to see.
	 */
	it('does not wrap the gate CI invokes', () => {
		expect(pkg.scripts.check).toBe('npm run build && npm run lint && npm run test:coverage && npm run analyze');
	});

	it('runs two gates one after the other rather than at once', async () => {
		lock = path.join(workspace, 'wrapped.lock');

		expect(await raceTwo(true)).toStrictEqual(['A-in', 'A-out', 'B-in', 'B-out']);
	});

	/**
	 * The instrument, proven able to see the thing the case above reports the absence of.
	 * Without this, a `raceTwo` whose second process simply never started would satisfy the
	 * ordering assertion and pin nothing.
	 */
	it('is what makes the difference — unwrapped, the same two runs overlap', async () => {
		lock = path.join(workspace, 'bare.lock');

		expect(await raceTwo(false)).toStrictEqual(['A-in', 'B-in', 'B-out', 'A-out']);
	});

	/**
	 * Arguments reach the command unchanged — the Windows leg's own regression.
	 *
	 * The first version passed `shell: true` on win32 unconditionally, because `npm` is
	 * `npm.cmd` and cannot be executed directly. A shell re-parses the argument vector, so a
	 * payload carrying quotes and backslashes arrived mangled, the child never ran, and the
	 * only symptom was a file that was never written — no error from the wrapper at all.
	 * Three Ubuntu legs were green while `verify (windows-latest, 22)` was red.
	 *
	 * The argument here is deliberately hostile in exactly the two ways that matter: a space,
	 * which a shell would split on, and a double quote, which it would eat. On Linux this
	 * passes either way — the case earns its place on the Windows leg, which is the platform
	 * the fix is about, and this repository already runs the floor there for this reason.
	 */
	it('passes an argument with a space and a quote through to the command unchanged', () => {
		lock = path.join(workspace, 'argv.lock');
		const out = path.join(workspace, 'argv.out');
		const hostile = 'a b "c"';

		const result = spawnSync(
			process.execPath,
			[SCRIPT, process.execPath, '-e', "require('fs').writeFileSync(process.env.RP_OUT, process.argv[1] ?? '')", hostile],
			{ env: { ...process.env, RP_GATE_LOCK: lock, RP_OUT: out }, stdio: 'ignore', timeout: 15_000 },
		);

		expect(result.status).toBe(0);
		expect(readFileSync(out, 'utf8')).toBe(hostile);
	});

	/**
	 * A lock nobody is holding any more — a gate that was SIGKILLed, or a machine that lost
	 * power — must not wedge every later gate. `STALE_MS` is the bound, and the case ages
	 * the directory rather than waiting twenty minutes for one.
	 */
	it('reclaims a lock whose holder is gone, leaving nothing aside', () => {
		lock = path.join(workspace, 'stale.lock');
		const ran = path.join(workspace, 'stale.ran');

		mkdirSync(lock);

		const longAgo = new Date(Date.now() - 60 * 60 * 1000);
		utimesSync(lock, longAgo, longAgo);

		const result = spawnSync(
			process.execPath,
			[SCRIPT, process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(ran)}, 'yes')`],
			// BOUNDED, so a build that stopped reclaiming fails at the assertion below rather
			// than hanging: `spawnSync` blocks this thread, and vitest's own test timeout
			// cannot interrupt a synchronous call — the whole FILE would stall instead.
			{ env: { ...process.env, RP_GATE_LOCK: lock }, stdio: 'ignore', timeout: 15_000 },
		);

		expect(result.status, 'the stale lock was never reclaimed').toBe(0);
		expect(existsSync(ran)).toBe(true);

		// The reclaim moves the directory aside before judging it. A `.reclaim-<pid>` left
		// in the workspace would mean that move was never finished — a leak that grows one
		// directory per killed gate, and the tell that the rename path took its error arm.
		expect(readdirSync(workspace).filter((entry) => entry.includes('.reclaim-'))).toStrictEqual([]);
	});

	/**
	 * The property a review bot asked for, at the level one process can reach.
	 *
	 * The first version of `reclaimIfStale` read `stat(LOCK)` and then `rm(LOCK)`, so a
	 * holder releasing between the two had its REPLACEMENT unlinked and two gates could then
	 * overlap. What is checked here is the invariant that closes it — a lock which is not
	 * stale is never removed by a waiter — not the interleaving itself, which needs the
	 * holder to release inside a two-statement window and cannot be driven from here. The
	 * `rename`-then-judge structure in the script is what makes the untestable half safe,
	 * and its docblock names the residue that remains.
	 */
	it('never removes a lock that is not stale', async () => {
		lock = path.join(workspace, 'fresh.lock');
		const ran = path.join(workspace, 'fresh.ran');

		mkdirSync(lock);

		const waiter = spawn(
			process.execPath,
			[SCRIPT, process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(ran)}, 'yes')`],
			{ env: { ...process.env, RP_GATE_LOCK: lock }, stdio: 'ignore' },
		);

		// Longer than one POLL_MS, so the waiter has been round its loop and had every
		// chance to reclaim — a shorter wait would pass against a script that reclaims on
		// its second poll.
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 2500);
		});

		expect(existsSync(lock), 'a live holder lost its lock').toBe(true);
		expect(existsSync(ran), 'the waiter ran while another holder had the lock').toBe(false);

		waiter.kill();

		await new Promise<void>((resolve) => {
			waiter.on('exit', () => {
				resolve();
			});
		});
	});

	/**
	 * Both halves of one defect, and it was a real one: `process.exit()` does not run a
	 * pending `finally`, so the first version of this script released nothing and every
	 * later gate on the machine waited `STALE_MS` for a holder that had already finished.
	 * A FAILING command is the case that matters — an exit path taken by a red gate, which
	 * is exactly when the next run is most wanted.
	 */
	it('forwards the exit code and releases the lock even when the command fails', () => {
		lock = path.join(workspace, 'failing.lock');

		const result = spawnSync(process.execPath, [SCRIPT, process.execPath, '-e', 'process.exit(7)'], {
			env: { ...process.env, RP_GATE_LOCK: lock },
			stdio: 'ignore',
		});

		expect(result.status).toBe(7);
		expect(existsSync(lock)).toBe(false);
	});
});
