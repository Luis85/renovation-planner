import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Lints ONE file the moment an agent writes it, and refuses the edit if oxlint has
 * something to say. Wired as a `PostToolUse` hook in `.claude/settings.json`; the tool
 * call's JSON arrives on stdin and `tool_input.file_path` is the file that changed.
 *
 * Why at the edit and not only at the gate: `npm run check` is the definition of done, but
 * it is also several turns away, and by the time it runs the reasoning that produced a
 * defect is gone. oxlint answers for one file in about 90ms — fast enough to be the
 * immediate answer, where ESLint's type-aware pass over the tree is not.
 *
 * What this is NOT: a substitute for `npm run check`. It sees one file, so it cannot see a
 * layer violation's other end, a type error, a dead export or anything ESLint owns. It is
 * the first refusal, not the last one, and the gate still decides.
 */

// The extensions oxlint parses. Everything else — a stylesheet, a manifest, Markdown — is
// somebody else's check, and running the linter on it would only produce noise.
const LINTED = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

// Claude Code's blocking exit code: stderr goes back to the agent as the reason.
const REFUSE = 2;

const readStdin = async () => {
	const chunks = [];

	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8");
};

/**
 * Every failure below exits 0. A hook that fails CLOSED on its own bug blocks every edit
 * in the session with an error about the hook rather than about the code, and the gate is
 * still there to catch what this one missed. Silence on a broken hook is the lesser
 * failure, and the loud one is what `npm run check` is for.
 */
try {
	const raw = await readStdin();
	const file = JSON.parse(raw)?.tool_input?.file_path;

	if (typeof file !== "string" || !LINTED.test(file)) process.exit(0);

	// Resolved against the working directory, which is the project root the hook runs in —
	// the same rule every script here follows. `--no-error-on-unmatched-pattern` keeps an
	// ignored path (a write into `.obsidian/` or `.claude/`) from being reported as a
	// failure to lint anything.
	const oxlint = path.join("node_modules", "oxlint", "bin", "oxlint");
	const args = [oxlint, "--format=agent", "--no-error-on-unmatched-pattern", file];

	execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
	const findings = String(error?.stdout ?? "").trim();

	if (!findings) process.exit(0);

	process.stderr.write(`${findings}\n\nFix these before continuing — oxlint runs again in npm run check.\n`);
	process.exit(REFUSE);
}
