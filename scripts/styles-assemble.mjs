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
// the blended result, which is itself a `CssColor`) — found by walking each
// declaration's parsed VALUE recursively, at any nesting depth (a gradient colour-stop, a
// `var()` fallback, an otherwise-unresolved function's own arguments — see
// `color-contrast()` in the test file for that last one). Because detection reads the
// PARSED tree rather than source text, it is correct regardless of what a selector, an
// at-rule prelude, a comment or a quoted string contains: those are never declaration
// VALUES, so they are never visited, by construction — not by a rule that excludes them.
//
// `light-dark()` is a CONTAINER, not a colour itself: `light-dark(var(--a), var(--b))` —
// the theme-correct pattern this check must not punish — has no literal colour in it at
// all, and `light-dark(var(--a), #000)` has exactly one. So `light-dark` is deliberately
// NOT in `COLOR_TYPE_TAGS`: its own node (however lightningcss happens to shape it — a
// bare `{type:'light-dark', light, dark}` when both sides are literal, or a `light`/`dark`
// pair of raw token arrays wrapped in `{type:'unresolved-color', ...}` when at least one
// side is not) is never itself a match, and the SAME recursive walk that finds a colour
// anywhere else finds one inside `light`/`dark` too, judging each side independently.
//
// A caveat every earlier round of this check carried and had to repeat is gone, not
// narrowed, for a TYPED property (`color:`, `background:`, any property lightningcss's
// grammar fully parses): CSS NAMED colours (`red`, `rebeccapurple`, …) ARE now caught
// there. `red` and `#ff0000` parse to the identical `CssColor` node on a typed property —
// lightningcss does not keep the keyword spelling any more than it keeps a hex literal's
// — so the ambiguity that made a bare word unsafe to flag under a source-text scan
// (indistinguishable from a class name) does not exist there. See 'refuses a CSS named
// colour' in the test file. That symmetry does NOT reach a RAW token stream — a custom
// property's own value (`--accent: red;`), or a `var()`/unresolved-function fallback or
// argument — where lightningcss leaves anything it does not recognise as a sequence of
// raw tokens instead of parsing it: a hex or `rgb()`-shaped LITERAL is still recognised
// generically even there (`--accent: #fff;` IS caught — confirmed in the test file), but
// a bare colour WORD in that context is just an `ident` token, indistinguishable from any
// other identifier, and stays uncaught (`--accent: red;` passes — also pinned as a test,
// documenting the asymmetry rather than hiding it). This project has decided not to chase
// that gap: a bare word is still not self-marking outside a typed property, the same
// reasoning as before, now scoped to where it is actually true rather than claimed
// everywhere.
//
// lightningcss's AUTOMATIC resolution into `CssColor` does not cover every named colour
// function, and where it does not, this check compensates by NAME rather than by shape —
// it still refuses the value, just via a second mechanism, not a blind spot. Confirmed by
// hand against every named colour function in the CSS Color spec: `device-cmyk()` is the
// one whose four arguments are bare percentages, never colour-SHAPED in the parsed tree
// (unlike an entirely unresolved function like `color-contrast()`, whose literal colour
// ARGUMENTS still surface as `CssColor` nodes generically). `UNRESOLVED_COLOR_FUNCTIONS`
// below is that one-function list, named by lightningcss's own function-call shape rather
// than inferred from source spelling — a future lightningcss version that resolves it
// removes the need for this list without this check's behaviour changing. Because a
// `device-cmyk()` call is never parsed into a typed colour, it also never gets the `var()`
// and zero-alpha exemptions every OTHER colour type gets automatically (a resolved
// `CssColor` simply isn't produced when an argument is a variable, and alpha 0 is read off
// the parsed node) — so `isUnresolvedColorFunctionCall` below reads its raw, unparsed
// argument tokens by hand for the same two cases: `device-cmyk(var(--c) var(--m) var(--y)
// var(--k))` holds a `{type:'var',...}` node among its arguments and is exempt for the
// same reason `rgb(var(--r), var(--g), var(--b))` already was (a value lightningcss cannot
// resolve to a literal is not a hard-coded palette entry); `device-cmyk(0% 81% 81% 30% /
// 0)` has a literal `0` as the token immediately after its `/` separator and is exempt for
// the same reason `rgba(0, 0, 0, 0)` already was. Neither exemption is new policy — both
// are the SAME two rules every other colour type gets, applied by hand because this one
// function's arguments never reach the shape where the generic rules already apply.
//
// This check runs on EVERY rule kind lightningcss's visitor calls `Rule()` for, not a
// hand-picked subset — the earlier version named `font-face` and `property` explicitly
// because a review found their declarations never fire the `Declaration` visitor
// (`properties`/`initialValue` are named fields on the RULE object, not a generic
// declaration list), and doing the same for exactly those two rule TYPES is what let a
// sibling case slip past: `@font-palette-values` structures its contents the same
// undeclared way (confirmed by inspecting the parsed tree, not guessed) and was not on the
// list, and `@unknown-thing { .a { color: #fff; } }` — any at-rule lightningcss does not
// specifically model at all — parses generically as rule type `unknown`, with its whole
// block turned into a raw, still colour-annotated token stream, and that was not on the
// list either. Listing rule TYPES is listing places; the next at-rule lightningcss adds
// support for tomorrow, or one it never models at all, is the next name this list would
// have missed. So `checkForHardcodedColors` below does not special-case any rule type: it
// runs the same recursive colour walk over EVERY rule's own `rule.value` — which, checked
// by hand, already holds that rule's own content directly, for `style`, `font-face`,
// `property`, `font-palette-values`, `keyframes`, `page` and `unknown` alike — with one
// field, `rules`, walked element-by-element rather than blindly (see `NESTED_RULES_KEY`
// below): the SAME field name means genuinely different things on different rule kinds —
// a container's nested rules versus `@page`'s margin boxes — so closing the class means
// judging each element's own shape, not the field's name, which is what a place-list
// (naming rule TYPES, or naming FIELD names) can never do for a case not yet found.
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
// One narrowing that follows from using the real parser rather than source text: the LINE
// named in the error is the enclosing RULE's own line, always — never a declaration's own
// line within a multi-line rule — because this check reads a source position only off
// `rule.value.loc`, which every rule kind checked by hand carries (`style`, `keyframes`,
// `page`, `font-face`, `property`, `font-palette-values`, `unknown`), and lightningcss's
// visitor never hands a `Declaration` callback a position of its own. A `@keyframes` block
// reports its OWN line for a colour in any of its keyframe selectors (`from`/`to`/a
// percentage), not the individual selector's line, because lightningcss's visitor fires
// once for the whole `@keyframes` rule rather than once per keyframe — coarser than a
// single style rule, but still a real, useful line, never the unnamed failure a missing
// position would be. A colour nested inside a CONTAINER at-rule (`@media`, `@supports`,
// `@layer`, `@container`, or nested CSS itself) is the one case this does NOT report
// against the container's own line: each element of `rules`, the field holding each
// nested rule, is skipped from the walk exactly when it is itself a separately-visited
// Rule node (see `isSeparatelyVisitedRule`), so the container's own `Rule()` call finds
// nothing there and the NESTED rule's own, more precise `Rule()` call is what reports it
// instead. `@page`'s margin boxes share the field name but not that shape, and so are
// walked here rather than skipped — see `NESTED_RULES_KEY` for why.
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
]);

const UNRESOLVED_COLOR_FUNCTIONS = new Set(['device-cmyk']);

// The field lightningcss uses, on every CONTAINER rule kind checked by hand (`media`,
// `supports`, `layer-block`, `container`, and `style` itself for CSS nesting), to hold its
// nested child rules. `checkForHardcodedColors` walks a rule's own `rule.value` for a
// colour, and must not re-walk a child the visitor already calls `Rule()` on separately —
// that would re-report the same colour against the container's coarser line first.
//
// The field name alone does NOT decide this, and treating it as if it did is the exact
// regression this comment now documents: `@page` also carries a field named `rules` — its
// margin boxes (`@top-center`, `@top-left`, …) — but a margin box is not a nested Rule at
// all. Confirmed by inspecting the parsed tree by hand: a container's `rules` array holds
// full `{ type, value }` Rule nodes, the identical shape the visitor's own `Rule()`
// callback receives (so the visitor DOES fire for each one, separately, which is what
// makes re-walking it here redundant); `@page`'s `rules` array holds `{ marginBox,
// declarations, loc }` objects with no `type` field at all, because the visitor has no
// separate callback for a margin box — it never fires one. A version of this check that
// excluded the whole `rules` FIELD, rather than judging each element's own shape, silently
// dropped every margin-box declaration from the scan: `@page { @top-center { color: #fff;
// } }` passed when it should have refused. So `rules` is not a key this walk skips; it is
// a key whose ARRAY ELEMENTS are inspected one at a time by `isSeparatelyVisitedRule`
// below, and only an element actually shaped like a Rule the visitor dispatches to on its
// own is skipped — anything else under that name (a page's margin box) is walked as
// ordinary data, the same as any other field. That is what makes this a class fix rather
// than trading one place-list (`font-palette-values`, `unknown`) for another (`page`).
const NESTED_RULES_KEY = 'rules';

// Whether `node` is itself the shape lightningcss's visitor calls `Rule()` for separately:
// every Rule variant is `{ type: string, value: ... }`. Used only while walking a `rules`
// array (see `NESTED_RULES_KEY` above) to decide, element by element, whether THIS entry
// is a nested rule the visitor already visits on its own (skip it here) or something else
// entirely that happens to share the field name `rules` with a container (walk it, since
// nothing else in the visitor ever will).
function isSeparatelyVisitedRule(node) {
	return isPlainObject(node) && typeof node.type === 'string' && 'value' in node;
}

function isPlainObject(value) {
	return typeof value === 'object' && value !== null;
}

// A literal colour lightningcss resolved into its own `CssColor` shape — anything whose
// `type` tag is in `COLOR_TYPE_TAGS` — EXCEPT one with alpha 0: see the header comment
// above for why full transparency is exempt regardless of which colour type carries it.
function isResolvedColor(node) {
	return isPlainObject(node) && COLOR_TYPE_TAGS.has(node.type) && node.alpha !== 0;
}

// Whether `arguments` (an unresolved function's raw, unparsed token list) contains a
// `var()` reference anywhere — recursing the same way `findHardcodedColor` does, since a
// variable can appear nested inside another function among the arguments. A function call
// that references a variable is not a literal palette value, the same reasoning that
// already lets `rgb(var(--r), var(--g), var(--b))` pass without any special case, because
// it never resolves to a typed `CssColor` at all. `device-cmyk()` needs this spelled out
// by hand because it never resolves either, for a different reason (see the header
// comment), so it never gets the exemption automatically.
function containsVarReference(value) {
	if (Array.isArray(value)) return value.some((item) => containsVarReference(item));
	if (!isPlainObject(value)) return false;
	if (value.type === 'var') return true;
	return Object.keys(value).some((key) => containsVarReference(value[key]));
}

// Whether `arguments` (an unresolved function's raw token list) spells a literal `0` as
// the alpha component — the token immediately after a `/` separator, ignoring whitespace
// tokens. The same full-transparency exemption `isResolvedColor` gives every resolved
// colour type, applied by hand here because `device-cmyk()`'s arguments never resolve
// into the typed `CssColor` shape that check reads `alpha` off of.
function hasZeroAlphaArgument(args) {
	const slashAt = args.findIndex((arg) => arg.type === 'token' && arg.value?.type === 'delim' && arg.value.value === '/');
	if (slashAt === -1) return false;
	const alpha = args.slice(slashAt + 1).find((arg) => !(arg.type === 'token' && arg.value?.type === 'white-space'));
	return Boolean(alpha) && alpha.type === 'token' && (alpha.value.type === 'number' || alpha.value.type === 'percentage') && alpha.value.value === 0;
}

// A call to one of `UNRESOLVED_COLOR_FUNCTIONS` — named by lightningcss's own function-
// call shape, not inferred from source spelling — EXCEPT one whose arguments hold a
// `var()` reference or a literal zero alpha: see the two helpers above for why those two
// cases need reading by hand for this function and not for any other colour type.
function isUnresolvedColorFunctionCall(node) {
	if (
		!isPlainObject(node) ||
		node.type !== 'function' ||
		!isPlainObject(node.value) ||
		typeof node.value.name !== 'string' ||
		!UNRESOLVED_COLOR_FUNCTIONS.has(node.value.name.toLowerCase())
	) {
		return false;
	}
	const args = node.value.arguments;
	if (containsVarReference(args)) return false;
	if (hasZeroAlphaArgument(args)) return false;
	return true;
}

/**
 * Walks a rule's own already-PARSED value — plain objects and arrays, the shape
 * `JSON.parse(JSON.stringify(...))` would give it — for the first node that is a literal
 * colour. Recurses into every field generically, by depth rather than by name, because a
 * `CssColor` node appears in genuinely different shapes depending on context: wrapped as
 * `{ type: 'color', value: CssColor }` inside a raw token stream (a custom property, an
 * unresolved function's arguments), or as a bare `CssColor` object assigned directly to a
 * named field of an already-typed value (`background`'s own `color`, a gradient
 * colour-stop's `color`, `@property`'s own `initialValue`). A name-based walk would have
 * to enumerate every such shape at every property or descriptor this project might ever
 * use; a depth-based one does not need to know any of them exist. `light-dark`'s
 * `light`/`dark` fields are reached the same way — no special case, since the walk
 * already recurses into every field.
 *
 * A `rules` field (see `NESTED_RULES_KEY`) is handled specially, not skipped outright: each
 * of its array elements is judged on its own shape by `isSeparatelyVisitedRule` — an
 * element the visitor already calls `Rule()` on separately is skipped here (its own,
 * more precise call reports it), while anything else under that name (a `@page` margin
 * box) is walked exactly like any other field.
 *
 * @returns {object | null} the offending node, or null if `value` holds no literal colour
 */
// The `rules`-array half of `findHardcodedColor`, split out so neither function carries
// both kinds of branching (generic recursion, plus the per-element judgment call this one
// field needs) at once. An element the visitor already calls `Rule()` on separately is
// skipped — its own, more precise call reports it; anything else under that name (a
// `@page` margin box) is walked exactly like any other field.
function findHardcodedColorInNestedRules(rules) {
	for (const item of rules) {
		if (isSeparatelyVisitedRule(item)) continue;
		const found = findHardcodedColor(item);
		if (found) return found;
	}
	return null;
}

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
		const found =
			key === NESTED_RULES_KEY && Array.isArray(value[key])
				? findHardcodedColorInNestedRules(value[key])
				: findHardcodedColor(value[key]);
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
	let violation = null;

	try {
		transform({
			filename: name,
			code: Buffer.from(body),
			visitor: {
				// Generic, not `{ style(rule) {...} }` or a per-type allowlist: every rule
				// kind's own `rule.value` is walked directly, minus `rules` (see
				// `NESTED_RULES_KEY`), which is what makes this the class fix rather than a
				// list of the at-rule types a first pass happened to test. Short-circuits once
				// a violation is found — the first one in document order is enough to fail the
				// build, and a later rule need not be walked at all.
				Rule(rule) {
					if (violation) return;
					const found = findHardcodedColor(rule.value);
					// 0-indexed in lightningcss's own AST; every message elsewhere in this
					// file, and every editor, counts from 1.
					if (found) violation = { found, line: rule.value.loc.line + 1 };
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
