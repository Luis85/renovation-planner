import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Lints ONE file the moment an agent writes it, and puts what oxlint says in front of the
 * agent immediately. Wired as a `PostToolUse` hook in `.claude/settings.json`; the tool
 * call's JSON arrives on stdin and `tool_input.file_path` is the file that changed.
 *
 * Why at the edit and not only at the gate: `npm run check` is the definition of done, but
 * it is also several turns away, and by the time it runs the reasoning that produced a
 * defect is gone. oxlint answers for one file in about 90ms — fast enough to be the
 * immediate answer, where ESLint's type-aware pass over the tree is not.
 *
 * WHAT THIS DOES NOT DO, stated first because the obvious reading is wrong: it does not
 * prevent the edit and it does not roll one back. `PostToolUse` runs AFTER the tool has
 * written the file — Claude Code's own table reads "Shows stderr to Claude; the tool
 * already ran" — so by the time this sees the path, the change is on disk. Only
 * `PreToolUse` can block, and only for a payload it can lint before the write: a `Write`
 * carries its whole content, an `Edit` carries a fragment whose result would have to be
 * reconstructed to be linted at all. That is the trigger for revisiting this, and it is
 * not today's problem.
 *
 * It is also no substitute for `npm run check`. One file means it cannot see a layer
 * violation's other end, a type error, a dead export or anything ESLint owns.
 *
 * ONE EXCEPTION to that last clause, and it is measured rather than a hedge: for a `.vue` file
 * this also runs ESLint. oxlint has no port of `eslint-plugin-vue` — no Vue rules at all — so
 * for that one extension the fast linter is blind to the entire ruleset that governs the file.
 * A mock author writing a template hits `vue/html-indent` and
 * `vue/singleline-html-element-content-newline` immediately; the hook said nothing and
 * `npm run check` said it several turns later, which is precisely the gap this hook exists to
 * close, in the one tree whose authors are most likely to fall into it. Measured on this
 * machine: oxlint answers in ~110ms and ESLint in ~2.5s for one SFC. That cost is paid only on
 * a `.vue` edit, which is why it is not extended to `.ts` — there oxlint and the gate overlap
 * enough that seconds per edit would buy little.
 */

// The extensions oxlint parses, `.vue` included: oxlint reports findings inside an SFC's
// `<script setup lang="ts">` block (measured — `no-console` fires there), so an SFC edit
// belongs in this loop like any other. Everything else — a stylesheet, a manifest, Markdown — is
// somebody else's check, and running the linter on it would only produce noise.
const LINTED = /\.(?:ts|mts|cts|js|mjs|cjs|vue)$/;

/**
 * The exit code that routes stderr to the AGENT. This is the whole reason it is 2 and not
 * 1: on `PostToolUse` neither code stops anything, but 1 shows stderr to the user and lets
 * the agent carry on unaware, while 2 hands it the findings as a tool error it has to
 * answer for. Nothing here refuses a write; this decides who gets told.
 */
const TELL_THE_AGENT = 2;

/**
 * The files that mark a directory as the root of a project a linter can be run in. Either one
 * alone is enough: a git worktree is a full checkout and carries both, and asking for both
 * would make the derivation fail on a tree that happens to be missing one.
 */
const ROOT_MARKERS = [".oxlintrc.json", "package.json"];

/**
 * The directory the linters should RUN IN for this file: its nearest ancestor that looks like
 * a project root, or the working directory when no ancestor does.
 *
 * WHY THIS EXISTS. The hook's working directory is the MAIN repository root, but an edited
 * file's path may point into a git worktree — this repository keeps them in `.worktrees/`,
 * and a worktree is a FULL COPY carrying its own `.oxlintrc.json`, its own
 * `eslint.config.mjs` and its own `node_modules`. Run from the main root, both linters
 * answer about the wrong tree:
 *
 * - **oxlint** anchors "the root config" on its working directory, so the worktree's
 *   byte-identical `.oxlintrc.json` is read as a NESTED one and
 *   `options.reportUnusedDisableDirectives` — root-only — fails the whole run. That text
 *   lands on STDOUT, so `run` returns it as findings and every edit inside a worktree was
 *   answered with a tool error about the config, with no file ever linted. Measured.
 * - **ESLint** ignores `.worktrees/**` globally (`eslint.config.mjs`), so the config that
 *   governs a worktree SFC has to be the worktree's own. It is found today only because
 *   ESLint 10 resolves the config file from the LINTED FILE's location; under ESLint 9 it
 *   resolved from the working directory, found the main config, and an SFC edited in a
 *   worktree came back silently clean from a hook that never read it. Setting the working
 *   directory makes that correct by construction rather than by a lookup rule that has
 *   already changed once.
 *
 * WHY NOT oxlint's config flags. `-c <config>` pinned to the main repository's file would
 * lint a worktree against the WRONG BRANCH's rules, and `--disable-nested-config` does the
 * same thing by making the main root's config the only one — a quieter version of this very
 * bug, and one no error message would announce. The working directory is the only lever that
 * gives each tree its own rules, which is what a preview of `npm run check` run IN that tree
 * has to mean.
 *
 * WHY A WALK AND NOT `git rev-parse --show-toplevel`. Both name the same directory here;
 * only the cost differs, and this sits on the edit loop's hot path in front of a ~90ms
 * linter. Measured on this machine: the walk is **0.22ms** and the spawn **61ms** — two
 * thirds of oxlint's whole answer, spent to learn what four `existsSync` calls already know.
 *
 * WHY NOT MATCH `.worktrees`. A directory name is a list of the places somebody thought of:
 * it is wrong for a worktree placed anywhere else, and it says nothing about any other nested
 * root. The marker files are the thing itself.
 */
const rootFor = (file) => {
	let dir = path.dirname(path.resolve(file));

	for (;;) {
		if (ROOT_MARKERS.some((marker) => existsSync(path.join(dir, marker)))) return dir;

		const parent = path.dirname(dir);

		// No ancestor looks like a project. The working directory is what this hook used
		// before any of this existed, so falling back to it changes nothing for a file
		// outside any repository — and a linter that then cannot say anything useful about
		// it already answers "" through `run`.
		if (parent === dir) return process.cwd();
		dir = parent;
	}
};

/**
 * A linter binary to run for `root`: the one installed THERE, or the hook's own when that
 * tree has none.
 *
 * A worktree here has its own `node_modules` (verified), which is the case worth optimising
 * for: it runs the versions that tree's `package.json` pins. One that does not — never
 * installed, or half-deleted — falls back rather than failing open, and the choice is
 * deliberate: the WORKING DIRECTORY is what carries the rules, so a borrowed binary still
 * reads that tree's own config and reports about the right branch. Only the linter's version
 * differs, which is a far smaller wrong answer than saying nothing at all. If even the
 * fallback is missing, `run` answers "" and the hook stays silent — the fail-open rule,
 * unchanged.
 */
const binaryIn = (root, ...segments) => {
	const local = path.join(root, "node_modules", ...segments);

	return existsSync(local) ? local : path.join(process.cwd(), "node_modules", ...segments);
};

const readStdin = async () => {
	const chunks = [];

	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8");
};

/**
 * One linter over one file: its findings, or `""` when it had none.
 *
 * A linter that cannot RUN — a missing binary, an unreadable config — throws with nothing on
 * stdout and answers `""` here, which is the fail-open rule below applied per linter rather
 * than only to the hook as a whole. Two linters now, and a broken second one must not swallow
 * the first one's findings.
 */
const run = (args, cwd) => {
	try {
		execFileSync(process.execPath, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
		return "";
	} catch (error) {
		return String(error?.stdout ?? "").trim();
	}
};

/**
 * Every failure below exits 0. A hook that fails CLOSED on its own bug answers every edit
 * in the session with an error about the hook rather than about the code, and the gate is
 * still there to catch what this one missed. Silence on a broken hook is the lesser
 * failure, and the loud one is what `npm run check` is for.
 */
try {
	const raw = await readStdin();
	const file = JSON.parse(raw)?.tool_input?.file_path;

	if (typeof file !== "string" || !LINTED.test(file)) process.exit(0);

	// Resolved against the EDITED FILE's own project root rather than against the working
	// directory — see `rootFor` for the whole reason, which is that the file may live in a
	// git worktree carrying its own linters, its own configuration and its own branch's
	// rules. For every file in the main tree this is the working directory and nothing
	// changes. `--no-error-on-unmatched-pattern` keeps an ignored path (a write into
	// `.obsidian/` or `.claude/`) from being reported as a failure to lint anything.
	const root = rootFor(file);
	const oxlint = binaryIn(root, "oxlint", "bin", "oxlint");
	const eslint = binaryIn(root, "eslint", "bin", "eslint.js");
	// `--max-warnings=0` because the GATE uses it: a warning fails `npm run lint`, so a hook
	// that stayed quiet about one would be telling the agent the file is clean when the thing
	// it is a preview of would reject it.
	const runs = [
		[oxlint, "--format=agent", "--no-error-on-unmatched-pattern", file],
		...(file.endsWith(".vue") ? [[eslint, "--no-error-on-unmatched-pattern", "--max-warnings=0", file]] : []),
	];
	const findings = runs
		.map((args) => run(args, root))
		.filter(Boolean)
		.join("\n");

	if (!findings) process.exit(0);

	// The file already carries these findings — this is not a rejected write to retry, it
	// is a written one to go back and fix.
	const next = "The edit is already on disk. Fix these — the same linters run again in npm run check.";

	process.stderr.write(`${findings}\n\n${next}\n`);
	process.exit(TELL_THE_AGENT);
} catch {
	// The hook's OWN failure — unreadable stdin, malformed JSON. A linter that cannot run is
	// already handled per linter in `run` above, so nothing here swallows a finding.
	process.exit(0);
}
