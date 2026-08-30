import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { classify, debt, findingsByFile } from "./typecheck-baseline.mjs";

/**
 * Type-check `tests/**` against `tsconfig.tests.json` and hold the result to a RATCHET.
 *
 * `tsconfig.json` covers `src/` and five `tests/` entries admitted one at a time, each of
 * which paid for itself on its first run — `fixtureVault.test-d.ts` found two pre-existing
 * defects, and `makeRenovationProjectView.ts` was added after a `logger: undefined` that
 * TypeErrored inside the very catch block existing so a fault reaches somebody, invisible to
 * all four gates. The rest of `tests/` has never been type-checked at all (vitest transpiles
 * without checking), and turning it on wholesale reports 562 errors across 114 of 307 files.
 *
 * So the debt is held as a BASELINE of files permitted to fail, and this fails in both
 * directions — see `classify` in `./typecheck-baseline.mjs`, which is where the rules live
 * and what `tests/build/typecheckRatchet.test.ts` drives. This file is the effects: spawn
 * the compiler, read the list, print what to do about it.
 *
 * There is no `--update` flag, for the same reason `vitest.config.ts`'s coverage floors are
 * edited by hand: a regenerate button is pressed to get past a red gate, and the entry it
 * adds looks exactly like the ones that were argued for. The output names every file to add
 * or remove, so the edit is mechanical without being automatic.
 *
 * NOT in `npm run check` yet, and that is a measurement rather than an oversight: it adds
 * about 8 seconds to a gate that already runs `vue-tsc` once, on all four CI legs. It joins
 * `check` when the baseline is small enough that the second compile is buying something.
 */

const BASELINE = "scripts/typecheck-tests-baseline.json";

/**
 * `vue-tsc`'s own JS entry under `node_modules`, run through `process.execPath` rather than
 * through the `.bin` shim — the shim is a shell script on POSIX and a `.cmd` on Windows, and
 * `execFileSync` cannot spawn the latter without a shell. `npm run check` rides a Windows CI
 * leg, so this is a real constraint rather than a precaution.
 */
const VUE_TSC = path.join("node_modules", "vue-tsc", "bin", "vue-tsc.js");

/**
 * What a NON-ZERO exit from `vue-tsc` meant: its findings, or an exit because the tool could
 * not run at all.
 *
 * Its own function rather than a branch inside `report`, because the rule it carries is the
 * one worth finding: tsc exits non-zero WITH its findings on stdout, so an exit carrying
 * nothing there is a missing binary or an unparseable config — and that must not read as a
 * clean tree, which is exactly what an empty findings string would mean downstream. A gate
 * reporting success when it could not run is worse than no gate.
 */
const findingsOrExit = (error) => {
	// Not optional-chained: the only throw reaching here is `execFileSync`'s, which is always
	// an object. Its `stdout`/`stderr` ARE nullable — a spawn that never started (a missing
	// binary) leaves both null and puts the whole story on `message`, which is why the second
	// fallback is the error itself rather than an empty string.
	const failure = error;
	const stdout = String(failure.stdout ?? "");

	if (stdout.trim() !== "") return stdout;

	console.error(`vue-tsc could not run.\n${String(failure.stderr ?? error)}`);
	return process.exit(2);
};

/** Everything `vue-tsc` printed about `tests/**`, or `""` when it had nothing to say. */
const report = () => {
	try {
		execFileSync(process.execPath, [VUE_TSC, "--noEmit", "-p", "tsconfig.tests.json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return "";
	} catch (error) {
		return findingsOrExit(error);
	}
};

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")).files;
const grouped = findingsByFile(report());
const { regressions, cleaned, missing } = classify({ grouped, baseline, exists: existsSync });

if (regressions.length > 0) {
	console.error(`\n${regressions.length} file(s) are not on the baseline and do not type-check:\n`);
	for (const file of regressions) for (const finding of grouped.get(file)) console.error(`  ${finding}`);
	console.error("\nFix them, or — if this is a genuinely new area of debt — add them to");
	console.error(`${BASELINE} with a note saying why.`);
}

if (cleaned.length > 0) {
	console.error(`\n${cleaned.length} baseline entr(ies) now type-check and must be removed:\n`);
	for (const file of cleaned) console.error(`  ${file}`);
	console.error(`\nDelete those lines from ${BASELINE}. The list only shrinks.`);
}

if (missing.length > 0) {
	console.error(`\n${missing.length} baseline entr(ies) name a file that does not exist:\n`);
	for (const file of missing) console.error(`  ${file}`);
	console.error("\nA renamed or deleted file leaves a carve-out that reads as a live exception.");
}

if (regressions.length > 0 || cleaned.length > 0 || missing.length > 0) process.exit(1);

console.log(`tests/ type-check: ${grouped.size} file(s) still on the baseline, ${debt(grouped)} error(s) of debt.`);
