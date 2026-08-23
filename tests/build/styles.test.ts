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
			'one.css': '.one { color: red; }\n',
			'two.css': '.two { color: blue; }\n',
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
			'big.css': '.a { color: red; }\n'.repeat(400),
		});

		expect(() => assembleStyles()).not.toThrow();
	});

	// `[\w.]` does not contain '-'. A regex that cannot see a hyphenated name reports the
	// file as unimported — a false failure whose message blames the entry file.
	it('assembles a hyphenated partial', () => {
		plant({
			'index.css': '@import "./work-package.css";\n',
			'work-package.css': '.wp { color: red; }\n',
		});

		expect(assembleStyles()).toContain('.wp');
	});

	// A Windows editor can save the entry file with CRLF before .gitattributes ever sees
	// it; `$` in a multiline regex matches before \n, not before \r.
	it('assembles a CRLF-saved entry file', () => {
		plant({
			'index.css': '@import "./one.css";\r\n',
			'one.css': '.one { color: red; }\n',
		});

		expect(assembleStyles()).toContain('.one');
	});

	it('tolerates comments in the entry file', () => {
		plant({
			'index.css': '/* order is load-bearing */\n@import "./one.css"; /* first */\n',
			'one.css': '.one { color: red; }\n',
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
	 * other one (SDD §84). The check sees hex, `rgb()`/`rgba()` and `hsl()`/`hsla()` — the
	 * spellings a string scan can find without a CSS parser this project has decided not
	 * to add. CSS named colours are a deliberate scope decision, not an oversight: see the
	 * 'does not flag a CSS named colour' test below for why.
	 */
	describe('hard-coded colours', () => {
		it('refuses a hex colour, naming the file and the line', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one {\n\tcolor: #fff;\n}\n',
			});

			expect(() => assembleStyles()).toThrow(/one\.css:2/);
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

		// A larger and more ambiguous set than hex/rgb()/hsl(): a bare word like `red` or
		// `tan` cannot be told apart from a class name, a custom-property name or plain
		// prose without parsing the declaration it sits in, and this project has decided
		// not to add a CSS parser for one check. Excluded deliberately, not missed.
		it('does not flag a CSS named colour', () => {
			plant({
				'index.css': '@import "./one.css";\n',
				'one.css': '.one { color: red; }\n',
			});

			expect(() => assembleStyles()).not.toThrow();
		});
	});
});
