import { readFileSync, readdirSync } from 'node:fs';

/**
 * Assemble `styles/index.css` and its partials into the single stylesheet Obsidian
 * loads. The output is `dist/styles.css` — emitted as a build asset and served to the
 * harness page by the shared Vite plugin in `scripts/vite-assembled-styles.mjs`, which
 * `vite.config.ts` and `vite.harness.config.ts` both consume; `test-build.mjs` copies
 * the built file into the vault. Nothing is written to the repository root, and the
 * generated sheet is NOT a file to edit.
 *
 * Obsidian injects a plugin's `styles.css` as one blob, so a runtime `@import` would
 * resolve against the app rather than the plugin folder. The imports in the entry file
 * are therefore a build instruction, and this is the build: concatenation in the stated
 * order, which is the whole of it because the order is the only thing CSS assembly has
 * to get right — two rules of equal specificity are decided by which came last.
 *
 * Resolving the imports here rather than in a bundler is why `.fallowrc.json` seeds
 * `styles/**` as `dynamicallyLoaded`: the graph runs through this function, which no
 * static analyser walks. Fallow therefore cannot report an unimported partial, so this
 * does — see the checks below.
 */

// Relative to the WORKING DIRECTORY, not to this file — which is worth saying now that
// this file lives in `scripts/` and `styles/` does not. npm scripts and vitest both run
// from the repository root, and every other build script here resolves the same way.
const DIR = 'styles/';

// The cap `eslint.config.mjs` holds every TypeScript module to. Splitting a file that
// nothing measures leaves it split only until someone appends to it.
const MAX_LINES = 400;

// One flat partial per import: `styles/<name>.css`, hyphens included, no subdirectories.
// Matched per trimmed line, so CRLF endings and a trailing comment cannot unmatch it.
const IMPORT = /^@import\s+"\.\/([\w.-]+\.css)";$/;

// Without dropping the trailing newline's phantom segment, a 400-line file counts as 401
// and the effective cap silently becomes 399 — one under what ESLint's max-lines allows.
function countLines(body) {
	const lines = body.split('\n');
	if (lines.at(-1) === '') lines.pop();
	return lines.length;
}

/**
 * Typed by JSDoc rather than a sibling `.d.mts`: a hand-written declaration file is a
 * second copy of this signature that nothing type-checks against the implementation,
 * while an annotation here cannot drift from the code under it.
 *
 * @returns {string} the assembled stylesheet
 */
export function assembleStyles() {
	const entry = readFileSync(`${DIR}index.css`, 'utf8');

	// The entry file ships nothing itself, so every non-comment line must be an import
	// this function resolves. A line it cannot see — a rule authored here, an import from
	// a subdirectory — would be silently absent from the shipped sheet, the one failure a
	// stylesheet cannot report, so an unrecognized line fails the build LOUDLY instead.
	const imported = [];
	const unrecognized = [];
	for (const raw of entry.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
		const line = raw.trim();
		if (line === '') continue;
		const match = IMPORT.exec(line);
		if (match) imported.push(match[1]);
		else unrecognized.push(line);
	}
	if (unrecognized.length > 0) {
		throw new Error(
			`styles/index.css contains lines the assembler cannot ship — only \`@import "./<partial>.css";\` (flat, no subdirectories) and comments belong in the entry file: ${unrecognized.join(' | ')}`,
		);
	}

	// A partial imported TWICE passes every other gate (nothing is orphaned, every line
	// parses) and is concatenated again at its later position — silently reordering the
	// cascade the header above calls behaviour. A rebase or merge is where this comes from.
	const duplicates = [...new Set(imported.filter((name, at) => imported.indexOf(name) !== at))];
	if (duplicates.length > 0) {
		throw new Error(`styles/index.css imports more than once: ${duplicates.join(', ')}`);
	}

	// An unimported partial is silently absent from the shipped sheet — the one failure
	// mode of a split that a stylesheet cannot report and a screenshot barely can.
	const present = readdirSync(DIR).filter((name) => name.endsWith('.css') && name !== 'index.css');
	const missing = present.filter((name) => !imported.includes(name));
	if (missing.length > 0) {
		throw new Error(`styles/index.css does not import: ${missing.join(', ')}`);
	}

	const parts = imported.map((name) => {
		const body = readFileSync(DIR + name, 'utf8');
		const lines = countLines(body);
		if (lines > MAX_LINES) throw new Error(`styles/${name} is ${lines} lines, over the ${MAX_LINES}-line cap`);
		return `/* === styles/${name} === */\n\n${body.trim()}\n`;
	});

	return `/*
THIS FILE IS GENERATED from styles/ by styles-assemble.mjs — edit the partial, not this.
The import order in styles/index.css is load-bearing and states why.
*/\n\n${parts.join('\n')}`;
}
