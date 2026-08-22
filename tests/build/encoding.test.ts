import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * No file git can see starts with a UTF-8 BOM.
 *
 * The failure is real and was measured here: PowerShell 5.1's `Set-Content -Encoding
 * utf8` writes a BOM, `JSON.parse` refuses a BOM'd document, and the first victim was
 * `manifest.json` — eslint-plugin-obsidianmd reads it at config-load time, so ONE stray
 * byte order mark broke every `npm run lint` with an error pointing nowhere near the
 * cause. A BOM inside a styles partial would likewise land mid-sheet in the assembled
 * output. `.editorconfig` asks editors for plain utf-8; this is the check under that ask,
 * because a shell redirect never reads `.editorconfig`.
 *
 * The set under measurement is git's, not a hand-listed tree: `git ls-files` with
 * `--others --exclude-standard` yields exactly the files a commit could carry — every
 * extension and every future directory included, and NO gitignored scratch file, which a
 * directory walk would fail the suite on even though it can never reach a commit. Only
 * the first bytes are read; a BOM anywhere else is not this test's subject.
 */

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function startsWithBom(file: string): boolean {
	const fd = openSync(file, 'r');
	try {
		const head = Buffer.alloc(3);
		const got = readSync(fd, head, 0, 3, 0);
		return got === 3 && head.equals(BOM);
	} finally {
		closeSync(fd);
	}
}

describe('file encoding', () => {
	// `existsSync` because `--cached` also lists a tracked file DELETED from the working
	// tree (a staged or pending delete) — that is version control's business, not an
	// encoding subject, and opening it would fail the suite on a missing file.
	const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
		.split('\n')
		.filter((line) => line !== '' && existsSync(line));

	// The instrument, tested first: an empty file list would pass the assertion below by
	// asserting nothing.
	it('sees the tree it claims to guard', () => {
		expect(files.length).toBeGreaterThan(30);
		expect(files).toContain('manifest.json');
		expect(files).toContain('styles/index.css');
	});

	it('finds no UTF-8 BOM in any file git sees', () => {
		expect(files.filter((file) => startsWithBom(file))).toEqual([]);
	});
});
