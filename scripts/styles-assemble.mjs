import { readFileSync, readdirSync } from 'node:fs';
import { transform } from 'lightningcss';

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
// Three earlier approaches to this check — a per-line regex, then a brace-depth counter,
// then a quote/paren-aware declaration walk — were each defeated by CSS content that
// looks like syntax: an at-rule-nested selector, a quoted `}`, a `/*` inside a string
// bridging to a real comment elsewhere, an unterminated string, a colour function the
// word-list hadn't named, an escaped `)` inside `url()`. Every one of those is a class of
// mistake a REAL CSS parser does not make, so this check is no longer hand-rolled lexing:
// it runs `lightningcss` — already a devDependency, already imported by
// `scripts/vite-assembled-styles.mjs` to minify this very stylesheet — and inspects the
// same parsed structure Vite's own build does. Comments, strings and escapes are handled
// by a conformant tokenizer before this code ever sees a declaration; there is no text
// left to be fooled by.
//
// What this SEES: every literal colour value lightningcss's own parser resolves into a
// `CssColor` node — hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hwb()`, `lab()`, `lch()`,
// `oklab()`, `oklch()`, `color()`, a literal-only `color-mix()` (lightningcss computes
// the blended result, which is itself a `CssColor`), and `light-dark()` — found by
// walking each declaration's parsed VALUE recursively, at any nesting depth (a gradient
// colour-stop, a `var()` fallback, an otherwise-unresolved function's own arguments — see
// `color-contrast()` in the test file for that last one). Because detection reads the
// PARSED tree rather than source text, it is correct regardless of what a selector, an
// at-rule prelude, a comment or a quoted string contains: those are never declaration
// VALUES, so they are never visited, by construction — not by a rule that excludes them.
//
// A caveat every earlier round of this check carried and had to repeat is gone, not
// narrowed: CSS NAMED colours (`red`, `rebeccapurple`, …) ARE now caught. `red` and
// `#ff0000` parse to the identical `CssColor` node — lightningcss does not keep the
// keyword spelling any more than it keeps a hex literal's — so the ambiguity that made a
// bare word unsafe to flag under a source-text scan (indistinguishable from a class name
// or a custom-property name) does not exist here: `Declaration.value` only ever holds a
// `CssColor` node where the CSS value grammar put a literal colour, never a selector or a
// property name. See 'refuses a CSS named colour' in the test file.
//
// What this does NOT see, and why it is a deliberate, narrow line: `device-cmyk()` is the
// one CSS Color function lightningcss's parser (1.33) does not fold into a `CssColor`
// node — its four arguments are bare percentages, so nothing about a literal
// `device-cmyk(0% 81% 81% 30%)` is ever colour-SHAPED in the parsed tree, unlike every
// other named colour function this project checked by hand against this version of
// lightningcss (including an entirely unresolved one, `color-contrast()`, whose literal
// colour ARGUMENTS still surface as `CssColor` nodes). `UNRESOLVED_COLOR_FUNCTIONS` below
// is that one-function list, named by lightningcss's own function-call shape rather than
// inferred from source spelling — a future lightningcss version that resolves it removes
// the need for this list without this check changing behaviour.
//
// `currentColor` and a CSS system-colour keyword (`Canvas`, `ButtonText`, …) both adapt
// to the viewer's theme or OS colour scheme rather than encoding a fixed palette value,
// so both are exempt — `currentcolor` by its own distinct `CssColor` type, and a system
// colour because it parses to a bare STRING, never the object shape this check matches,
// so it needs no exemption code at all. `transparent` earns the same exemption a
// different way: lightningcss does not keep the keyword spelling, it resolves to
// `rgb(0 0 0 / 0)` like any equivalent literal — so this check exempts alpha 0
// GENERALLY, on any colour type, since a colour with no opacity never paints a hue in any
// theme. `inherit` needs no exemption: it is not a colour value at all, so it is never a
// `CssColor` node to begin with.
//
// One narrowing that follows from using the real parser rather than source text: the
// LINE named in the error is the enclosing rule's own line, not necessarily the exact
// declaration's line within a multi-line rule. lightningcss's public visitor API gives a
// source location on a `Rule`, never on a `Declaration` — confirmed by inspecting what
// the visitor actually receives, not assumed from the type definitions alone — so that is
// the finest position this check can honestly report. A rule spanning many declarations
// still points at ONE line for all of them; the file and the fact of the violation are
// exact regardless.
const COLOR_TYPE_TAGS = new Set([
	'rgb',
	'hsl',
	'hwb',
	'lab',
	'lch',
	'oklab',
	'oklch',
	'srgb',
	'srgb-linear',
	'display-p3',
	'a98-rgb',
	'prophoto-rgb',
	'rec2020',
	'xyz-d50',
	'xyz-d65',
	'light-dark',
]);

const UNRESOLVED_COLOR_FUNCTIONS = new Set(['device-cmyk']);

function isPlainObject(value) {
	return typeof value === 'object' && value !== null;
}

// A literal colour lightningcss resolved into its own `CssColor` shape — anything whose
// `type` tag is in `COLOR_TYPE_TAGS` — EXCEPT one with alpha 0: see the header comment
// above for why full transparency is exempt regardless of which colour type carries it.
function isResolvedColor(node) {
	return isPlainObject(node) && COLOR_TYPE_TAGS.has(node.type) && node.alpha !== 0;
}

// The one function lightningcss's parser leaves unresolved that this project still needs
// to name explicitly — see the header comment above `COLOR_TYPE_TAGS`.
function isUnresolvedColorFunctionCall(node) {
	return (
		isPlainObject(node) &&
		node.type === 'function' &&
		isPlainObject(node.value) &&
		typeof node.value.name === 'string' &&
		UNRESOLVED_COLOR_FUNCTIONS.has(node.value.name.toLowerCase())
	);
}

/**
 * Walks a declaration's already-PARSED value — plain objects and arrays, the shape
 * `JSON.parse(JSON.stringify(...))` would give it — for the first node that is a literal
 * colour. Recurses into every field generically, by depth rather than by name, because a
 * `CssColor` node appears in genuinely different shapes depending on context: wrapped as
 * `{ type: 'color', value: CssColor }` inside a raw token stream (a custom property, an
 * unresolved function's arguments), or as a bare `CssColor` object assigned directly to a
 * named field of an already-typed value (`background`'s own `color`, a gradient
 * colour-stop's `color`, `border`'s `color`). A name-based walk would have to enumerate
 * both shapes at every property this project might ever use; a depth-based one does not
 * need to know either exists.
 *
 * @returns {object | null} the offending node, or null if `value` holds no literal colour
 */
function findHardcodedColor(value) {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findHardcodedColor(item);
			if (found) return found;
		}
		return null;
	}
	if (!isPlainObject(value)) return null;
	if (isResolvedColor(value) || isUnresolvedColorFunctionCall(value)) return value;
	for (const key of Object.keys(value)) {
		const found = findHardcodedColor(value[key]);
		if (found) return found;
	}
	return null;
}

// A short, human-readable label for the offending node — not a reconstruction of the
// original source spelling, which the parser has already normalised away (`#fff` and
// `rgb(255, 255, 255)` resolve to the identical `CssColor` node), so the message names
// what lightningcss found rather than claiming to quote what the partial wrote.
function describeColor(node) {
	if (node.type === 'function') return `${node.value.name}(…)`;
	// The common case — hex, rgb()/rgba(), a named colour, hwb() — all resolve to this
	// one shape, so it earns real CSS syntax rather than a field dump.
	if (node.type === 'rgb') {
		return node.alpha === 1 ? `rgb(${node.r}, ${node.g}, ${node.b})` : `rgba(${node.r}, ${node.g}, ${node.b}, ${node.alpha})`;
	}
	const components = Object.entries(node)
		.filter(([key]) => key !== 'type')
		.map(([key, value]) => `${key}: ${value}`)
		.join(', ');
	return `${node.type}(${components})`;
}

// A partial with a hard-coded colour fails the build LOUDLY, naming the file and the
// line — the one failure mode a shipped, themed-looking stylesheet cannot report for
// itself the way a broken import can. A partial lightningcss cannot PARSE at all fails
// just as loudly, with whatever position lightningcss itself reports: silently ignoring
// a parse error would be a worse failure than either.
function checkForHardcodedColors(name, body) {
	let ruleLine = null;
	let violation = null;

	try {
		transform({
			filename: name,
			code: Buffer.from(body),
			visitor: {
				Rule: {
					style(rule) {
						// 0-indexed in lightningcss's own AST; every message elsewhere in this
						// file, and every editor, counts from 1.
						ruleLine = rule.value.loc.line + 1;
					},
				},
				Declaration(declaration) {
					if (violation) return;
					const found = findHardcodedColor(declaration.value);
					if (found) violation = { found, line: ruleLine };
				},
			},
		});
	} catch (error) {
		const at = error.loc ? ` (line ${error.loc.line}, column ${error.loc.column})` : '';
		throw new Error(`styles/${name} could not be parsed as CSS${at}: ${error.message}`, { cause: error });
	}

	if (!violation) return;
	throw new Error(
		`styles/${name}:${violation.line} hard-codes a colour (\`${describeColor(violation.found)}\`) — use an Obsidian CSS variable (e.g. var(--text-normal)) instead, so a themed vault stays themed.`,
	);
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
