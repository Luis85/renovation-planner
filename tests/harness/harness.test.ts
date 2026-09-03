/**
 * @vitest-environment jsdom
 *
 * The check that keeps the harness alive. `npm run harness` is deliberately outside
 * `npm run check` — it draws and asserts nothing — so without this the page rots
 * silently: the bundle still builds, and the mount throws in a browser nobody opened.
 *
 * It asserts the FRAME and the plumbing, never appearance. Appearance is a live vault's
 * answer.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse as parseSfc, compileTemplate } from '@vue/compiler-sfc';
import { transform } from 'lightningcss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountHarness } from '../harness/mount';
import { mountPlanEditorHarness } from '../harness/planEditor';
import { mountAssetDesignerHarness } from '../harness/assetDesigner';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { installEditorEnvironment, settle as flushAsync } from '../helpers/editor';
import { applyWantedScheme, drawSchemeToggle } from '../harness/theme';
import { isPlantedProbe } from '../helpers/plantedProbe';
import { MAX_GLOB_BRANCHES, expandGlobBranches, resolvesOutsideRoots } from '../helpers/globBranches';

/**
 * The parser needs the DIALECT, not just the text. `ScriptKind.TS` parses `<div>` in a `.tsx`
 * file as a type assertion and then an unterminated regular expression, so a dynamic
 * `import('./theme.css')` inside JSX never becomes a `CallExpression` and the walk reports a
 * clean tree — the silent-pass failure again, one layer inside the fix for it.
 *
 * **Unreachable today and admitted anyway**: there are no `.tsx` or `.jsx` files in the walked
 * tree, but `MODULE` below lists both, so the first one written would go unscanned with nothing
 * to say so. A gate that stops working when a permitted file type appears is worse than one that
 * never permitted it.
 */
const KIND_BY_EXTENSION: ReadonlyMap<string, ts.ScriptKind> = new Map([
	['.tsx', ts.ScriptKind.TSX],
	['.jsx', ts.ScriptKind.JSX],
	['.js', ts.ScriptKind.JS],
	['.mjs', ts.ScriptKind.JS],
	['.cjs', ts.ScriptKind.JS],
]);

/** An SFC block states its own dialect; `lang` absent means TS here, as `<script setup>` does. */
const KIND_BY_LANG: ReadonlyMap<string, ts.ScriptKind> = new Map([
	['tsx', ts.ScriptKind.TSX],
	['jsx', ts.ScriptKind.JSX],
	['js', ts.ScriptKind.JS],
]);

interface Script {
	readonly content: string;
	readonly kind: ts.ScriptKind;
}

interface StyleBlock {
	readonly content: string;
	readonly src: string | undefined;
}

interface Blocks {
	readonly styles: readonly StyleBlock[];
	readonly scripts: readonly Script[];
	/**
	 * Every block that names its content in a `src` instead of holding it — `<template src>` and
	 * `<script src>` alike. The descriptor's `content` is EMPTY for one of these, so compiling or
	 * parsing it scans nothing, and the file it names is not walked: `.html` is not in `MODULE`,
	 * and a `.ts` helper outside the three roots is outside the sweep. So both absence checks
	 * passed over a file Vite loads — an `import('./theme.css')` in a handler, a
	 * `<link rel="stylesheet">` in an external template, a stylesheet imported by an external
	 * script.
	 *
	 * **ONE key rather than one per block type, because this arrived as three separate rounds of
	 * the same finding.** `<style src>` was answered first (it counts as an importer outright — a
	 * style block's `src` genuinely IS a stylesheet), `<template src>` second, and `<script src>`
	 * was reported after both, against a function that handles all three block kinds side by
	 * side. Fixing the reported door twice and never asking what the third one did is the partial
	 * fix this repository has a name for, so the question is now asked of BLOCKS rather than of
	 * the block somebody reported.
	 *
	 * Reported under its own name rather than folded into `importers`: an external block does not
	 * itself load a stylesheet, it is a file this scan cannot read, and saying "loads a
	 * stylesheet" about it would send the next reader hunting an import that is not there.
	 */
	readonly external: readonly string[];
}

/**
 * Both halves of one SFC parse. They were two functions, each calling `parseSfc` on the same
 * text and throwing half the descriptor away.
 *
 * **Merged for clarity, and explicitly NOT as the fix for the timeout below** — a claim this
 * docblock made for one commit and could not defend. A cold pass of `parseSfc` over the 52
 * prototypes costs 122ms and a WARM one costs 1.1ms, so the duplicate was buying back about a
 * millisecond of a 760ms scan, not the 122ms first measured: the number was real and it was a
 * fact about JIT warm-up, not about the second call. One parse answering both questions is
 * worth having on its own terms; it is not worth reporting as a saving.
 *
 * A TEMPLATE is executable too, and that is not a technicality: Vue compiles
 * `@click="import('./theme.css')"` into render code containing a live
 * `onClick: $event => (import('./theme.css'))` — measured, not assumed — so a template-only SFC
 * with no script block at all can load a stylesheet when the handler runs. The runtime check
 * elsewhere in this file mounts entries and never clicks anything, so nothing else would see it.
 *
 * Compiled with the real template compiler and then scanned with the real TS parser, which is
 * the same move this file has now made three times. The generated code is plain JS, so it is
 * handed the JS script kind rather than the SFC's own `lang`.
 */
const blocksOf = (file: string, text: string): Blocks => {
	if (!file.endsWith('.vue')) {
		return {
			styles: [],
			scripts: [
				{ content: text, kind: KIND_BY_EXTENSION.get(path.extname(file)) ?? ts.ScriptKind.TS },
			],
			external: [],
		};
	}
	const { descriptor } = parseSfc(text, { filename: file });
	const scriptBlocks = [descriptor.script, descriptor.scriptSetup].filter(
		(block): block is NonNullable<typeof block> => block !== null,
	);
	const scripts: Script[] = scriptBlocks.map((block) => ({
		content: block.content,
		kind: KIND_BY_LANG.get(block.lang ?? '') ?? ts.ScriptKind.TS,
	}));
	if (descriptor.template !== null) {
		const rendered = compileTemplate({
			id: file,
			filename: file,
			source: descriptor.template.content,
		});
		scripts.push({ content: rendered.code, kind: ts.ScriptKind.JS });
	}
	return {
		styles: descriptor.styles.map((block) => ({ content: block.content, src: block.src })),
		scripts,
		external: [descriptor.template?.src, ...scriptBlocks.map((block) => block.src)].filter(
			(src): src is string => src !== undefined,
		),
	};
};

/**
 * `./theme.css?variant` and `./theme.css#x` are CSS requests to Vite, and a bare
 * `.endsWith('.css')` says no to both. The QUERY and HASH are stripped before the suffix is
 * tested — Vite splits a specifier at the first `?`, and `#` after that.
 *
 * Note what this does NOT do: `?raw` and `?url` make Vite return a string rather than load a
 * sheet, so treating them as stylesheet imports would be a false positive. They are not carved
 * out, deliberately — this guard's whole job is that a stylesheet must be UNREACHABLE, and a
 * `?raw` import of a stylesheet in a harness module is worth a red test and a sentence in
 * review either way. Over-refusing costs an argument; under-refusing is the silent pass this
 * file has now paid for eleven times.
 */
const isStylesheetSpecifier = (specifier: string): boolean =>
	specifier.split('?')[0]?.split('#')[0]?.endsWith('.css') === true;

const namesStylesheet = (node: ts.Node): boolean => {
	if (ts.isStringLiteralLike(node)) return isStylesheetSpecifier(node.text);
	if (ts.isTemplateExpression(node)) {
		const last = node.templateSpans.at(-1);
		return last !== undefined && isStylesheetSpecifier(last.literal.text);
	}
	return false;
};

/**
 * The characters an ordinary filename tail is made of. An ALLOW-list, not a list of glob
 * metacharacters, and that is the whole point of it — see `literalTailOf`.
 */
const LITERAL_TAIL = /[A-Za-z0-9._/-]*$/;

/**
 * The pattern's trailing run of ordinary filename characters — the part that is the same in
 * every path the glob can match, so the only part that can pin a match's extension.
 *
 * **Written as an allow-list because the deny-list version was a treadmill, and it shipped
 * one round of that treadmill first.** The first version carried an alphabet of glob
 * metacharacters (`*?{}[]`) and was immediately reported for extglobs: `./themes/*.@(css|js)`
 * matches `themes/theme.css`, and against that alphabet the tail reads as the fixed string
 * `.@(css|js)`, which does not end in `.css` — so the pattern was declared PROVEN CSS-FREE and
 * the sheet stayed reachable with the case green. Measured before fixing, not reasoned about.
 *
 * Adding `(` and `)` would have closed the report and left the class open, which is exactly
 * what this file's own regex history did nine times: each round named one more lexical
 * construct and every intermediate version failed silently. So the question is inverted. A tail
 * is literal only while every character in it is one a plain filename is made of; ANY other
 * punctuation ends it, whether or not this author knew what that punctuation meant. Extglobs,
 * braces, classes, POSIX classes and whatever picomatch grows next are all covered by not being
 * letters.
 *
 * Deliberately conservative in the one direction that is safe: an unrecognised character
 * shortens the tail, which can only move a pattern from "proven CSS-free" to "counts". This
 * check's whole job is that a stylesheet must be UNREACHABLE, and over-refusing costs an
 * argument while under-refusing is the silent pass.
 */
const literalTailOf = (pattern: string): string =>
	(LITERAL_TAIL.exec(pattern)?.[0] ?? '').toLowerCase();

/**
 * A glob names a SET, and whether that set holds a stylesheet is a fact about the files on disk
 * rather than about the pattern's last four characters. `import.meta.glob('./themes/*')` loads
 * `themes/theme.css` when a loader runs, and a plain `.endsWith('.css')` says no to it because
 * the text ends in `*`. Reported against a scan that tested a pattern as if it were a specifier
 * — the mistake this file keeps making in new places: asking of the TEXT a question only
 * answerable about what it RESOLVES to.
 *
 * Resolving the glob against the tree was the reported remedy and is deliberately not what this
 * does: that buys a glob engine plus an answer that moves with the files present at scan time,
 * to decide a question this file already has a standing preference about. The pattern is asked
 * whether it can be PROVEN CSS-free instead — only a literal tail pins a match's extension — and
 * anything unproven counts.
 */
const mayMatchStylesheet = (pattern: string): boolean => {
	const tail = literalTailOf(pattern);
	return !tail.includes('.') || tail.endsWith('.css');
};

/**
 * `import.meta.glob(['./a/*.css', '!./a/skip.css'])` — Vite's multi-pattern form.
 *
 * A pattern Vite cannot resolve statically — a template carrying a substitution — reaches
 * `isStringLiteralLike` as false and counts as nothing, which is right rather than a gap: Vite
 * REFUSES a non-literal glob pattern outright, so it loads no module at all. A backtick pattern
 * with no substitution is a literal and is covered.
 *
 * **A `!` pattern is DROPPED rather than APPLIED, and that is a false positive kept on
 * purpose.** A negative excludes, so it names nothing that gets loaded and must not count as an
 * import — but neither is it subtracted from the positives beside it. Reported:
 * `['./themes/*', '!./themes/*.css']` loads no stylesheet, because the exclusion removes every
 * CSS match, and this counts the broad positive and reports the module. The report is right and
 * the behaviour stays.
 *
 * Two reasons, and the second decides it. Applying an exclusion means deciding whether the
 * negatives remove EVERY css match of a positive, which is set subtraction over globs:
 * `!./themes/*.css` subsumes and `!./themes/a.css` does not, and telling those apart is the glob
 * matcher this check has now declined twice — for an answer that would then move with the files
 * on disk. And the failure lands in the safe direction: over-refusing costs a red test and a
 * sentence in review, where under-refusing is the silent pass this file has paid for eleven
 * times, and twice more on this glob path since.
 *
 * It costs nothing today — no pattern in the tree is negated at all. A build that needs one can
 * split the glob or state the exclusion in the pattern's own tail.
 */
const globNamesStylesheet = (node: ts.Node): boolean =>
	(ts.isArrayLiteralExpression(node) ? [...node.elements] : [node]).some(
		(element) =>
			ts.isStringLiteralLike(element)
			&& !element.text.startsWith('!')
			&& mayMatchStylesheet(element.text),
	);

/** Every `@import` URL one stylesheet declares, per the account on `importsIn` below. */
const importUrlsOf = (filename: string, code: Buffer): string[] => {
	const found: string[] = [];
	transform({
		filename,
		code,
		minify: false,
		errorRecovery: true,
		visitor: { Rule: { import: (rule) => (found.push(rule.value.url), []) } },
	});
	return found;
};

/**
 * An SFC `<style>` block can pull a stylesheet too — `@import './theme.css'` — and Vite loads it.
 * Prototypes are PERMITTED a `<style scoped>` block, and the style-block check further down
 * rejects blocks only under `tests/harness`, so a prototype was the one place this could hide.
 *
 * Asked of the CSS PARSER for the reason the JS side is, and through the extractor this file
 * ALREADY had. I wrote a second one first — reprint the sheet and match `^@import` — and lint
 * caught the duplicate import before the duplication itself did. `importsIn` was three
 * definitions away, and it carries an `errorRecovery: true` my version did not: the vendored
 * `obsidian.css` contains a literal `*\/` inside preserved upstream prose, which closes a
 * comment in any conformant parser, so a stricter extractor throws on it. **Reuse was not
 * tidiness here — the copy would have been wrong on a real file in the tree.**
 *
 * **Two narrowings I added and then had to take back out, both reported in one round.** The
 * first version kept only `content`, and `<style scoped src="./theme.css">` puts the dependency
 * in `src` with the content EMPTY — measured, not assumed. The second filtered the parsed URLs
 * with `.endsWith('.css')`, which discards `@import './theme'` and
 * `@import url('https://…/theme')`; both load a stylesheet, and `importsIn` — the extractor this
 * one now shares — never filtered by extension at all.
 *
 * So ANY `@import` the CSS parser finds counts, and a `src` counts on its own. The rule this
 * keeps arriving at: **the parser has already decided the thing is an import; a suffix test
 * after it can only throw that answer away.** It is the JS side's `.css` check that is the
 * exception, and it is one because a module graph carries every kind of specifier while a
 * permitted style block carries only stylesheets.
 */
/**
 * Whether a CSS-MODULE block depends on another file — `composes: base from './theme.css'`, and
 * `@value brand from './theme.css'`, both of which Vite loads and neither of which the
 * `Rule.import` visitor can see, because both are DECLARATIONS rather than `@import` rules.
 *
 * **A REGRESSION the parser rewrite introduced, and the counter-example to its own argument.**
 * That rewrite replaced a source regex with real parsers on the grounds that a parser strictly
 * dominates a pattern. It does for the grammar it is asked about — and the regex caught both of
 * these by accident, matching `from './theme.css'` because that text happens to look like a JS
 * import. Measured both ways rather than argued. The honest form of the earlier claim is
 * narrower: a parser beats a pattern at the question you point it AT, and pointing it at a
 * different question than the pattern was accidentally answering loses coverage.
 *
 * The two forms need two instruments, which is the part that took a second round. `composes`
 * lands on `exports[…].composes` as `{ type: 'dependency', specifier }` once `cssModules` is on.
 * `@value` does NOT: measured, its exports are empty, `analyzeDependencies` answers null, and the
 * import visitor sees nothing — lightningcss parses the rule and deprecates it without ever
 * exposing what it points at. What it does emit is a `DeprecatedCssModulesValueRule` warning, so
 * the block can be proven to CONTAIN a value rule and never proven free of a dependency.
 *
 * So a value rule COUNTS, whether or not it names a file. `@value x: 10px` imports nothing and is
 * reported anyway — over-refusing, the direction this whole check takes, and free here because no
 * block in the tree uses one at all. Proving absence and counting everything else is the same
 * shape `mayMatchStylesheet` uses for globs.
 *
 * That warning type is a lightningcss API detail rather than a rule of CSS, so it is PINNED by
 * the case below driving a real `@value … from`: a renamed warning turns this silently permissive
 * otherwise, which is the `rule-custom-message` hazard this repository already records.
 */
const cssModuleDependsOnFile = (filename: string, css: string): boolean => {
	const { exports, warnings } = transform({
		filename,
		code: Buffer.from(css),
		minify: false,
		errorRecovery: true,
		cssModules: true,
	});
	const composes = Object.values(exports ?? {}).some((entry) =>
		entry.composes.some((reference) => reference.type === 'dependency'),
	);
	return composes || warnings.some((w) => w.type === 'DeprecatedCssModulesValueRule');
};

const styleImportsStylesheet = (file: string, block: StyleBlock): boolean =>
	block.src !== undefined
	|| importUrlsOf(file, Buffer.from(block.content)).length > 0
	|| cssModuleDependsOnFile(file, block.content);

/**
 * A relative specifier, and whether it is a GLOB PATTERN or a module path.
 *
 * The two cannot be treated alike and the first version treated them alike: it truncated every
 * specifier at the first glob metacharacter, so an ordinary import whose path merely CONTAINS
 * one — `'../(route)/../../scripts/helper.ts'`, and a parenthesised segment is an everyday
 * routing convention — was cut down to `'../'`, resolved to `src/`, and reported as staying
 * inside the roots. Measured: the real target is `scripts/helper.ts`, outside them, and the
 * absence assertion passed. Truncation is only ever right for a pattern, where the literal
 * prefix is the directory the matches come out of.
 */
interface Specifier {
	readonly text: string;
	readonly isGlob: boolean;
}

interface ScriptScan {
	/** Does this script load a stylesheet? */
	readonly stylesheet: boolean;
	/** Every RELATIVE specifier it names, glob patterns included — see `escapesTheRoots`. */
	readonly relative: readonly Specifier[];
}

/**
 * The JS half of the question below, so that `importsStylesheet` reads as the pair it is — and
 * the specifier list the closure check needs, gathered on the same walk rather than by parsing
 * every module a second time.
 */
const scanScript = (file: string, script: Script): ScriptScan => {
	const source = ts.createSourceFile(
		file,
		script.content,
		ts.ScriptTarget.Latest,
		false,
		script.kind,
	);
	let found = false;
	const relative: Specifier[] = [];
	// Every literal specifier the node carries, so one walk answers both questions. An array
	// element is a glob's own multi-pattern form; a `!` prefix is an EXCLUSION and names no
	// module, so it is dropped here exactly as it is in `globNamesStylesheet`.
	const collect = (node: ts.Node, isGlob: boolean): void => {
		const elements = ts.isArrayLiteralExpression(node) ? [...node.elements] : [node];
		for (const element of elements) {
			// A TEMPLATE with substitutions is a real specifier to Vite — `import(`../../scripts/
			// ${name}.ts`)` is its variable dynamic-import form and it expands to real modules — so
			// dropping it here let a helper outside the roots go neither scanned nor reported.
			// Its `head` is the text before the first `${…}`, which is the part every expansion
			// shares, so it is exactly the prefix this question needs and needs no truncation:
			// it is already literal. Not marked `isGlob` for that reason.
			//
			// This guard mirrored `globNamesStylesheet`'s and inherited a decision that was right
			// THERE and wrong here. That predicate asks whether a specifier ENDS in `.css`, which a
			// template with a trailing substitution genuinely cannot answer; this one asks where a
			// specifier BEGINS, which a template answers perfectly. `namesStylesheet` already
			// reads template spans for the first question — so the file handled templates for one
			// question and not the other, one function apart.
			if (ts.isTemplateExpression(element)) {
				if (element.head.text.startsWith('.')) {
					relative.push({ text: element.head.text, isGlob: false });
				}
				continue;
			}
			if (!ts.isStringLiteralLike(element)) continue;
			if (element.text.startsWith('.')) relative.push({ text: element.text, isGlob });
		}
	};
	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier !== undefined
		) {
			collect(node.moduleSpecifier, false);
			if (namesStylesheet(node.moduleSpecifier)) found = true;
		}
		if (ts.isCallExpression(node) && node.arguments[0] !== undefined) {
			const callee = node.expression;
			// `import('…')` — the callee IS the keyword, not an identifier.
			const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
			// `import.meta.glob('./themes/*.css')` — Vite turns each match into a dynamic
			// import, so a glob naming stylesheets loads them. The callee is a property
			// access ending in `glob` over an `import.meta` meta-property, which the
			// dynamic-import test above cannot see: its `.kind` is `PropertyAccessExpression`.
			// `entries.ts` already uses this primitive, so it is house vocabulary rather than
			// an exotic input — the walk simply could not see the one shape the harness itself
			// is built on.
			const isGlob =
				ts.isPropertyAccessExpression(callee)
				&& callee.name.text === 'glob'
				&& callee.expression.getText(source).startsWith('import.meta');
			// A glob PATTERN and a specifier are different questions, so they take different
			// predicates rather than one predicate that has to mean both.
			if (isGlob || isDynamicImport) collect(node.arguments[0], isGlob);
			const claimsStylesheet = isGlob
				? globNamesStylesheet(node.arguments[0])
				: isDynamicImport && namesStylesheet(node.arguments[0]);
			if (claimsStylesheet) found = true;
		}
		ts.forEachChild(node, visit);
	};
	ts.forEachChild(source, visit);
	return { stylesheet: found, relative };
};

/**
 * Does this module import a stylesheet? Asked of the TypeScript PARSER, not of a pattern.
 *
 * **Nine rounds of review each named one more lexical construct**, and every intermediate
 * version failed SILENTLY, because the assertion below is an absence — an under-reaching scan
 * reports a clean tree. The sequence, so the next author meets the shape rather than the
 * endpoint: a continuation alternative in the pattern; global continuation removal; `${[^}]*}`;
 * a balanced depth counter; mode tracking; mode tracking minus comment-stripping. Each was
 * correct about the case it was given and wrong about the class, and the ninth report — a brace
 * inside a comment inside a substitution — was the one that could not be closed without telling
 * a regex literal from division, which is the hard problem in hand-lexing JavaScript.
 *
 * So this stops hand-lexing. `ts.createSourceFile` handles comments, regex literals,
 * continuations, nested templates and substitutions because it is the real grammar, and the
 * check becomes a question about NODES: an import declaration, an `export … from`, or a dynamic
 * `import()` whose specifier ends in `.css`. A template ending in a substitution is correctly
 * NOT claimed — the extension is unknowable from source.
 *
 * **The `.vue` objection that deferred this twice is answered the same way**: with the real
 * parser rather than a second hand-rolled one. `@vue/compiler-sfc` hands back `script` and
 * `scriptSetup`; a template-only SFC yields neither and can import nothing.
 *
 * A regex over `<script…>` was written first and failed on the real tree within a minute —
 * `ZoneSummary.vue` mentions `<script setup>` inside an HTML comment, so the extractor found an
 * opening tag with no close. That is the identical mistake this change exists to stop, one layer
 * up: hand-lexing a grammar somebody has already written a parser for.
 *
 * The honest bound is now only the one no analysis reaches: a specifier that is not in the
 * source at all — held in an identifier, or assembled by concatenation — whose value exists
 * only at runtime.
 */
const importsStylesheet = (file: string, blocks: Blocks, scans: readonly ScriptScan[]): boolean =>
	blocks.styles.some((block) => styleImportsStylesheet(file, block))
	|| scans.some((scan) => scan.stylesheet);

/** The three trees this scan walks. Named once: the closure check below compares against them. */
const ROOTS = ['src', 'tests/harness', 'tests/helpers'] as const;

/**
 * Does this relative specifier leave the trees this scan walks?
 *
 * **The roots were a claimed transitive closure and nothing checked the claim** — reported, and
 * the report is right about the mechanism even though nothing in the tree does it today
 * (measured: resolving every relative specifier in all 443 modules lands every one of them
 * inside these three). `tests/harness/page.ts` importing `../../scripts/helper.ts`, which
 * imports `./theme.css`, would load a stylesheet through a module this sweep never opens — and
 * the execution check below cannot compensate, because Vitest's `css: false` stubs a real CSS
 * import into an empty module.
 *
 * Traversing the module graph was the reported remedy and is more than the question needs. The
 * roots do not have to be FOLLOWED, they have to be a CLOSURE — so the escape is what gets
 * reported, and then either an import stays inside trees that are already scanned or this test
 * says which file left and where it went. Cheap, because the walk above already has every
 * specifier, and it fails loudly instead of silently.
 *
 * A glob pattern is resolved at its literal prefix — the part before the first wildcard — since
 * that is the directory the matches come out of.
 *
 * **A pattern with N brace/extglob branches has up to N different directories its matches can
 * come out of, and truncating at the first metacharacter bounds only one of them.** Reported:
 * `'../{prototypes/ok,../scripts/helper}.ts'` from `src/prototypes/x.ts` truncates to `'../'`,
 * which resolves inside `src`, while the second branch resolves to `scripts/helper.ts`, outside
 * every root. `expandGlobBranches` (`tests/helpers/globBranches.ts` — moved there once fixing
 * this and covering it both at once outgrew this file's own 450-line cap) expands every `{a,b}`
 * and `@(a|b)` group — nested ones included — into its full set of branches, each truncated at
 * its own first remaining wildcard, and the specifier escapes if ANY branch does. What it still
 * cannot see: a pattern whose branch count or nesting cannot be bounded within
 * `MAX_GLOB_BRANCHES` reports an escape without checking a single branch (over-refusing, on
 * purpose); a backslash-escaped `\{` or `\(` is read as real brace/extglob syntax rather than a
 * literal character, since nothing in this tree quotes one; a character class (`[ab]`) is still
 * truncated at its `[` rather than expanded per character — safe rather than exact, since a
 * class matches one character and never a `/`, so truncating there can only shorten the prefix,
 * never miss a branch that leaves through a different directory; and a literal, non-extglob `)`
 * inside a brace group (`'{a(x),b}'`) desyncs the depth counter — it decrements on a close with
 * no matching increment, so the whole group reads as unclosed and the pattern over-refuses. Safe
 * (consistent with this predicate's whole posture) rather than exact, and left that way rather
 * than taught to tell a bare `)` from an extglob's own: nothing in this tree writes one today.
 *
 * **The bound, stated rather than implied: RELATIVE specifiers only.** A bare specifier that
 * resolves to a local module would slip past, which today is unreachable — `tsconfig.json`
 * declares no `paths` mapping and the one alias either config sets (`obsidian`) points at
 * `tests/helpers/obsidian-mock.ts`, inside the roots. A second alias, or a `paths` entry,
 * reopens it.
 */
const escapesTheRoots = (file: string, specifier: Specifier): boolean => {
	// Truncation is for PATTERNS only. A module path containing a metacharacter is a path, and
	// cutting it at that character resolves somewhere the import never goes — see `Specifier`.
	if (!specifier.isGlob) return resolvesOutsideRoots(file, specifier.text, ROOTS);
	const branches: string[] = [];
	if (!expandGlobBranches(specifier.text, branches)) {
		// The branches could not be bounded (an unclosed group, or more than
		// `MAX_GLOB_BRANCHES`) — over-refuse rather than check a truncated subset of them.
		return true;
	}
	return branches.some((branch) => resolvesOutsideRoots(file, branch, ROOTS, true));
};

/**
 * Pulled from the real file rather than retyped, so this test agrees with `chrome.css`
 * itself and not with a copy of it — a retyped selector only proves the test agrees with
 * itself. Comments are stripped first: the file's own header comment has no `{`, but
 * relying on that would make the extraction correct by accident.
 */
function chromeHeaderSelector(): string {
	const withoutComments = readFileSync('styles/chrome.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	return withoutComments.slice(0, withoutComments.indexOf('{')).trim();
}

/**
 * `theme.css`'s two growth rules are POSITIONAL on purpose (see the file's own comment
 * above them): neither names `.workspace-leaf-content` or `.view-content`, so this can't
 * pull one selector out by name the way `chromeHeaderSelector` does. Instead it discovers
 * every rule rooted at `.rp-harness-leaf` whose body actually grants flex growth
 * (`flex: 1`) — today that's the container's rule and the content pane's — without
 * retyping either selector. Which one is "the content pane's" is for the test to prove by
 * matching it against the real mounted `contentEl`, not for this function to assert.
 */
function harnessGrowthSelectors(): string[] {
	const withoutComments = readFileSync('tests/harness/theme.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

	return rules.filter(([, selector, body]) => selector.includes('.rp-harness-leaf') && body.includes('flex: 1')).map(([, selector]) => selector.trim());
}

/**
 * This one case parses the whole reachable tree with three real parsers, so it is a
 * static-analysis sweep wearing a unit test's clothes, and vitest's 5000ms default is a budget
 * written for the latter. It timed out at that default on `verify (windows-latest, 22)` —
 * measured there, not predicted.
 *
 * **Where the cost actually is, because it decided what NOT to do about it.** The case takes
 * about 760ms on a quiet Linux machine, and warm medians for the three stages total about
 * 186ms of that (`ts.createSourceFile` 138ms over 391 modules, `compileTemplate` 47ms over 52
 * prototypes, `parseSfc` and lightningcss under 2ms between them). The rest is first-pass JIT
 * warm-up of the parsers themselves — a cost paid per WORKER, not per file. So the obvious
 * cheapening, a text pre-filter skipping the 416 of 443 files whose source cannot contain a
 * stylesheet specifier at all, would have cut the small half: the first `.css`-bearing file
 * still warms TypeScript. It was measured before it was declined, and it would have bought a
 * heuristic in front of the parser — whose failure mode is the silent pass this file has now
 * paid for eleven times — for the minority of the runtime.
 *
 * So the budget is the fix. Thirty seconds is roughly forty times the local figure, well past
 * the six-fold parallel-contention factor this repository has already measured on that runner,
 * and far enough from a real regression's shape to still fail on one.
 *
 * What it cannot measure is whether the VALUE suits a runner nobody here has: the same
 * unmeasurable this repository's `settleUntil` deadline carries, and the same answer — a
 * deadline that only a genuine regression trips, rather than a tick count that encodes one
 * machine's speed.
 */
const WHOLE_TREE_SCAN_MS = 30_000;

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const readText = (file: string): string => readFileSync(file, 'utf8');

/**
 * Parses one stylesheet with `lightningcss` and reports every `@import` URL it declares — the
 * cascade's own view of the sheet, not a pattern matched against its text. See the case that
 * uses it for why: `/@import/` is case-sensitive and misses `@IMPORT`, and `/@import/i` would
 * then match one inside a comment.
 *
 * `errorRecovery: true` because `tests/harness/obsidian.css` — vendored, "kept whole" from a
 * real Obsidian install — cannot otherwise be parsed at all: its preserved upstream prose
 * names a CSS custom property as `--page-*\/--scale-factor`, and that substring is a literal
 * asterisk-slash, which closes a CSS block comment in ANY conformant parser, browsers
 * included, wherever it appears. Without recovery `lightningcss` throws trying to parse what
 * follows as CSS.
 * `errorRecovery` skips the malformed rule and keeps visiting the rest of the file rather than
 * aborting — measured, it turns that throw into a clean `imports = []` for this file, and it
 * changes nothing for every other sheet here, which already parse cleanly. Guarding the
 * vendored sheet this way, rather than excluding it from the scan, means an `@import` added to
 * it tomorrow is still caught — an excluded file is an unguarded file.
 */

const importsIn = (file: string): string[] => importUrlsOf(file, readFileSync(file));

/** Every `.css` file directly in `dir` (excluding `skip`) that itself `@import`s another. */
const sheetsImporting = (dir: string, skip: string[] = []): string[] =>
	readdirSync(dir)
		.filter((name) => name.endsWith('.css') && !skip.includes(name))
		.filter((name) => importsIn(path.join(dir, name)).length > 0)
		.map((name) => path.posix.join(path.basename(dir), name));

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
	document.head.innerHTML = '';
});

describe('the browser harness', () => {
	it('mounts the real view inside a leaf frame', () => {
		const { leafEl, view } = mountHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// The view's own first draw ran: what a browser shows is the view, not the frame.
		expect(view.contentEl.querySelector('.renovation-planner-view')).not.toBeNull();
	});

	/**
	 * `styles/chrome.css` hides Obsidian's view header by matching
	 * `.workspace-leaf-content[data-type="…"] .view-header`. The harness's mounted DOM has
	 * to satisfy that selector itself for the rule to be lookable-at in the tool built for
	 * looking — matched against the selector read from the file, not a copy of it.
	 */
	it('gives the mounted DOM what styles/chrome.css selects', () => {
		const { view } = mountHarness(document.body);

		const header = view.containerEl.querySelector('.view-header');

		expect(header).not.toBeNull();
		expect(header?.matches(chromeHeaderSelector())).toBe(true);
	});

	/**
	 * `styles/view.css` gives the mount point `height: 100%`, which only resolves because
	 * `theme.css` grows `contentEl` to fill the leaf — and that growth rule is POSITIONAL
	 * (`.rp-harness-leaf > div > div:last-child`, not a name), so it depends on
	 * `obsidian-mock.ts` keeping `contentEl` as the last child it appends to `containerEl`.
	 * If a future child landed after it, this selector would stop matching `contentEl`
	 * silently — nothing else in `npm run check` looks at rendered layout — so this asserts
	 * the coupling directly, against the selectors `theme.css` actually declares rather than
	 * a copy of them.
	 */
	it('gives the mounted contentEl the growth rule theme.css declares for it', () => {
		const { view } = mountHarness(document.body);

		const matching = harnessGrowthSelectors().filter((selector) => view.contentEl.matches(selector));

		expect(matching.length).toBeGreaterThan(0);
	});

	/**
	 * The `?project=` knob (design slice 21), which is the only way this harness reaches the
	 * view's DETAIL state at all — the index cannot mount `ProjectDetail` usefully, since it
	 * renders an entry bare and that component requires three props and reads `project.name`
	 * immediately.
	 *
	 * Driven here rather than left to `npm run harness-shot` alone, because the two shots that
	 * use it are outside `npm run check`: a seed that stopped seeding, or a `projectId` that
	 * stopped being passed, would leave both captures photographing the LIST state — the
	 * selector they wait on (`.renovation-planner-view`) matches either one, so the run would
	 * write two PNGs and exit 0.
	 *
	 * `flushPromises` and not a tick count: `onOpen` mounts synchronously and the store's read
	 * settles afterwards, so a fixed number of turns is a fact about today's call chain.
	 *
	 * **What this does NOT drive is `page.ts`'s `params.get('project')`** — it calls
	 * `mountHarness` with the id directly, so the one line that turns a URL into that argument
	 * is exercised by nothing here. A build that stopped reading the parameter would keep this
	 * case green and photograph the list twice. Stated rather than closed: `page.ts` mounts at
	 * module scope, so driving it means importing a module for its side effects under a
	 * rewritten `location`, which is a test harness of its own rather than a case. Reported by
	 * this task's reviewer.
	 */
	it('opens the detail state on a seeded project when given one, plans and all', async () => {
		const { view } = mountHarness(document.body, 'project-1');

		await flushPromises();

		const detail = view.contentEl.querySelector('.rp-project-detail');

		expect(detail).not.toBeNull();
		expect(detail?.querySelector('.rp-project-detail__name')?.textContent?.trim()).toBe(
			'Maple Street, ground floor refit',
		);
		// Enough rows that `.rp-plan-list`'s own scrolling is a thing a capture can show. A
		// list that fits its pane looks identical with the rule deleted.
		expect(detail?.querySelectorAll('.rp-plan-list__row').length).toBeGreaterThan(8);
	});

	/**
	 * The other half, and the half a wrong default would break silently: with no parameter the
	 * bare harness root still takes `makeView()`'s untouched default, which is the EMPTY project
	 * list — the state `makeRenovationProjectView.ts`'s docblock says that root exists to show,
	 * and the one the three fixed project-view shots photograph.
	 */
	it('still opens the list state when no project is named', async () => {
		const { view } = mountHarness(document.body);

		await flushPromises();

		expect(view.contentEl.querySelector('.rp-project-detail')).toBeNull();
		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
	});

	it('empties the root, so a second mount does not stack', () => {
		mountHarness(document.body);
		mountHarness(document.body);

		expect(document.body.querySelectorAll('.rp-harness-leaf')).toHaveLength(1);
	});

	// The mount installs Obsidian's DOM extensions, which a browser has none of. If this
	// regressed, every render call would throw on the real page and nothing else here would
	// notice — the suite installs them in every other file itself.
	it('installs the Obsidian DOM extensions the render code calls', () => {
		mountHarness(document.body);

		expect(typeof document.body.createDiv).toBe('function');
		expect(typeof document.body.empty).toBe('function');
	});

	it('switches the scheme classes Obsidian defines its palette under', () => {
		mountHarness(document.body);
		drawSchemeToggle();

		expect(document.body.classList.contains('theme-dark')).toBe(true);

		const toggle = document.body.querySelector<HTMLElement>('.rp-harness-scheme');
		toggle?.click();

		expect(document.body.classList.contains('theme-light')).toBe(true);
		expect(document.body.classList.contains('theme-dark')).toBe(false);
	});

	/**
	 * The scheme is the CONTENT's and the toggle is the harness's own furniture, which is why
	 * they are two functions.
	 *
	 * A `&bare` capture asks for a picture of the screen — `scripts/entryShots.mjs` puts that
	 * parameter on every named entry — and the toggle is positioned fixed over the bottom-right
	 * of the viewport, so every "chromeless" PNG this branch produced had a dashed
	 * `Harness: dark` button sitting on the prototype. Including the ones that were captured and
	 * LOOKED AT: it appears in the corner of each and was read as part of the page.
	 *
	 * Only the split is driven here. Which of the two `page.ts` calls is a source pin in
	 * `tests/build/harness-shot.test.ts`, because that module mounts at import.
	 */
	it.each([
		['/', 'theme-dark'],
		['/?theme=light', 'theme-light'],
	])('applies the scheme %s asks for, without drawing the harness furniture', (url, expected) => {
		// The URL is SET rather than assumed: the case above clicks the toggle, which writes the
		// scheme back to the URL, so a case reading the default here would be asserting about
		// whatever ran before it. Driving both values also makes this about reading the URL
		// rather than about one hard-coded outcome.
		window.history.replaceState({}, '', url);
		mountHarness(document.body);
		applyWantedScheme();

		expect(document.body.classList.contains(expected)).toBe(true);
		expect(document.body.querySelector('.rp-harness-scheme')).toBeNull();
	});

	/**
	 * The one-sheet claim, which is the entire reason prototypes moved out of
	 * `docs/user-experience/concepts/`. A mock drawn against a second sheet is approved
	 * against something that will not ship, and the page offering one is all it would take.
	 *
	 * Asserted on the page rather than on a rendered screen: there is no rendering engine
	 * here, and what CAN be checked — that the page links exactly the three sheets it means
	 * to, and that `concept.css` is not among them — is the thing that would actually go
	 * wrong.
	 *
	 * PARSED, not pattern-matched. This file already runs in jsdom (`@vitest-environment`
	 * at the top), so `DOMParser` is right there, and HTML has more spellings of one link
	 * than a regex written by hand keeps up with: attribute order is free, attribute values
	 * may be UNQUOTED (`<link rel=stylesheet href=…/concept.css>` is valid HTML a browser
	 * loads), tag and attribute names are case-insensitive, and `rel` is a space-separated
	 * token list. Two hand-written patterns here were each defeated by the next spelling
	 * somebody thought of. The parser knows all of them, and it is the same argument
	 * `CLAUDE.md` already makes for checking colours on lightningcss's parsed tree rather
	 * than on source text.
	 *
	 * `[rel~=stylesheet i]` is that knowledge spelled out: `~=` matches one token of the
	 * list, `i` makes it case-insensitive. The `<link rel="icon">` this page carries is
	 * excluded by it, which is checked below rather than assumed.
	 *
	 * `style` joins the selector because a `<style>` element is a second way this page can
	 * introduce CSS, and an `@import` inside one is a way in that no other guard here sees:
	 * the module scan reads `.ts`/`.vue`, the sheet scan reads the harness's own `.css`
	 * files, and neither is this HTML. The expected list is therefore the whole CSS-bearing
	 * set of the page, not its links — which is why a `<style>` appears in it as `<style>`
	 * and fails the equality rather than being silently uncounted.
	 */
	it('offers prototypes exactly one plugin stylesheet and no proposal sheet', () => {
		const html = readFileSync('tests/harness/index.html', 'utf8');

		const page = new DOMParser().parseFromString(html, 'text/html');
		// EVERY node that can introduce CSS, not only the links: a `<style>` element in this
		// page is another way in, and `<style>@import '…/concept.css';</style>` is a way in
		// that no later guard sees either — they scan module sources and the harness's own
		// `.css` files, neither of which is this HTML. Asked as one category so the set is
		// what is asserted, rather than a list of the spellings somebody thought of.
		const sheets = [...page.querySelectorAll('link[rel~=stylesheet i], style')].map((node) =>
			node.tagName === 'STYLE' ? '<style>' : (node.getAttribute('href') ?? ''),
		);

		expect(sheets).toEqual(['./obsidian.css', './theme.css', '/styles.css']);
		expect(sheets.some((href) => href.includes('concept'))).toBe(false);
	});

	/**
	 * The same claim over every other route THESE CHECKS cover. A sheet reaches this page as a
	 * `<link>` in `index.html`, through Vite's module graph — a `.css` import anywhere in what
	 * the page can load, or an SFC `<style>` block — or as a `<link>` a TEMPLATE renders into
	 * the body, which no build step and no import is involved in at all. The case above can see
	 * only the first. This one refuses those three routes reaching a fourth sheet through
	 * anything the page can reach — not every conceivable route a stylesheet could take. A Vite
	 * plugin's `transformIndexHtml` injecting a `<link>` would be a seventh route none of these
	 * checks see; none exists in this repository today (grepped), so nothing here reaches for
	 * one, but the claim is scoped to what is actually checked rather than to "nothing ever."
	 *
	 * The scanned set is what the page can reach, not the files that exist today: `page.ts`
	 * imports the harness modules, those import `src/` AND `tests/helpers/`, and Task 4's
	 * index globs `src/prototypes/**` and `src/presentation/**` — so a sheet imported by a
	 * component three levels down, or by a DOM helper, is loaded exactly as surely as one
	 * imported here. Scanning all three trees closes the transitive route without building
	 * anything: if no file in any of them imports a stylesheet, nothing reachable through
	 * them does.
	 *
	 * The three spellings are checked over different sets, and the asymmetry is deliberate:
	 *
	 * - A `<style>` block is checked in `tests/harness/` ONLY, because `eslint.config.mjs`
	 *   already refuses one anywhere under `src/` (`vue/no-restricted-block`, over
	 *   `VUE_FILES` = `['**\/src/**\/*.vue']`) while a `.vue` under `tests/` matches no
	 *   ESLint block at all — measured. Scanning `src/` for it here would duplicate a live
	 *   rule AND report `ViewRoot.vue`, whose comment spells the tag it is promising never
	 *   to use. A text scan cannot tell a comment from a block; the linter can, and does.
	 * - A `.css` IMPORT is checked over both, because no rule refuses one in either.
	 * - A `<link rel="stylesheet">` IN A TEMPLATE is checked over both as well, and it is the
	 *   spelling that needs no build step and no import at all: a browser honours a
	 *   stylesheet link in the body, so a mock carrying one loads the proposal sheet while
	 *   the import scan, the `<style>` scan and the `index.html` scan all stay green. Matched
	 *   as `<link … stylesheet` rather than by attribute order, for the reason the case above
	 *   already gives — and narrow enough that the prose in this repository that merely says
	 *   "stylesheet" does not trip it. Measured: no hit in 169 files.
	 *
	 * The import pattern matches the SPECIFIER POSITION — a quoted string preceded by `from`,
	 * by `import`, or by `import(` — rather than the bare substring `.css`. Both halves of
	 * that are load-bearing:
	 *
	 * Not the bare substring, because prose naming `concept.css` is how this repository
	 * explains itself, and a guard that fires on its own explanation gets deleted rather
	 * than obeyed.
	 *
	 * And not `import` alone, because `import classes from './panel.module.css'` — Vite's
	 * ordinary CSS-modules form — puts the specifier after `from`, and a pattern anchored
	 * on the quote following `import` misses it while looking thorough. Measured on six
	 * spellings: side-effect, default binding, named binding, dynamic, a re-export, and a
	 * BACKTICK-quoted dynamic import — `` import(`./x.css`) `` is valid, statically
	 * analysable Vite syntax the first five checks did not cover, since the delimiter class
	 * named only `'"` and not `` ` ``. Planted and watched failing before this was widened
	 * (a template-literal specifier in `page.ts` reaches production and was invisible to
	 * both this scan AND the rendered-document check in `indexRealEntries.test.ts`, which mounts
	 * `IndexPage` directly and never executes `page.ts` at all — this source scan remains
	 * the only check in this file that can see a `page.ts`-specific IMPORT at all, `page.ts`
	 * itself running below included: Vitest's default `css: false` stubs a real `.css`
	 * import into an empty module rather than loading it, so executing the module graph
	 * proves nothing about an import no matter how faithfully it runs — measured, not
	 * assumed, by planting one and watching the execution check below stay green through
	 * it while this one caught it; see that check's own comment for what running the
	 * module graph closes instead).
	 *
	 * The widening touches only the DELIMITER class (`['"`` ` ``]`, both ends of the match);
	 * the inner exclusion class stays `[^'"]` — backtick deliberately left out of it — so a
	 * literal backtick inside a single- or double-quoted specifier, legal on every POSIX
	 * filesystem (`import './weird`.css'`), still matches exactly as it did before this
	 * widening, while `` import(`./x.css`) `` now matches too, delimiters included. Measured
	 * both directions: sharing one class between the delimiters and the interior — the
	 * shape this file carried between the six-spellings widening and this paragraph — passes
	 * the backtick-quoted case but loses that POSIX-legal one; splitting the two classes, as
	 * written now, keeps both.
	 *
	 * **What this still does not cover, stated rather than left implicit.** A specifier held
	 * in a VARIABLE — `import(cssPath)` — is not a literal quoted string at all, so no regex
	 * on this pattern's shape can see it; that is a limit of pattern-matching itself, and a
	 * further refinement of this character class does not remove it. A COMPUTED specifier
	 * built from a template literal is not automatically in that category, though — measured:
	 * `` import(`./${name}.css`) `` still matches, because the pattern only requires `.css`
	 * text to appear before the closing delimiter, and that text survives the `${…}`
	 * interpolation sitting in front of it. What actually defeats the pattern is the
	 * specifier carrying no literal `.css` text at the import site at all, which is what
	 * `import(cssPath)` is an example of and a template literal ending in `.css` is not.
	 *
	 * `sources()` below excludes exactly the `*.test.ts` suffix, and only that suffix — a
	 * `.test-d.ts` or `.test.tsx` under one of these trees would still be walked. Harmless
	 * today (measured: neither exists under `src/`, `tests/harness/` or `tests/helpers/`).
	 *
	 * The exclusion is not a nicety: without it, this test fails against ITSELF and against
	 * `cssVars.test.ts` — measured, not assumed. This file's own planted-proof documentation
	 * literally contains `import '…/concept.css';`, matching `sheetImport`, and
	 * `<link rel="stylesheet" href="…/concept.css" />`, matching `sheetLink`; `cssVars.test.ts`
	 * separately defines `const LINK = /<link rel="stylesheet" href="([^"]+)" \/>/g;`, whose
	 * own literal text matches `sheetLink` too. Neither file loads a stylesheet — one documents
	 * this guard, the other extracts hrefs with a regex of its own — but both would report a
	 * false hit if scanned, which is exactly the class of guard-fires-on-its-own-explanation
	 * defect named above for the bare-substring case.
	 */
	/**
	 * The closure check's own separator handling, driven from BOTH platforms' spellings on
	 * whichever one is running — because the first version was correct on Linux, wrong on
	 * Windows, and the whole suite could not tell.
	 *
	 * Watched failing against that version: with the roots compared using `path.sep`, the two
	 * backslash rows below report an escape for a sibling import that never leaves the tree.
	 */
	/**
	 * Both CSS-module dependency forms, pinned as BEHAVIOUR rather than left to the probe file
	 * that found them — and the `@value` row doubles as the lock on lightningcss's warning type,
	 * which is the only signal that form exposes. A renamed warning turns the check silently
	 * permissive, which is the `rule-custom-message` hazard this repository already records.
	 */
	it('sees both CSS-module dependency forms and neither plain block', () => {
		expect({
			composes: cssModuleDependsOnFile('x.css', ".a { composes: base from './theme.css'; }"),
			value: cssModuleDependsOnFile('x.css', "@value brand from './theme.css';\n.a { color: brand }"),
			plain: cssModuleDependsOnFile('x.css', '.a { color: var(--text-normal); }'),
		}).toEqual({ composes: true, value: true, plain: false });
	});

	it('resolves the root closure by separator and by specifier kind', () => {
		const inside: Specifier = { text: './sibling', isGlob: false };
		const outside: Specifier = { text: '../../scripts/helper.ts', isGlob: false };
		// A module path that merely CONTAINS a glob metacharacter is still a path: truncating it
		// at the `(` resolved to `src/` and reported no escape, while the import really leaves.
		const parenthesised: Specifier = {
			text: '../(route)/../../scripts/helper.ts',
			isGlob: false,
		};
		// The same text as a PATTERN is truncated on purpose — the literal prefix is the directory
		// its matches come out of, and `../` from here is inside the roots.
		const pattern: Specifier = { text: '../(route)/*.ts', isGlob: true };
		expect({
			posixInside: escapesTheRoots('tests/helpers/vault.ts', inside),
			windowsInside: escapesTheRoots('tests\\helpers\\vault.ts', inside),
			posixOutside: escapesTheRoots('tests/harness/page.ts', outside),
			windowsOutside: escapesTheRoots('tests\\harness\\page.ts', outside),
			parenthesisedPath: escapesTheRoots('src/prototypes/x.ts', parenthesised),
			globPattern: escapesTheRoots('src/prototypes/x.ts', pattern),
		}).toEqual({
			posixInside: false,
			windowsInside: false,
			posixOutside: true,
			windowsOutside: true,
			parenthesisedPath: true,
			globPattern: false,
		});
	});

	/**
	 * Task R7 — a Codex finding against this predicate's OWN earlier fix: truncating at the first
	 * metacharacter bounds only ONE branch of a brace or extglob alternation, and a pattern with N
	 * branches can resolve out of N different directories. Each row is a branch the naive fix
	 * ("any brace escapes") could not tell from the reported bug — see `allInside` in particular.
	 *
	 * The unclosed-group and nested-brace rows exist because `tests/harness/*.ts` sits outside
	 * `vitest.config.ts`'s coverage `include` (`src/**\/*.{ts,vue}` only) — nothing here would ever
	 * flag either behaviour going uncovered, so `expandGlobBranches`'s own suite
	 * (`tests/helpers/globBranches.test.ts`) is where those two are actually pinned; these rows
	 * are `escapesTheRoots`'s end-to-end confirmation that the wiring reaches them.
	 */
	it.each([
		// The reported case, verbatim: truncating at the first `{` reduces this to `../`, which
		// resolves inside `src`, but the second branch really resolves to `scripts/helper.ts`.
		['the reported case', 'src/prototypes/x.ts', '../{prototypes/ok,../scripts/helper}.ts', true],
		// Every branch stays inside the roots — proves the fix isn't "flag any brace at all".
		['every branch staying inside', 'tests/helpers/vault.ts', './{a,b}.ts', false],
		// `MAX_GLOB_BRANCHES + 1` branches against the cap: hitting it reports an escape rather
		// than silently checking a prefix of them, even though every one of these branches, fully
		// expanded, would individually resolve inside the roots.
		[
			'more branches than the cap',
			'tests/helpers/vault.ts',
			`./{${Array.from({ length: MAX_GLOB_BRANCHES + 1 }, (_unused, i) => String.fromCharCode(97 + i)).join(',')}}.ts`,
			true,
		],
		// The two real globs this repository uses today, so the suite stays honest.
		['the real prototypes glob', 'tests/harness/entries.ts', '../../src/prototypes/**/*.vue', false],
		['the real components glob', 'tests/harness/entries.ts', '../../src/presentation/**/*.vue', false],
		// The reported case's shape in extglob syntax rather than brace syntax.
		['an extglob branch leaving the roots', 'src/prototypes/x.ts', '../@(prototypes/ok|../scripts/helper).ts', true],
		// No matching `}` at all — `expandGlobBranches` cannot bound the branches and over-refuses.
		['an unclosed group', 'tests/helpers/vault.ts', '../{a,b', true],
		// The inner group's own branch (`../../scripts/x`) is what actually escapes — this fails
		// unless the recursive call over the outer group's second alternative finds and expands
		// the nested `{b,../../scripts/x}` rather than leaving it as an opaque, unexpanded branch.
		[
			'a nested brace, its inner branch bounded too',
			'src/prototypes/x.ts',
			'../{a,{b,../../scripts/x}}.ts',
			true,
		],
	])('bounds every branch of a brace or extglob pattern — %s', (_label, file, text, escapes) => {
		expect(escapesTheRoots(file, { text, isGlob: true })).toBe(escapes);
	});

	it('loads no stylesheet through anything the harness can reach', () => {
		// A specifier may not contain a BARE newline, and may contain an escaped one.
		//
		// The bare-newline exclusion is what stops the class spanning prose. Measured twice, both
		// times on comments: "Split from `onKey`" paired with a backticked `canvas.css`
		// twenty-one lines below it and matched across the gap, and the second instance was
		// written by an author who had just recorded the first. The failure message says "loads
		// no stylesheet", which points nowhere near a comment, so each false positive costs a
		// debugging cycle rather than a glance.
		//
		// Line continuations are REMOVED BEFORE MATCHING rather than spelled into the pattern,
		// which is the transformation JavaScript's own parser performs: a specifier holding
		// ``./styles\<newline>/index.css`` really does load a stylesheet, so the source newline
		// must not defend against the match. Verified in node rather than reasoned about.
		//
		// **This replaced a `(?:[^'"\n]|\\\n)*` alternative that handled continuations in the
		// PRECEDING repetition only, so `'./styles.cs\<newline>s'` — a continuation inside the
		// EXTENSION — evaluated to `./styles.css` and matched nothing.** The assertion below is
		// `toEqual({ importers: [] })`, so an under-matching pattern is a SILENT PASS: the
		// stylesheet stays reachable and the walk reports a clean tree. That is this
		// repository's own assert-an-absence defect, in the instrument rather than in a case.
		//
		// Normalising also closed a gap nobody reported: `\\\n` does not match `\\\r\n`, so a
		// CRLF continuation defeated the old pattern too. Three rounds narrowed this regex one
		// reported case at a time; doing what the parser does closes the class, and the third
		// round is what says a pattern was the wrong instrument rather than a wrong pattern.
		const sheetLink = /<link[^>]*\bstylesheet\b/i;
		// Every extension Vite will load as a module, not the two this repository happens to
		// hold today: `tsconfig.json` sets `allowJs`, so a `.js` or `.mjs` helper is as
		// reachable as any other and its CSS import would load the same sheet. Matches
		// `eslint.config.mjs`'s own `SRC_EXTENSIONS` — the repository's other answer to the
		// same question — nine spellings rather than a list restated by eye; the two disagreed
		// on `.mts`/`.cts` until this widening (measured: neither exists under `src/`, `tests/`
		// or `scripts/` today, so nothing was actually missed yet, but `moduleResolution:
		// "bundler"` and `allowJs` mean Vite compiles both, so a future helper written in
		// either would have had its stylesheet import go unscanned).
		const MODULE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|jsx|vue)$/;
		// `isPlantedProbe` because `tests/build/lint-edited.test.ts` writes real `.vue` files
		// into `tests/harness/` and removes them, in a worker running beside this one. Without
		// it this walk lists a probe and then READS it, and the read loses the race: measured,
		// `ENOENT … lint-edited-probe-1.vue`, on a tree with no source change at all. Excluded
		// in the walk rather than at either use below, for the reason its sibling walker in
		// `lint-scope.test.ts` gives — a probe is not a module of this page under any question
		// asked of this list.
		const sources = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) return sources(full);
				if (isPlantedProbe(full)) return [];
				return MODULE.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : [];
			});

		// `ROOTS` rather than three literals: the trees that are WALKED and the trees the closure
		// check compares against have to be one list, or a root added to either is a hole in the
		// other. `tests/helpers/` is in it because `mount.ts` and `planEditor.ts` are RUNTIME
		// modules of this page, so a stylesheet imported by a helper reaches the page exactly as
		// surely as one imported here.
		const reachable = ROOTS.flatMap((root) => sources(root));

		// Read and parse each file ONCE, then ask it every question. Three separate `.filter`
		// passes each re-read the file, which cost nothing measurable and made the parse the
		// caller's business to remember rather than the scan's.
		const scanned = reachable.map((file) => {
			const text = readText(file);
			const blocks = blocksOf(file, text);
			return { file, text, blocks, scans: blocks.scripts.map((s) => scanScript(file, s)) };
		});
		const named = (
			predicate: (entry: (typeof scanned)[number]) => boolean,
		): string[] => scanned.filter((entry) => predicate(entry)).map((entry) => entry.file);

		const importers = named(({ file, blocks, scans }) => importsStylesheet(file, blocks, scans));
		const escapees = named(({ file, scans }) =>
			scans.some((scan) => scan.relative.some((specifier) => escapesTheRoots(file, specifier))),
		);
		const linkers = named(({ text }) => sheetLink.test(text));
		const externalBlocks = named(({ blocks }) => blocks.external.length > 0);
		const styleBlocks = sources('tests/harness').filter((file) =>
			/<style[\s>]/.test(readText(file)),
		);

		expect({ importers, linkers, externalBlocks, escapees, styleBlocks }).toEqual({
			importers: [],
			linkers: [],
			externalBlocks: [],
			escapees: [],
			styleBlocks: [],
		});
	}, WHOLE_TREE_SCAN_MS);

	/**
	 * Round 8's item 5 — the route no source pattern can ever see, at any width: a stylesheet
	 * inserted PROGRAMMATICALLY (`document.createElement('link'); el.rel = 'stylesheet'; …;
	 * document.head.appendChild(el)`) is not distinguishable from any other `createElement`
	 * call without running the code, so widening the regex above is not an available fix —
	 * only running it and looking at the result is. The rendered-document check in
	 * `indexRealEntries.test.ts` already does that for what an ENTRY renders, but it mounts
	 * `IndexPage` directly and never executes `page.ts` — the harness page's actual entry
	 * point, and the one place with a route this specific: `applyPlatform` and
	 * `drawSchemeToggle` run from there and from nowhere a test mounts. (The component
	 * registry no longer belongs on that list: `indexApp.ts` gives every mounted test of the
	 * index the same registry `page.ts` installs, which is what made a prototype composing a
	 * real component testable at all.)
	 *
	 * So this executes `page.ts` itself. Its top-level code runs once per module instance, at
	 * import time, branching on `window.location.search` — `vi.resetModules()` plus a fresh
	 * dynamic `import` re-runs it for this test rather than reusing whatever a previous test
	 * left behind, and `?index` takes the branch that mounts the real `IndexPage` against the
	 * real glob, the same path `npm run harness` serves.
	 *
	 * **Proven to catch something, not merely to run**: a `document.createElement('link')`
	 * stylesheet planted at `page.ts`'s top level was watched failing here (`CSS NODES` went
	 * from 0 to 1) before being removed again — recorded in the round 8 report rather than
	 * left in the tree, for the reason `tests/harness/harness.test.ts`'s other planted proofs
	 * already give.
	 *
	 * **What this still does not close.** `?index` alone renders "Pick an entry." — no entry
	 * mounts — so a stylesheet a specific ENTRY inserts programmatically is still the
	 * `indexRealEntries.test.ts` check's job, not this one's; this closes `page.ts`'s OWN
	 * route, the one no other check executes at all.
	 */
	it('adds no stylesheet to the document when page.ts itself runs', async () => {
		installEditorEnvironment();
		window.history.replaceState({}, '', '/?index');
		vi.resetModules();

		await import('../harness/page');
		await flushAsync();

		expect(document.querySelectorAll('link[rel~=stylesheet i], style').length).toBe(0);
	});

	/**
	 * A stylesheet can import a stylesheet, and that is a fourth route. `@import
	 * '../../docs/user-experience/concepts/concept.css';` added to `tests/harness/theme.css`
	 * loads the proposal sheet: the HTML still has its three links, no module imports a
	 * `.css`, no template renders a `<link>`, and every list above stays empty. The walker
	 * excludes `.css` files entirely, so it cannot see it.
	 *
	 * BOTH linked harness sheets are scanned — `theme.css` and, with `errorRecovery` (see
	 * `importsIn`), the vendored `obsidian.css` too — and neither has any legitimate use for
	 * `@import`: they are standalone files the page links directly. So the rule is simply
	 * that they carry none.
	 */
	it('lets no stylesheet the page loads pull in another', () => {
		// PARSED, for the same reason the page check is parsed rather than pattern-matched.
		// `@IMPORT` is valid CSS and a browser honours it; `/@import/` does not match it, and
		// `/@import/i` would then match one inside a comment. `lightningcss` answers both at
		// once — it is already a devDependency, already used by the stylesheet gate, and the
		// visitor sees exactly what the cascade would.
		const imported = [
			...sheetsImporting('tests/harness'),
			// `styles/` too, minus `index.css`. The assembler validates index.css's OWN lines
			// against `@import "./<partial>.css";` — but it then concatenates each partial's
			// body UNCHANGED (`scripts/styles-assemble.mjs`, the `parts` map: line count and
			// hard-coded colours are checked, nothing else), so an `@import` inside a partial
			// survives into the shipped sheet and into the page. Verified in the source, after
			// an earlier version of this comment claimed the assembler owned the question and
			// was wrong.
			...sheetsImporting('styles', ['index.css']),
		];

		expect(imported).toEqual([]);
	});

	// `applyPlatform` is deliberately NOT asserted here: the property that matters —
	// that it works BEFORE the extensions are installed — is not reachable from this
	// file, because a case above has already installed them on the shared prototype.
	// `platform.test.ts` holds the strictly stronger version of that check.
});

/**
 * The Plan Editor half of the page — `npm run harness` with `?view=plan-editor`. Same job
 * as the block above and the same limit: this asserts the FRAME and the plumbing, never
 * appearance, because a browser is where the layered scene is actually looked at.
 *
 * The canvas backing and the resize observer are installed because a real Konva stage is
 * constructed here; a browser has both natively, and jsdom has neither.
 */
describe('the browser harness, plan editor', () => {
	it('mounts the real plan editor inside the same leaf frame', () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountPlanEditorHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
	});

	/**
	 * The scheme toggle has to reach the CANVAS, not just the DOM chrome. A Konva shape
	 * cannot read a CSS variable, so the editor re-resolves its palette on a theme event —
	 * and without the toggle firing one, switching scheme here would relight the panels and
	 * leave the zones drawn in the other theme.
	 */
	it('fires a theme event the editor can re-resolve its palette on', () => {
		installCanvas();
		installResizeObserver();
		mountPlanEditorHarness(document.body);
		drawSchemeToggle();
		let fired = 0;
		window.addEventListener('rp-harness-theme', () => {
			fired += 1;
		});

		document.body.querySelector<HTMLElement>('.rp-harness-scheme')?.click();

		expect(fired).toBe(1);
	});
});

/**
 * The asset designer half of the page — `npm run harness` with `?view=asset-designer` (Task
 * B10). Same job as the block above and the same limit: this asserts the FRAME and the
 * plumbing, never appearance — a browser is where the shell is actually looked at.
 *
 * The canvas backing and the resize observer are installed for the identical reason: a real
 * Konva stage is constructed inside `DesignerCanvas`, which a browser has natively and jsdom
 * has neither of. There is no theme-event case to mirror the Plan Editor's: `DesignerCanvas.vue`
 * 's own docblock records that `AssetDesignerDeps` carries no theme subscription, so this
 * surface has nothing to fire yet.
 */
describe('the browser harness, asset designer', () => {
	it('mounts the real asset designer inside the same leaf frame', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountAssetDesignerHarness(document.body);
		// The designer's own hydration settles a tick after the synchronous mount, same as
		// every other view this file and `accessibility.test.ts` mount.
		await flushPromises();

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-asset-designer-view')).not.toBeNull();
	});
});
