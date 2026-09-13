/**
 * The `@vitest-environment` / `@jest-environment` directive, read EXACTLY the way vitest reads
 * it. Vitest's `detectCodeBlock` (in `vitest/dist/chunks/cli-api.*.js`, not exported) applies
 * `/@(?:vitest|jest)-environment\s+([\w-]+)\b/` to the WHOLE file text — comments, strings and
 * prose alike — and takes the first match, falling back to the project's `environment` when
 * there is none. This is that rule spelled without a pattern, because
 * `tests/build/test-environments.test.ts` compares its answer against what vitest resolves, and
 * a reader that disagrees with vitest is a gate that misses an offender or reddens a clean file.
 *
 * The version this replaced read only the file's COMMENT ranges and split them on whitespace,
 * and it disagreed with vitest in both directions: a directive inside a string or template
 * literal, or wrapped in backticks inside a comment, is read by vitest and was invisible to it
 * (an offender missed); a block comment closing right after the value (`node` then the `*` and
 * `/` of the terminator, no space) read as the value with the terminator glued on, and a docblock
 * with the value on the next line read as `*` (a clean file reddened). `environmentDirective.test.ts`
 * carries each of those as a fixture whose expected value was computed with vitest's own regex.
 *
 * What each piece of the regex means here, so the mirror can be checked against it: the keyword
 * is found by `indexOf`, both spellings, earliest first; `\s+` is at least one JavaScript
 * whitespace character (`\s` in a non-unicode regex is the set `isSpace` lists); `[\w-]+` is a
 * run of ASCII letters, digits, `_` and `-`; and the trailing `\b` makes the engine give back
 * trailing hyphens until the value ends in a word character — a run of hyphens alone is no
 * match. An occurrence that fails any of those is skipped and the NEXT occurrence is tried,
 * which is what "first match" means for a regex: the first position where the whole pattern
 * holds, not the first place the keyword appears.
 */
const KEYWORDS = ['@vitest-environment', '@jest-environment'] as const;

/** `\s` of a JavaScript regex without the `u` flag: ECMAScript WhiteSpace plus LineTerminator. */
const isSpace = (code: number): boolean =>
	code === 0x20 ||
	(code >= 0x09 && code <= 0x0d) ||
	code === 0xa0 ||
	code === 0x1680 ||
	(code >= 0x2000 && code <= 0x200a) ||
	code === 0x2028 ||
	code === 0x2029 ||
	code === 0x202f ||
	code === 0x205f ||
	code === 0x3000 ||
	code === 0xfeff;

/** `\w`: ASCII letters, digits and underscore. */
const isWord = (code: number): boolean =>
	(code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f;

const HYPHEN = 0x2d;

/** The earliest keyword occurrence at or after `from`, or `null`. */
function nextKeyword(source: string, from: number): { index: number; length: number } | null {
	let found: { index: number; length: number } | null = null;
	for (const keyword of KEYWORDS) {
		const index = source.indexOf(keyword, from);
		if (index !== -1 && (found === null || index < found.index)) found = { index, length: keyword.length };
	}
	return found;
}

export function declaredEnvironment(source: string): string | undefined {
	for (let hit = nextKeyword(source, 0); hit !== null; hit = nextKeyword(source, hit.index + 1)) {
		let start = hit.index + hit.length;
		const keywordEnd = start;
		while (start < source.length && isSpace(source.charCodeAt(start))) start += 1;
		if (start === keywordEnd) continue;
		let end = start;
		while (end < source.length && (isWord(source.charCodeAt(end)) || source.charCodeAt(end) === HYPHEN)) end += 1;
		while (end > start && source.charCodeAt(end - 1) === HYPHEN) end -= 1;
		if (end === start) continue;
		return source.slice(start, end);
	}
	return undefined;
}
