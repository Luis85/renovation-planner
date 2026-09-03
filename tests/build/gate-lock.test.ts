import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

/** A command that appends `<tag>-in`, holds for `holdMs`, then appends `<tag>-out`. */
const marker = (log: string, tag: string, holdMs: number): string[] => [
	'-e',
	`const f = require('fs');` +
		`f.appendFileSync(${JSON.stringify(log)}, '${tag}-in\\n');` +
		`Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${holdMs});` +
		`f.appendFileSync(${JSON.stringify(log)}, '${tag}-out\\n');`,
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
		wrapped ? [SCRIPT, process.execPath, ...marker(log, tag, holdMs)] : marker(log, tag, holdMs);

	const env = { ...process.env, RP_GATE_LOCK: lock };
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
