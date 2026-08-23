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

// A hard-coded colour looks correct in whichever theme authored it and wrong in every
// other one — SDD §84 asks for Obsidian's CSS variables instead, and `styles/view.css`
// already claims none exist here. This is what makes that claim checked rather than
// merely believed.
//
// What this SEES: a hex colour — `#fff`, `#a1b2c3`, `#a1b2c3d4` — EXACTLY 3, 4, 6 or 8
// hex digits (RGB / RGBA / RRGGBB / RRGGBBAA, the only lengths CSS accepts; 5 and 7 are
// not a colour and are not matched), or an `rgb()` / `rgba()` / `hsl()` / `hsla()` call —
// and ONLY inside a declaration block (`selector { property: value; }`), never inside a
// selector. A selector is never a colour however hex-shaped its name reads, and chasing
// every hex-looking English word one spelling at a time (`fade`, `dad`, `face`, `cab`,
// `bad`, `beef`, `cafe`, `ace`, …) is a losing game the block boundary avoids entirely —
// `onlyInsideBraces` below blanks everything outside a `{ }` pair before the scan runs,
// so `#fade { filter: url(#fade); }` and `#dad { margin: 0; }` are both selectors, not
// colours, and neither is looked at.
//
// Inside a block, `url(...)` is stripped before the scan runs too: `url(#fade)` sits in
// VALUE position but holds a same-document fragment reference, not a colour, and — same
// reasoning as above — enumerating which functions are colours and which are not is the
// same losing game as enumerating hex-shaped words.
//
// What this does NOT see, deliberately: CSS NAMED colours (`red`, `rebeccapurple`, …) —
// a bare word cannot be told apart from a class name, a custom-property name or prose in
// a comment without parsing the declaration it sits in, and this project has decided not
// to add a CSS parser for one check. It also cannot see a colour that is not literally
// wrapped in a `{ }` pair in this file's own text — no partial in this project writes one
// outside a block, so this is a real narrowing, stated rather than hidden. `currentColor`,
// `transparent` and `inherit` need no exemption logic: none of them is a hex or a
// function-call spelling, so the pattern below simply never matches them.
const HARDCODED_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])|\b(?:rgba?|hsla?)\s*\(/i;

// A colour named only inside a `/* comment */` is not shipped as a rule. Blanking the
// comment bodies (newlines kept, everything else spaced out) removes it from view while
// leaving every other line's number exactly where it was — the same trade the entry-file
// parser above makes by stripping comments before it looks for `@import` lines.
function withoutComments(body) {
	return body.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

// Selectors and at-rule preludes come before `{`; a declaration's property and value come
// after it. Blanking everything OUTSIDE a brace pair (newlines kept, so line numbers
// survive) is how the scan tells `#fade { ... }` — a selector, ignored — apart from
// `color: #fade;` — a value, checked — using nothing more than character counting. Must
// run AFTER `withoutComments`: a stray `{` or `}` inside a comment would otherwise
// desynchronise the depth count from the real blocks.
function onlyInsideBraces(body) {
	let depth = 0;
	let out = '';
	for (const ch of body) {
		if (ch === '\n') {
			out += '\n';
		} else if (ch === '{') {
			depth += 1;
			out += ' ';
		} else if (ch === '}') {
			depth = Math.max(0, depth - 1);
			out += ' ';
		} else {
			out += depth > 0 ? ch : ' ';
		}
	}
	return out;
}

// `url(...)` holds a URL or, for an SVG filter, a same-document fragment reference — not
// a colour, even when its argument happens to be a hex-shaped word. Blanking the whole
// call (newlines kept) removes it from view the same way comments and selectors are
// removed above.
function withoutUrlCalls(body) {
	return body.replace(/url\(\s*[^)]*\)/gi, (call) => call.replace(/[^\n]/g, ' '));
}

// A partial with a hard-coded colour fails the build LOUDLY, naming the file and the
// line — the one failure mode a shipped, themed-looking stylesheet cannot report for
// itself the way a broken import can.
function checkForHardcodedColors(name, body) {
	const scanned = withoutUrlCalls(onlyInsideBraces(withoutComments(body)));
	const lines = scanned.split('\n');
	for (const [index, line] of lines.entries()) {
		const match = HARDCODED_COLOR.exec(line);
		if (match) {
			throw new Error(
				`styles/${name}:${index + 1} hard-codes a colour (\`${match[0]}\`) — use an Obsidian CSS variable (e.g. var(--text-normal)) instead, so a themed vault stays themed.`,
			);
		}
	}
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
		checkForHardcodedColors(name, body);
		return `/* === styles/${name} === */\n\n${body.trim()}\n`;
	});

	return `/*
THIS FILE IS GENERATED from styles/ by styles-assemble.mjs — edit the partial, not this.
The import order in styles/index.css is load-bearing and states why.
*/\n\n${parts.join('\n')}`;
}
