// @vitest-environment node
// (the FIRST directive in this file, on purpose: the fixtures below spell the keyword in
// strings, and vitest reads the whole text — see the helper's header.)
import { describe, expect, it } from 'vitest';
import { declaredEnvironment } from './environmentDirective';

/**
 * The directive reader against vitest's own rule. Every expected value below was computed by
 * applying vitest's regex (`/@(?:vitest|jest)-environment\s+([\w-]+)\b/`, `detectCodeBlock`) to
 * the same text, in a scratch run outside this suite — the regex is not exported and is not
 * repeated here, since a gate that carried it would be a regex over source text. The first five
 * cases are the shapes the comments-only reader this replaced got WRONG, watched red against it:
 * three it missed (read by vitest, invisible to a comment walk) and two it misread (a clean
 * file reddened).
 */
describe('the environment directive, read as vitest reads it', () => {
	it('is read out of a string literal, which a comment walk never sees', () => {
		expect(declaredEnvironment("const note = '@vitest-environment jsdom';")).toBe('jsdom');
	});

	it('takes a template literal ahead of a later comment directive, first hit wins', () => {
		expect(declaredEnvironment('const s = `@vitest-environment happy-dom`;\n// @vitest-environment jsdom\n')).toBe('happy-dom');
	});

	it('is read through backtick-quoted prose inside a comment', () => {
		expect(declaredEnvironment('// see `@vitest-environment jsdom` for the knob\n')).toBe('jsdom');
	});

	it('stops at a block-comment terminator glued to the value', () => {
		expect(declaredEnvironment('/* @vitest-environment node*/\n')).toBe('node');
	});

	it('answers nothing for a docblock whose value sits on the next line, as vitest does', () => {
		expect(declaredEnvironment('/**\n * @vitest-environment\n * jsdom\n */\n')).toBeUndefined();
	});

	it('reads the two ordinary spellings', () => {
		expect(declaredEnvironment('// @vitest-environment jsdom\nimport x from "y";')).toBe('jsdom');
		expect(declaredEnvironment('/**\n * @jest-environment jsdom\n */\n')).toBe('jsdom');
	});

	it('takes the earlier of the two keywords', () => {
		expect(declaredEnvironment('// @jest-environment node\n// @vitest-environment jsdom\n')).toBe('node');
	});

	it('skips an occurrence the pattern does not hold at and tries the next', () => {
		// `-options` is not whitespace, so the first keyword is no match; a keyword followed by
		// hyphens alone has no word character for the boundary to sit after. The `-options`
		// spelling is concatenated at runtime because vitest reads THIS file's text too, and its
		// `@vitest-environment-options` regex would `JSON.parse` whatever follows on the line.
		expect(declaredEnvironment(['// @vitest-environment', '-options {}\n// @vitest-environment jsdom\n'].join(''))).toBe('jsdom');
		expect(declaredEnvironment('// @vitest-environment --\n// @vitest-environment jsdom\n')).toBe('jsdom');
		expect(declaredEnvironment('// @vitest-environment\n')).toBeUndefined();
	});

	it('gives back trailing hyphens, as the word boundary makes the regex do', () => {
		expect(declaredEnvironment('// @vitest-environment jsdom-- rest\n')).toBe('jsdom');
		expect(declaredEnvironment('// @vitest-environment happy-dom\n')).toBe('happy-dom');
	});

	it('accepts any JavaScript whitespace between the keyword and the value', () => {
		expect(declaredEnvironment('// @vitest-environment\t jsdom\n')).toBe('jsdom');
	});

	it('answers nothing for a file with no directive', () => {
		expect(declaredEnvironment("import x from 'y';\n")).toBeUndefined();
	});
});
