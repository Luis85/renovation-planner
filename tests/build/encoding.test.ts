import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No tracked text file starts with a UTF-8 BOM.
 *
 * The failure is real and was measured here: PowerShell 5.1's `Set-Content -Encoding
 * utf8` writes a BOM, `JSON.parse` refuses a BOM'd document, and the first victim was
 * `manifest.json` — eslint-plugin-obsidianmd reads it at config-load time, so ONE stray
 * byte order mark broke every `npm run lint` with an error pointing nowhere near the
 * cause. A BOM inside a styles partial would likewise land mid-sheet in the assembled
 * output. `.editorconfig` asks editors for plain utf-8; this is the check under that ask,
 * because a shell redirect never reads `.editorconfig`.
 */

const BOM = '﻿';

// Directories that hold tracked text files, walked recursively; extensions the tools
// here actually parse. Generated and vendored trees are not this test's problem.
const ROOTS = ['src', 'tests', 'scripts', 'styles', 'docs', '.github'];
const EXTENSIONS = new Set(['.ts', '.mts', '.mjs', '.js', '.json', '.css', '.yml', '.yaml', '.md', '.base', '.html']);

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) return walk(file);
		return EXTENSIONS.has(path.extname(name)) ? [file] : [];
	});
}

describe('file encoding', () => {
	const files = [
		// The arrow is load-bearing: `flatMap(walk)` hands the callback the index and the
		// array as well, which is the shape that makes `['1','2','3'].map(parseInt)`
		// return `[1, NaN, NaN]`. Harmless while `walk` ignores them, and one signature
		// change from not being.
		...ROOTS.flatMap((root) => walk(root)),
		...readdirSync('.').filter((name) => statSync(name).isFile() && EXTENSIONS.has(path.extname(name))),
	];

	// The instrument, tested first: an empty file list would pass every assertion below
	// by asserting nothing.
	it('sees the tree it claims to guard', () => {
		expect(files.length).toBeGreaterThan(30);
		expect(files).toContain(path.join('manifest.json'));
		expect(files).toContain(path.join('styles', 'index.css'));
	});

	it('finds no UTF-8 BOM in any tracked text file', () => {
		const bommed = files.filter((file) => readFileSync(file, 'utf8').startsWith(BOM));

		expect(bommed).toEqual([]);
	});
});
