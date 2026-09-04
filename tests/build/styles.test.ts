import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * `assembleStyles` resolves its paths from the WORKING DIRECTORY, so a planted tree plus
 * a chdir is what drives it — the same shape the real build calls it with, rather than a
 * seam added for the test.
 *
 * The rule under test is the one a stylesheet cannot report for itself: a partial that
 * `index.css` does not import is silently absent from the shipped sheet.
 */

const cwd = process.cwd();
const planted: string[] = [];
afterEach(() => {
	// Restore FIRST — the planted dir cannot be removed while it is the working directory
	// (Windows refuses), and every later test resolves from cwd.
	process.chdir(cwd);
	for (const dir of planted.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const plant = (files: Record<string, string>) => {
	const dir = mkdtempSync(path.join(tmpdir(), 'styles-'));
	planted.push(dir);
	mkdirSync(path.join(dir, 'styles'));
	for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, 'styles', name), body);
	process.chdir(dir);
};

describe('assembling the stylesheet', () => {
	it('concatenates the partials in the order index.css imports them', () => {
		plant({
			'index.css': '@import "./one.css";\n@import "./two.css";\n',
			'one.css': '.one { margin: 0; }\n',
			'two.css': '.two { padding: 0; }\n',
		});

		const out = assembleStyles();

		expect(out).toContain('GENERATED');
		expect(out.indexOf('.one')).toBeLessThan(out.indexOf('.two'));
	});

	it('refuses a partial no entry file imports', () => {
		plant({
			'index.css': '@import "./one.css";\n',
			'one.css': '.one { color: red; }\n',
			'orphan.css': '.orphan { color: green; }\n',
		});

		expect(() => assembleStyles()).toThrow(/orphan\.css/);
	});

	it('refuses a partial over the line cap', () => {
		plant({
			'index.css': '@import "./big.css";\n',
			'big.css': '.a { color: red; }\n'.repeat(401),
		});

		expect(() => assembleStyles()).toThrow(/over the 400-line cap/);
	});

	// The cap is 400 INCLUSIVE, the same count ESLint's max-lines reports. A split on '\n'
	// counts the trailing newline as a phantom extra line, and this is the boundary where
	// that off-by-one would refuse a legal file.
	it('accepts a partial of exactly the cap', () => {
		plant({
			'index.css': '@import "./big.css";\n',
			'big.css': '.a { margin: 0; }\n'.repeat(400),
		});

		expect(() => assembleStyles()).not.toThrow();
	});

	// `[\w.]` does not contain '-'. A regex that cannot see a hyphenated name reports the
	// file as unimported — a false failure whose message blames the entry file.
	it('assembles a hyphenated partial', () => {
		plant({
			'index.css': '@import "./work-package.css";\n',
			'work-package.css': '.wp { margin: 0; }\n',
		});

		expect(assembleStyles()).toContain('.wp');
	});

	// A Windows editor can save the entry file with CRLF before .gitattributes ever sees
	// it; `$` in a multiline regex matches before \n, not before \r.
	it('assembles a CRLF-saved entry file', () => {
		plant({
			'index.css': '@import "./one.css";\r\n',
			'one.css': '.one { margin: 0; }\n',
		});

		expect(assembleStyles()).toContain('.one');
	});

	it('tolerates comments in the entry file', () => {
		plant({
			'index.css': '/* order is load-bearing */\n@import "./one.css"; /* first */\n',
			'one.css': '.one { margin: 0; }\n',
		});

		expect(assembleStyles()).toContain('.one');
	});

	/**
	 * The entry file ships nothing itself: a rule authored there, or an import spelled in
	 * a way the assembler cannot see (a subdirectory path), would be silently absent from
	 * the shipped sheet — the exact failure this assembler exists to refuse, so it must be
	 * LOUD, not silent.
	 */
	it('refuses a rule authored directly in the entry file', () => {
		plant({
			'index.css': '@import "./one.css";\n.direct { color: red; }\n',
			'one.css': '.one { color: red; }\n',
		});

		expect(() => assembleStyles()).toThrow(/\.direct/);
	});

	it('refuses an import it cannot resolve, loudly', () => {
		plant({
			'index.css': '@import "./zones/plan.css";\n',
		});

		expect(() => assembleStyles()).toThrow(/zones\/plan\.css/);
	});

	/**
	 * A rebase or merge can leave the same import twice, and every other gate stays green:
	 * nothing is orphaned, every line parses. But the second copy is concatenated again at
	 * its later position — silently reordering the cascade this file's own header calls
	 * behaviour, since the duplicate now overrides everything between the two copies.
	 */
	it('refuses a partial imported twice', () => {
		plant({
			'index.css': '@import "./one.css";\n@import "./two.css";\n@import "./one.css";\n',
			'one.css': '.one { color: red; }\n',
			'two.css': '.two { color: blue; }\n',
		});

		expect(() => assembleStyles()).toThrow(/one\.css/);
	});

	/**
	 * A hard-coded colour looks correct in whichever theme authored it and wrong in every
	 * other one (SDD §84). The check runs `lightningcss` — the real parser this stylesheet
	 * is already minified with — and walks each declaration's PARSED value for a literal
	 * colour, so it sees hex, every colour function the CSS Color spec resolves into a
	 * structured colour (`rgb()`/`rgba()`/`hsl()`/`hsla()`/`hwb()`/`lab()`/`lch()`/
	 * `oklab()`/`oklch()`/`color()`, a literal-only `color-mix()`, `light-dark()`) AND, as
	 * a direct consequence of using a real parser rather than a source-text pattern, CSS
	 * NAMED colours too — see 'refuses a CSS named colour' below for why that is now safe
	 * to check, where three earlier rounds of this gate deliberately left it alone.
	 */
	describe('hard-coded colours', () => {
		it('refuses a hex colour, naming the file and the line', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one {\n\tcolor: #fff;\n}\n',
			});

			// The line named is the RULE's line, not the declaration's: lightningcss's
			// visitor gives a source position on a `Rule`, never on a `Declaration` —
			// confirmed by inspecting what the visitor actually receives, not assumed
			// from its type definitions. `.one {` opens on line 1, so that is what a
			// violation anywhere inside it is reported against.
			expect(() => assembleStyles()).toThrow(/one\.css:1/);
		});

		// A Windows editor can save a PARTIAL with CRLF before .gitattributes ever sees
		// it. lightningcss's own tokenizer, not a '\n'-split, is what has to tolerate
		// this now — this pins that it does.
		it('refuses a hard-coded colour in a CRLF-saved partial', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one {\r\n\tcolor: #fff;\r\n}\r\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('reports a clear parse failure for an unterminated string, rather than silently masking what follows it', () => {
			// A string that never closes is not a scanning edge case to a real parser —
			// CSS terminates a string at a bare newline (a "bad string" token) — so
			// lightningcss throws, and this project's own rule ("a parse error must be
			// reported clearly, not swallowed") is what turns that into a named build
			// failure instead of a silently-passed partial.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.a { content: "oops\ncolor: #fff;\n}\n.b { color: green; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		// A per-type sub-visitor (`Rule: { style(rule) {...} }`) only fires for THAT
		// type, so `@keyframes` and `@page` used to leave the tracked line at its
		// initial `null` — printing the literal text "null" in the thrown message. The
		// fix is a single generic `Rule(rule)` visitor; these two pin that every rule
		// kind now reports a real line, not the word "null".
		it('reports a real line number for a colour inside @keyframes, not the word null', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@keyframes fade {\n\tfrom { color: #fff; }\n}\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css:1/);
		});

		it('reports a real line number for a colour inside @page, not the word null', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@page {\n\tcolor: #fff;\n}\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css:1/);
		});

		/**
		 * Regression coverage for a bug the generic `Rule()`-based rewrite introduced and
		 * a later wave shipped without catching: `@page`'s margin-box at-rules
		 * (`@top-center`, `@top-left`, …) live under a field named `rules`, the SAME field
		 * name a true container (`@media`, `@supports`, …) uses for its nested rules — but
		 * lightningcss's visitor never calls `Rule()` for a margin box separately (checked
		 * by hand against the parsed tree: a margin box is `{ marginBox, declarations,
		 * loc }`, not the `{ type, value }` shape a container's own children have). A fix
		 * that excluded the whole `rules` FIELD — reasonable for a container, wrong for
		 * `@page` — silently dropped every margin-box declaration from the scan. These four
		 * cases are the exact regression report: the first three must refuse, the fourth
		 * (an Obsidian variable, not a literal) must not.
		 */
		it('refuses a hard-coded colour inside an @page margin box (@top-center)', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@page { @top-center { color: #fff; } }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses a hard-coded colour inside an @page :first margin box (@top-left)', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@page :first { @top-left { background: #000; } }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('does not flag an Obsidian variable inside an @page margin box', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@page { @top-center { color: var(--a); } }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		/**
		 * The other half of the same regression: a TRUE container's nested rule must still
		 * be reported exactly once, at its OWN (more precise) line — not the container's
		 * coarser line, and not twice. A fix that stopped excluding `rules` entirely to
		 * catch the `@page` case above, without judging each element's own shape, would
		 * regress this the other direction (either a double report or the container's
		 * blunter line). The nested `.x` rule sits on line 2; asserting THAT line, not
		 * line 1, is what proves the container itself was skipped and only the nested
		 * rule's own, more precise `Rule()` call reported it.
		 */
		it('reports a colour inside @media exactly once, at the nested rule line, not the container line', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@media (width > 1px) {\n\t.x { color: #fff; }\n}\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css:2/);
		});

		/**
		 * Everything below is regression coverage run against the real parser rather
		 * than patched string logic — every colour function the CSS Color spec defines
		 * (including the one, `device-cmyk()`, lightningcss's parser leaves unresolved
		 * and this check names explicitly instead); `light-dark()` judged as a
		 * CONTAINER, one argument per colour scheme, not as a literal itself — the
		 * theme-correct `light-dark(var(--a), var(--b))` must pass, and it must not cost
		 * catching `light-dark(#fff, #000)`; a colour nested at any depth (a gradient
		 * stop, a `var()` fallback, an otherwise-unresolved function's own arguments,
		 * `@property`'s `initial-value`); and every one of six bypasses found across
		 * four rounds of hand-rolled scanning, each defeated by CSS content that LOOKED
		 * like syntax to a scan that could not actually parse it — a quoted brace, a
		 * `/*` inside a string bridging to a real comment (two variants), an escaped
		 * `)` inside `url()`, an at-rule-nested selector; plus the whole-branch review's
		 * two bypasses, both closed by the same generic fix (a rule kind lightningcss
		 * structures with named fields instead of a `Declaration`-reachable list, and the
		 * generic `unknown` type every at-rule lightningcss does not model parses as) —
		 * see `NESTED_RULES_KEY` in the source file for what makes this a class fix
		 * rather than one more name added to a list.
		 */
		it.each([
			['an rgb() colour', '.one { color: rgb(0, 0, 0); }'],
			['an rgba() colour', '.one { color: rgba(0, 0, 0, 0.5); }'],
			['an hsl() colour', '.one { color: hsl(0, 0%, 0%); }'],
			['an hsla() colour', '.one { color: hsla(0, 0%, 0%, 0.5); }'],
			['a hard-coded hwb() colour', '.one { background: hwb(200 30% 20%); }'],
			['a hard-coded lab() colour', '.one { color: lab(50% 20 -30); }'],
			['a hard-coded lch() colour', '.one { color: lch(50% 40 30); }'],
			['a hard-coded oklab() colour', '.one { color: oklab(0.5 0.1 -0.1); }'],
			['a hard-coded oklch() colour', '.one { color: oklch(60% 0.2 30); }'],
			['a hard-coded color() colour', '.one { color: color(display-p3 1 0 0); }'],
			['a CSS named colour', '.one { color: red; }'],
			['a hex colour with no whitespace before the semicolon', '.one{color:#fff;}'],
			['a colour after a quoted closing brace in the same block', '.x { content: "}"; color: #fff; }'],
			['a colour after a quoted opening brace in the same block', '.x { content: "{"; color: #fff; }'],
			['a colour nested inside an at-rule', '@media (width > 1px) { .x { color: #fff; } }'],
			['a colour bridged by a string containing a comment-open delimiter', '.x { content: "/*"; color: #fff; content: "*/"; }'],
			['a colour after a stray comment-open string bridges into a later rule', '.a { content: "oops /*"; }\n.b { color: #fff; } /* trailing */'],
			['device-cmyk(), the one colour function lightningcss leaves unresolved', '.x { color: device-cmyk(0% 81% 81% 30%); }'],
			['a literal colour argument inside an unresolved function call', '.x { color: color-contrast(#fff vs #000, #ccc); }'],
			['the computed result of a literal-only color-mix()', '.x { color: color-mix(in srgb, #fff 50%, #000 50%); }'],
			['a colour nested inside a gradient colour-stop', '.x { background: linear-gradient(#fff, blue); }'],
			['a colour used as a var() fallback', '.x { color: var(--missing, #fff); }'],
			['light-dark() with two literal colours', '.x { color: light-dark(#fff, #000); }'],
			['light-dark() with one literal colour and one variable', '.x { color: light-dark(var(--text-normal), #000); }'],
			[
				'a hard-coded colour as an @property initial-value',
				'@property --accent {\n\tsyntax: "<color>";\n\tinherits: false;\n\tinitial-value: #fff;\n}',
			],
			[
				'a hard-coded colour as an @font-palette-values override-colors, a rule kind lightningcss models with named fields rather than a generic declaration list, the same shape as @font-face and @property',
				'@font-palette-values --theme {\n\tfont-family: X;\n\toverride-colors: 0 #fff;\n}',
			],
			[
				'a hard-coded colour nested inside an at-rule lightningcss does not model at all, which parses generically as rule type "unknown" with its block left as a raw token stream',
				'@unknown-thing {\n\t.a { color: #fff; }\n}',
			],
		])('refuses %s', (_label, css) => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': `${css}\n`,
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		/**
		 * Every exemption this check grants, plus every case a false positive was found
		 * and fixed in: `currentColor`, `transparent` (and its generalisation to alpha 0
		 * on any colour type), `inherit` and a CSS system-colour keyword all adapt to a
		 * theme rather than encoding a palette value; a selector — however hex-shaped,
		 * at any `@media`/`@supports`/`@container` nesting depth — and a `url()`
		 * fragment reference are never even visited as a colour, by construction; a
		 * quoted string's content (a comment-open delimiter, a hex-shaped word) is
		 * masked from the scan entirely; `light-dark()` with only variables (or
		 * `currentColor`) is the theme-correct pattern and must not be refused; and
		 * `--accent: red;` documents the one residual this project has decided not to
		 * chase (D4 in the task report): a named colour is caught on a typed property
		 * but not inside a raw token stream, where only a literal hex or function call
		 * is still recognised generically (`--accent: #fff;`, refused above); and
		 * `device-cmyk()` gets the same variable and zero-alpha exemptions every other
		 * colour type gets automatically, applied by hand since its arguments never
		 * resolve into the typed shape those exemptions normally read off of.
		 */
		it.each([
			['an Obsidian CSS variable', '.one { color: var(--text-normal); }'],
			['currentColor', '.one { border-color: currentColor; }'],
			['transparent, spelled as the keyword', '.one { background: transparent; }'],
			['inherit', '.one { color: inherit; }'],
			['a colour inside a comment', '/* was #fff, now themed */\n.one { color: var(--text-normal); }'],
			['a hex-shaped ID selector', '#dad { margin: 0; }'],
			['a hyphenated hex-shaped ID selector', '#face-plate { color: var(--text-normal); }'],
			['a url() fragment reference on a hex-shaped selector', '#fade { filter: url(#fade); }'],
			['a url() fragment reference inside a declaration value', '.icon { filter: url(#feed); }'],
			['an 8-digit url() fragment reference in a declaration value', '.one { background: url(#deadbeef-icon); }'],
			['a 5-digit run, which is not a valid hex colour', '.one { color: #12345; }'],
			['a 7-digit run, which is not a valid hex colour', '.one { color: #1234567; }'],
			['a hex-shaped selector nested inside an at-rule', '@media (width > 1px) { #fade { margin: 0; } }'],
			['a hex-shaped word inside a quoted content string', '.x { content: "#fff"; }'],
			[
				'a custom property merely named after the colour function',
				'.one { --my-color: var(--text-normal); --color-scheme: dark; }',
			],
			['an escaped close-paren inside a url()', '.x { filter: url(icon\\)#fade); }'],
			['a color-mix() whose arguments are both Obsidian variables', '.x { color: color-mix(in srgb, var(--a) 50%, var(--b) 50%); }'],
			['an explicit rgba() with alpha 0, the same as the keyword', '.x { background: rgba(0, 0, 0, 0); }'],
			['a CSS system-colour keyword', '.x { color: Canvas; }'],
			['light-dark(currentColor, currentColor)', '.x { color: light-dark(currentColor, currentColor); }'],
			[
				'light-dark() with two Obsidian variables, the theme-correct pattern',
				'.x { color: light-dark(var(--text-normal), var(--text-normal)); }',
			],
			['a real comment, unaffected by string-awareness', '.x { /* color: #fff; */ margin: 0; }'],
			[
				'an @property initial-value that is an Obsidian variable',
				'@property --accent {\n\tsyntax: "<color>";\n\tinherits: false;\n\tinitial-value: currentColor;\n}',
			],
			['a named colour inside a custom property, unlike a hex literal', '.x { --accent: red; }'],
			[
				'device-cmyk() whose arguments are all Obsidian variables, the same exemption rgb(var(...)) already gets',
				'.b { color: device-cmyk(var(--c) var(--m) var(--y) var(--k)); }',
			],
			[
				'device-cmyk() with a literal zero alpha, the same exemption rgba(0, 0, 0, 0) already gets',
				'.c { color: device-cmyk(0% 81% 81% 30% / 0); }',
			],
		])('does not flag %s', (_label, css) => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': `${css}\n`,
			});

			expect(() => assembleStyles()).not.toThrow();
		});
	});
});


/**
 * Every `@container <name>` query in the SHIPPED sheet names a container the shipped sheet also
 * declares.
 *
 * **This class has now shipped twice on one branch, three files apart.** `styles/asset-shelf.css`
 * lines 259-269 record `@container rp-al-shelves` rules being inert because only a PROTOTYPE's
 * scoped block declared that container, name the task that fixed it, and close with "a comment
 * that names its trigger is a comment nothing re-reads when the trigger fires". Task 14 then
 * ported two `@container rp-al` blocks out of a prototype whose own scoped block declared `rp-al`,
 * into a sheet where nothing did — and the ported comment asserted the container WAS declared.
 * `Back to library` was `display: none` at every width, which also removes it from the tab order.
 *
 * Nothing else here can see it: `assembleStyles` checks colour literals and the line cap, jsdom
 * lays nothing out, and a `@container` naming no container simply never matches — no error, no
 * warning, no visible difference from a rule whose condition is false. A capture read by eye is
 * the only other instrument, and none had been taken.
 *
 * A rule rather than a list, so it holds for the next partial: the two regexes are asserted to
 * still match before the comparison is trusted, because a name regex that stopped matching would
 * compare an empty set against anything and pass.
 *
 * **COMMENTS ARE STRIPPED FIRST, and the first version of this case did not strip them.**
 * Measured: deleting the real `container: rp-al / inline-size` declaration left this file GREEN,
 * because the paragraph explaining that declaration QUOTES it four lines above — an instrument
 * written inside the text it measures counting itself, which is the shape CLAUDE.md records
 * against a self-matching grep. It reddens now, which is what makes it a check.
 */
describe('the shipped stylesheet\'s container queries', () => {
	const sheet = assembleStyles().replace(/\/\*[\s\S]*?\*\//g, '');
	const queried = new Set(
		[...sheet.matchAll(/@container\s+([A-Za-z_][\w-]*)\s*\(/g)].map(([, name]) => name),
	);
	// `container: <name> / <type>` and the longhand `container-name: <name>` alike — the shorthand
	// is what this repository writes and the longhand is what the next author may.
	const declared = new Set([
		...[...sheet.matchAll(/container:\s*([A-Za-z_][\w-]*)\s*\//g)].map(([, name]) => name),
		...[...sheet.matchAll(/container-name:\s*([A-Za-z_][\w-]*)/g)].map(([, name]) => name),
	]);

	it('is measured by regexes that still match', () => {
		expect(queried.size).toBeGreaterThan(0);
		expect(declared.size).toBeGreaterThan(0);
	});

	it('queries no container the sheet does not declare', () => {
		expect([...queried].filter((name) => !declared.has(name))).toEqual([]);
	});
});

/**
 * §7's responsive table, pinned at the two boxes it actually measures — Task 15's own job on
 * this file, over what Task 12 and Task 14's fix round already shipped.
 *
 * TWO LADDERS, TWO CONTAINERS, and this is what proves neither collapsed into the other.
 * `rp-al-shelves` (`styles/asset-shelf.css`) drops the row's own supplier slot below 40rem and
 * its waste slot below 32.5rem, measuring the SHELVES REGION per §3.3's own row table (spec
 * lines 305-306: 640px / 520px). `rp-al` (`styles/asset-library-inspector.css`,
 * `styles/asset-library.css`) narrows the inspector rail below 45rem and collapses it to a
 * single pane below 35rem, measuring the PANE per §7's own table (720px / 560px). A regression
 * that quietly renamed one ladder's rem value to the other's — an easy slip, since both pairs
 * are "the same two numbers" in a loose reading — would pass every other check here: the
 * no-orphan-container case above only asks that a queried name is DECLARED somewhere, never at
 * what width, and jsdom lays nothing out to notice a wrong breakpoint either.
 *
 * **The brief for this task quoted `(max-width: 720px)` for this ladder, and that syntax
 * appears nowhere in the shipped sheet.** Task 12 and Task 14 both wrote lightningcss's RANGE
 * syntax instead (`width < 45rem`), so this pins what actually ships rather than the stale
 * pseudocode — the same "substitute throughout" the brief already says about the class names in
 * its own remaining text.
 *
 * The two ladders are NOT required to line up numerically once the rail is subtracted from the
 * pane — see this task's own report for the arithmetic and why the spec's §7 prose narrative
 * ("the row drops its supplier slot, then its waste slot" inside the 560-720px rung) describes
 * intent rather than a bit-for-bit claim this test could hold. What this case pins is only that
 * each ladder's own four numbers are the ones its own spec section names, on the container that
 * section actually measures.
 */
describe('§7 and §3.3\'s two width ladders', () => {
	const sheet = assembleStyles().replace(/\/\*[\s\S]*?\*\//g, '');

	it('is measured by a regex that still matches', () => {
		expect(sheet).toMatch(/@container\s+rp-al\s*\(/);
		expect(sheet).toMatch(/@container\s+rp-al-shelves\s*\(/);
	});

	it('narrows the rail at 45rem (720px) and collapses it at 35rem (560px), on the PANE container', () => {
		expect(sheet).toMatch(/@container\s+rp-al\s*\(width\s*<\s*45rem\)/);
		expect(sheet).toMatch(/@container\s+rp-al\s*\(width\s*<\s*35rem\)/);
	});

	it('drops the supplier slot at 40rem (640px) and the waste slot at 32.5rem (520px), on the SHELVES container', () => {
		expect(sheet).toMatch(/@container\s+rp-al-shelves\s*\(width\s*<\s*40rem\)/);
		expect(sheet).toMatch(/@container\s+rp-al-shelves\s*\(width\s*<\s*32\.5rem\)/);
	});

	/**
	 * §3.3: "a row is a flattened `<button>` … selected UNDER its block class
	 * (`.rp-al-shelf .rp-al-row`)". A bare `.rp-al-row` would still pass every other gate here —
	 * `buttonSpecificity.test.ts` reads whatever selector actually ships rather than demanding
	 * this exact one — so this is a narrower, direct pin of the one shape the spec names by text.
	 */
	it('declares a rule the row\'s emitted class can match, under its block', () => {
		expect(sheet).toContain('.rp-al-shelf .rp-al-row');
	});

	/**
	 * §7's THIRD rung's other half — "selecting a row replaces the shelves with the inspector in
	 * full" — which `styles/asset-library.css`'s own comment says lives in the SHELL rather than
	 * in the rail's own partial (`styles/asset-library-inspector.css` carries a SECOND, unrelated
	 * `rp-al (width < 35rem)` block of its own, which is why this asks for the selector directly
	 * inside the opening brace rather than merely somewhere in the sheet — a lazy `[\s\S]*?` scan
	 * to the next bare `}` would stop at the first NESTED rule's own close and could match either
	 * block, or neither, depending on which one the concatenation puts first).
	 *
	 * A TEXT pin rather than a behavioural one: jsdom lays nothing out and the container has no
	 * pinned Chromium, so this is the one thing a gate here can hold — that the selector EXISTS
	 * inside the narrow-composition rung, never that it actually hides anything on screen. Driven
	 * directly rather than trusted: deleting the rule, or widening it to `[data-selected-asset-id]`
	 * alone (which would hide the shelves with NOTHING selected too, since the attribute is `''`
	 * rather than absent per §6.3), both stop this pattern matching.
	 */
	it('hides the shelves region in the narrow composition once something is selected', () => {
		expect(sheet).toMatch(
			/@container\s+rp-al\s*\(width\s*<\s*35rem\)\s*\{\s*\.renovation-asset-library\[data-selected-asset-id\]:not\(\[data-selected-asset-id=(['"])\1\]\)\s+\.rp-al-body\s*\{\s*display:\s*none;/u,
		);
	});
});
