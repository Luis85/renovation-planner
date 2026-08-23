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

		it('refuses an rgb() colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: rgb(0, 0, 0); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses an rgba() colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: rgba(0, 0, 0, 0.5); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses an hsl() colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: hsl(0, 0%, 0%); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses an hsla() colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: hsla(0, 0%, 0%, 0.5); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('accepts an Obsidian CSS variable', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: var(--text-normal); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// currentColor, transparent and inherit are not palettes — none of them is a hex,
		// rgb()/rgba() or hsl()/hsla() spelling, so the check never matches them at all.
		it('accepts currentColor', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { border-color: currentColor; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('accepts transparent', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { background: transparent; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('accepts inherit', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: inherit; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// A colour mentioned inside a CSS comment is not shipped as a rule — the check
		// strips comments before scanning, the same way the entry-file parser above does.
		it('ignores a colour inside a comment', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '/* was #fff, now themed */\n.one { color: var(--text-normal); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		/**
		 * The bare word `red` and the hex `#ff0000` become the SAME parsed `CssColor`
		 * node — lightningcss does not keep the keyword spelling any more than it keeps
		 * `#f00`'s. Earlier, string-scanning rounds of this gate excluded named colours
		 * on purpose: a bare word cannot be told apart from a class name or a
		 * custom-property name without parsing the declaration it sits in. A real parser
		 * removes exactly that ambiguity — `Declaration.value` only ever holds a
		 * `CssColor` node when the CSS value grammar put one there, never a selector or a
		 * property name — so this is not a new feature bolted on, it is the same check
		 * losing a caveat it no longer needs.
		 */
		it('refuses a CSS named colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: red; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		/**
		 * A selector is never a colour, however hex-shaped its name reads: `#fade`, `#dad`
		 * and `#face-plate` are ID selectors, not colours, and every letter of `fade`,
		 * `dad`, `face`, `cab`, `bad`, `beef`, `cafe` and `ace` is a valid hex digit. This
		 * is no longer a scan the check has to steer around: `lightningcss` parses a
		 * selector into a `SelectorList`, structurally separate from a declaration's
		 * VALUE, and this check only ever calls `findHardcodedColor` on the latter — a
		 * selector is never visited at all, regardless of nesting depth under `@media` /
		 * `@supports` / `@container`. `url(#fade)` is the same story one level in: the
		 * parser gives it `type: 'url'`, never the `CssColor` shape this check matches, so
		 * a fragment reference is not a colour by construction, not by an exemption this
		 * check has to remember to apply. This project forbids inline suppressions, so a
		 * false positive here has no escape hatch except editing this shared script under
		 * pressure — these are regression tests, not exploratory ones.
		 */
		it('does not flag a hex-shaped ID selector', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '#dad { margin: 0; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag a hyphenated hex-shaped ID selector', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '#face-plate { color: var(--text-normal); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag a url() fragment reference on a hex-shaped selector', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '#fade { filter: url(#fade); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag a url() fragment reference inside a declaration value', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.icon { filter: url(#feed); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag an 8-digit url() fragment reference in a declaration value', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { background: url(#deadbeef-icon); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// A real hex colour immediately followed by punctuation (not another identifier
		// character, and not inside a url() call, and not in selector position) is still
		// caught — the exemptions above narrow what the check looks at, they do not remove
		// the check.
		it('still refuses a hex colour immediately followed by a semicolon', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one{color:#fff;}\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		// Valid CSS hex colours are exactly 3, 4, 6 or 8 digits (RGB, RGBA, RRGGBB,
		// RRGGBBAA) — 5 and 7 are not a spelling this pattern claims to see, and matching
		// them anyway would be the pattern promising more than the comment above it says.
		it('does not flag a 5-digit run, which is not a valid hex colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: #12345; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag a 7-digit run, which is not a valid hex colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: #1234567; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// A Windows editor can save a PARTIAL with CRLF before .gitattributes ever sees
		// it, the same risk the entry-file CRLF test above guards against. The colour
		// check splits on '\n' the same way assembleStyles does for the entry file, which
		// leaves a trailing '\r' on each line — this pins that a hard-coded colour is
		// still caught rather than trusted to argument alone.
		it('refuses a hard-coded colour in a CRLF-saved partial', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one {\r\n\tcolor: #fff;\r\n}\r\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		/**
		 * Finding A: a selector nested inside an at-rule (`@media`, `@supports`,
		 * `@container`) sits at brace depth >= 1 same as a declaration does — depth alone
		 * cannot tell them apart. `#fade` here is a selector regardless of how many
		 * blocks it sits inside, and must stay unscanned; the declaration nested one
		 * level deeper than IT must still be scanned.
		 */
		it('does not flag a hex-shaped selector nested inside an at-rule', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@media (width > 1px) { #fade { margin: 0; } }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('still refuses a hard-coded colour nested inside an at-rule', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '@media (width > 1px) { .x { color: #fff; } }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		/**
		 * Finding B: a `}` (or `{`) inside a quoted CSS string is literal text, not
		 * structure. The old depth counter read the quoted `"}"` as closing the block
		 * early, so `color: #fff` that followed looked like it sat outside any block and
		 * was silently skipped — a false NEGATIVE, worse than any false positive: the
		 * gate stayed green while `styles/view.css`'s own comment ("every colour comes
		 * from an Obsidian variable") went false underneath it.
		 */
		it('still refuses a colour after a quoted closing brace in the same block', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { content: "}"; color: #fff; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('still refuses a colour after a quoted opening brace in the same block', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { content: "{"; color: #fff; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		// A colour is never legitimately written as a quoted string — `content: "#fff";`
		// sets literal label text, not a palette value — so the quoted text is masked out
		// of the scan entirely, the same fix that makes the two tests above correct.
		it('does not flag a hex-shaped word inside a quoted content string', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { content: "#fff"; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		/**
		 * Finding C: the function list only named `rgb`/`rgba`/`hsl`/`hsla`. Every other
		 * CSS Color function — `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`
		 * — is exactly as hard-coded a palette value and passed the gate untouched.
		 */
		it.each([
			['hwb', 'background: hwb(200 30% 20%);'],
			['lab', 'color: lab(50% 20 -30);'],
			['lch', 'color: lch(50% 40 30);'],
			['oklab', 'color: oklab(0.5 0.1 -0.1);'],
			['oklch', 'color: oklch(60% 0.2 30);'],
			['color()', 'color: color(display-p3 1 0 0);'],
		])('refuses a hard-coded %s() colour', (_name, declaration) => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': `.one { ${declaration} }\n`,
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		// The trap `color(` sets: `color` is both a CSS PROPERTY and, spelled with a
		// trailing `(`, a colour FUNCTION. `\bcolor\(` requires the immediate `(` a
		// property name never has (`color:` is followed by `:`), so the property itself,
		// and a custom property merely named after it, must both still pass.
		it('does not flag the color PROPERTY assigned an Obsidian variable', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: var(--text-normal); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag a custom property merely named after the colour function', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { --my-color: var(--text-normal); --color-scheme: dark; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		/**
		 * Six bypasses were found across four rounds of hand-rolled string scanning, all
		 * defeated content that LOOKED like syntax to a scan that could not actually
		 * parse it: an at-rule-nested selector, a quoted brace, a modern colour function
		 * missing from a word list, a `/*` inside a string bridging to a real comment
		 * (two variants), a colour function (`device-cmyk()`) still missing from the
		 * word list, and an escaped `)` inside `url()`. This project's own rule — an
		 * invariant gets a test that fails without it — applies here at the scale of the
		 * whole approach: `scripts/styles-assemble.mjs` now runs `lightningcss` instead
		 * of scanning source text at all, and every case below is regression coverage
		 * for one of the six, run against the real parser rather than patched string
		 * logic.
		 */
		it('refuses a colour bridged by a string containing a comment-open delimiter', () => {
			// Bypass 1: withoutComments() ran before any quote awareness, so `/*` inside
			// this string paired with a LATER real `*/` and swallowed `color: #fff;`.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { content: "/*"; color: #fff; content: "*/"; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses a colour after a stray comment-open string bridges into a later rule', () => {
			// Bypass 2 (variant): the stray `/*` need not close in the SAME rule — any
			// real `*/` anywhere later in the file, even a genuine trailing comment on an
			// unrelated rule, closed the false comment and hid everything between.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.a { content: "oops /*"; }\n.b { color: #fff; } /* trailing */\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('reports a clear parse failure for an unterminated string, rather than silently masking what follows it', () => {
			// Bypass 3: a string that never closes is not a scanning edge case to a real
			// parser — CSS terminates a string at a bare newline (a "bad string" token)
			// — so lightningcss throws, and this project's own rule ("a parse error must
			// be reported clearly, not swallowed") is what turns that into a named build
			// failure instead of a silently-passed partial.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.a { content: "oops\ncolor: #fff;\n}\n.b { color: green; }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('still passes a real comment, unaffected by string-awareness', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { /* color: #fff; */ margin: 0; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('refuses device-cmyk(), the one colour function lightningcss leaves unresolved', () => {
			// Bypass 5 (this round's report numbering): the closed-list residual this
			// project documented and expected to keep growing. With a real parser, it is
			// a list of one function, not an open-ended word list to maintain.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: device-cmyk(0% 81% 81% 30%); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('does not flag an escaped close-paren inside a url()', () => {
			// Bypass 6: `\)` is part of the URL per CSS's own escaping rules, so
			// `#fade` here is never a separate token at all — a regex stopping at the
			// raw `)` character does not know that; a conformant parser always does.
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { filter: url(icon\\)#fade); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// Backs the code comment's claim: a colour ARGUMENT inside an otherwise
		// unresolved function call still surfaces as a real `CssColor` node, because
		// lightningcss recognises a colour literal generically wherever one appears —
		// not only on properties or functions it fully understands.
		it('refuses a literal colour argument inside an unresolved function call', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: color-contrast(#fff vs #000, #ccc); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses the computed result of a literal-only color-mix()', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: color-mix(in srgb, #fff 50%, #000 50%); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('does not flag a color-mix() whose arguments are both Obsidian variables', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: color-mix(in srgb, var(--a) 50%, var(--b) 50%); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// `transparent` earns its exemption a different way than `currentColor` does:
		// lightningcss does not keep the keyword spelling, resolving it to `rgb(0 0 0 /
		// 0)` like any equivalent literal — so the exemption generalises to alpha 0 on
		// ANY colour type, not only that one keyword.
		it('does not flag transparent, spelled as the keyword', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { background: transparent; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('does not flag an explicit rgba() with alpha 0, the same as the keyword', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { background: rgba(0, 0, 0, 0); }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		// A CSS system-colour keyword (`Canvas`, `ButtonText`, …) adapts to the OS/browser
		// colour scheme rather than encoding a fixed palette value, the same reasoning
		// `currentColor` is exempt for — and it parses to a bare STRING, never the object
		// shape this check matches, so no exemption code exists for it at all.
		it('does not flag a CSS system-colour keyword', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: Canvas; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});

		it('refuses a hard-coded colour nested inside a gradient colour-stop', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { background: linear-gradient(#fff, blue); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});

		it('refuses a hard-coded colour used as a var() fallback', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.x { color: var(--missing, #fff); }\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css/);
		});
	});
});
