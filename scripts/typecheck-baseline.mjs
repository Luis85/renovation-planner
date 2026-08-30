/**
 * The decision half of `npm run typecheck:tests`, with no compiler and no filesystem in it.
 *
 * Split out from `scripts/typecheck-tests.mjs` so the ratchet can be driven directly:
 * running `vue-tsc` over `tests/**` costs about 15 seconds, and this repository already has
 * one file (`tests/build/chromium.test.ts`) whose header records what synchronous
 * multi-second bursts do to a two-core CI runner beside test files that wait in TICKS. The
 * CLI keeps the effects — spawning the compiler, reading the baseline, exiting — and this
 * keeps the rules, which are the part with behaviour worth pinning.
 */

/**
 * `path(line,col): error TS0000: message` — the only line shape tsc reports a finding in.
 *
 * The path is captured GREEDILY, so the `(line,col)` it stops at is the LAST one on the line
 * rather than the first parenthesis in it. A filename containing `(` is legal —
 * `tests/foo(bar).test.ts(1,1): error TS2322: …` — and a lazier path class stops inside the
 * NAME, fails the digits that must follow, and drops the whole line: a file free to hold type
 * errors while never appearing in `regressions`, which is the ratchet passing over the exact
 * thing it exists to catch. Reported by a review bot; measured both ways in
 * `typecheckRatchet.test.ts`.
 */
const FINDING = /^(?<file>.+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+): (?<message>.*)$/;

/**
 * tsc prints a path with the platform's separator, so a baseline written on Linux would name
 * files no Windows run could match — a gate reporting every file as both a regression AND
 * stale, on a tree with no change in it. `npm run check` rides a Windows CI leg, so this is
 * a real constraint rather than a precaution, and normalising at the ONE seam where a path
 * enters is what keeps every comparison below spelling-independent.
 */
export const posix = (file) => file.replace(/\\/g, "/");

/**
 * Findings grouped by the file they are in, in the order tsc reported them.
 *
 * tsc's continuation lines — the indented `Type 'X' is not assignable…` detail under a
 * finding — carry parentheses and would be read as filenames by a looser pattern, so the
 * position and the `error TS` code are both required rather than only the path shape.
 */
export const findingsByFile = (output) => {
	const grouped = new Map();

	for (const line of output.split(/\r?\n/)) {
		const match = FINDING.exec(line);

		if (!match) continue;

		const file = posix(match.groups.file);

		if (!grouped.has(file)) grouped.set(file, []);
		grouped.get(file).push(line.trim());
	}
	return grouped;
};

/**
 * What the run means, in three lists, ANY of which is a failure:
 *
 *   - `regressions` — a file with errors that the baseline does not permit. The point of the
 *     gate: 193 of 307 test files are already clean, and this is what keeps them that way
 *     and checks every new file from the day it is written.
 *   - `cleaned` — a baseline entry with no errors left. The half that makes this a RATCHET
 *     rather than a list nobody prunes: a carve-out for a file that no longer needs one goes
 *     on reading as a live exception, so it must be removed in the commit that earned it.
 *   - `missing` — a baseline entry naming a path that does not exist, so a rename or a delete
 *     cannot smuggle a file back onto the list under a name nothing checks.
 *
 * `exists` is a parameter rather than a `node:fs` call for the reason the header gives: the
 * rules stay drivable. It is asked ONLY of baseline entries — a file tsc reported on
 * demonstrably exists, and asking again would be a second answer to a settled question.
 */
export const classify = ({ grouped, baseline, exists }) => {
	const permitted = new Set(baseline);

	return {
		regressions: [...grouped.keys()].filter((file) => !permitted.has(file)),
		cleaned: baseline.filter((file) => !grouped.has(file) && exists(file)),
		missing: baseline.filter((file) => !exists(file)),
	};
};

/** Total findings across every file, for the one line a passing run prints. */
export const debt = (grouped) => [...grouped.values()].reduce((total, findings) => total + findings.length, 0);
