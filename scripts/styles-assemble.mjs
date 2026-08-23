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
// not a colour and are not matched) — or a call to one of CSS Color's colour functions:
// `rgb()` / `rgba()` / `hsl()` / `hsla()` / `hwb()` / `lab()` / `lch()` / `oklab()` /
// `oklch()` / `color()`. That list is the complete set the CSS Color spec defines as of
// this writing — a CLOSED, spec-named vocabulary, unlike a bare colour word (see below).
// `\bcolor\(` requires the literal word immediately followed by `(`, which is what tells
// the `color` FUNCTION apart from the `color` PROPERTY (`color: var(--text-normal);` —
// followed by `:`, never matched) and from a custom property merely named after it
// (`--my-color: …`, `--color-scheme: …` — followed by `-` or `:`, never `(`).
//
// Both spellings above are recognised ONLY inside a declaration's value — `property:
// value;` — never inside a selector or an at-rule prelude, AT ANY NESTING DEPTH.
// `forEachDeclaration` below is a small hand-rolled walk, not a depth counter: it
// classifies each chunk of text between structural characters by which one ends it —
// `{` means the chunk was a selector or prelude (discarded, unscanned) and `;` or `}`
// means it was a declaration (scanned) — which is what makes `@media (…) { #fade { … }
// }` correct without tracking brace depth at all: `#fade` still ends in `{`, so it is
// still a selector, no matter how many blocks it is nested inside.
//
// The walk also tracks CSS's other two structural exceptions, because a scan blind to
// either gets real stylesheets wrong: a `{`, `}`, `;` or `(`/`)` inside a QUOTED STRING
// (`'`/`"`, with `\` escapes) is literal text, not structure, so `content: "}";` cannot
// end a block early — and the quoted text itself is masked out of the scan, since a CSS
// colour is never legitimately written as a quoted string (`content: "#fff";` is a
// label). And a `;` inside PARENTHESES — a colour function's own arguments, a `url()`
// argument, a `data:` URI's `;base64,` — belongs to that call, not to the declaration
// that contains it. `url(...)` itself is blanked before matching: it holds a URL or a
// same-document fragment reference, never a colour, however hex-shaped its argument
// reads (`url(#fade)`).
//
// What this does NOT see, and why each is a deliberate line, not an oversight:
//  - CSS NAMED colours (`red`, `rebeccapurple`, …). Unlike a function name, a bare word
//    is not self-marking — nothing distinguishes it from a class name, a custom-property
//    name or comment prose without parsing the declaration around it — and this project
//    has decided not to add a CSS parser for one check.
//  - A colour function the CSS Color spec adds AFTER this list was written. The function
//    set is closed and spec-named, not inferred, so a future spec addition needs a
//    one-line update here — the same maintenance any enumerated vocabulary carries.
//  - Anything outside plain, hand-authored CSS syntax this project's own partials use —
//    no Sass/Less nesting shorthand, no `@supports selector(...)`-style constructs this
//    walk cannot already parse as ordinary parens. Every construct actually exercised by
//    `styles/` today (nested rules, `@media`, `@keyframes`, quoted `content`, `url()`,
//    custom properties) was traced by hand against this walk before it shipped.
// `currentColor`, `transparent` and `inherit` need no exemption logic: none of them is a
// hex or a function-call spelling, so the pattern below simply never matches them.
const HARDCODED_COLOR =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i;

// A colour named only inside a `/* comment */` is not shipped as a rule. Blanking the
// comment bodies (newlines kept, everything else spaced out) removes it from view while
// leaving every other line's number exactly where it was — the same trade the entry-file
// parser above makes by stripping comments before it looks for `@import` lines.
function withoutComments(body) {
	return body.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

// `url(...)` holds a URL or, for an SVG filter, a same-document fragment reference — not
// a colour, even when its argument happens to be a hex-shaped word. Blanking the whole
// call (newlines kept) removes it from view the same way comments are removed above.
function withoutUrlCalls(body) {
	return body.replace(/url\(\s*[^)]*\)/gi, (call) => call.replace(/[^\n]/g, ' '));
}

const QUOTE_CHARS = new Set(['"', "'"]);

/**
 * One character's worth of quote bookkeeping, split out of `forEachDeclaration` so that
 * function stays under this project's complexity budget. Handles both halves: opening a
 * quote (`quote` is null and `ch` is `"`/`'`) and advancing inside one (an escaped
 * character clears the escape flag, an unescaped `\` sets it, an unescaped matching quote
 * closes the string). `handled: true` means the caller should just append `append` and
 * move on — the character was quote punctuation or quoted content, masked (a literal
 * `\n` aside, kept for line-number math) because a quoted string is never a colour value.
 * `handled: false` means `ch` is untouched by quoting and still needs classifying.
 */
function advanceQuoteState(ch, quote, escaped) {
	if (quote) {
		const append = ch === '\n' ? '\n' : ' ';
		if (escaped) return { quote, escaped: false, append, handled: true };
		if (ch === '\\') return { quote, escaped: true, append, handled: true };
		if (ch === quote) return { quote: null, escaped: false, append, handled: true };
		return { quote, escaped, append, handled: true };
	}
	if (QUOTE_CHARS.has(ch)) return { quote: ch, escaped: false, append: ch, handled: true };
	return { quote, escaped, append: ch, handled: false };
}

// `(` opens one more level, `)` closes one, anything else leaves depth alone — split out
// so `forEachDeclaration` tests depth once instead of branching on `(` and `)` separately.
function nextParenDepth(ch, parenDepth) {
	if (ch === '(') return parenDepth + 1;
	if (ch === ')') return Math.max(0, parenDepth - 1);
	return parenDepth;
}

// A `(`/`)` itself, or anything still inside one, owns its own `{`/`}`/`;` (a function
// call's own parentheses — a data: URI's `;base64,` — not the declaration around it).
function isInsideParens(ch, parenDepth) {
	return ch === '(' || ch === ')' || parenDepth > 0;
}

// `;` ends a declaration outright; `}` ends one that was missing its trailing semicolon
// AND closes the enclosing block — either way, what preceded it gets scanned.
function endsADeclaration(ch) {
	return ch === ';' || ch === '}';
}

/**
 * Walks `body` once and calls `onDeclaration(text, startLine)` for every chunk of text
 * that a `;` or a block-closing `}` ends — a declaration's property and value — while
 * silently discarding every chunk a `{` ends — a selector or an at-rule prelude, at
 * whatever depth it sits. See the long comment above `HARDCODED_COLOR` for why this
 * classification, not brace depth, is what makes the caller correct.
 *
 * Must run on comment-stripped text: a stray `{`/`}` inside a comment would desynchronise
 * this walk from the real blocks the same way it would a depth counter.
 */
function forEachDeclaration(body, onDeclaration) {
	let chunk = '';
	let chunkStartLine = 1;
	let line = 1;
	let quote = null;
	let escaped = false;
	let parenDepth = 0;

	for (const ch of body) {
		if (ch === '\n') line += 1;

		const quoteState = advanceQuoteState(ch, quote, escaped);
		quote = quoteState.quote;
		escaped = quoteState.escaped;
		if (quoteState.handled) {
			chunk += quoteState.append;
			continue;
		}

		parenDepth = nextParenDepth(ch, parenDepth);
		if (isInsideParens(ch, parenDepth)) {
			chunk += ch;
			continue;
		}

		if (ch === '{') {
			chunk = '';
			chunkStartLine = line;
			continue;
		}
		if (endsADeclaration(ch)) {
			onDeclaration(chunk, chunkStartLine);
			chunk = '';
			chunkStartLine = line;
			continue;
		}
		chunk += ch;
	}
	// A declaration missing its final semicolon, immediately before EOF, is still real.
	if (chunk.trim() !== '') onDeclaration(chunk, chunkStartLine);
}

// A partial with a hard-coded colour fails the build LOUDLY, naming the file and the
// line — the one failure mode a shipped, themed-looking stylesheet cannot report for
// itself the way a broken import can.
function checkForHardcodedColors(name, body) {
	forEachDeclaration(withoutComments(body), (chunk, startLine) => {
		const scanned = withoutUrlCalls(chunk);
		const match = HARDCODED_COLOR.exec(scanned);
		if (!match) return;
		const before = scanned.slice(0, match.index);
		const line = startLine + (before.match(/\n/g) ?? []).length;
		throw new Error(
			`styles/${name}:${line} hard-codes a colour (\`${match[0]}\`) — use an Obsidian CSS variable (e.g. var(--text-normal)) instead, so a themed vault stays themed.`,
		);
	});
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
