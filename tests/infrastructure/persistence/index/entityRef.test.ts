import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { entityRefOf } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';

describe('entityRefOf', () => {
	it('answers the declared type and id for a note of ours', () => {
		expect(entityRefOf({ type: 'renovation-zone', id: 'z1' })).toEqual({
			kind: 'ours',
			type: 'renovation-zone',
			id: 'z1',
		});
	});

	it('answers not-ours for empty frontmatter', () => {
		expect(entityRefOf({})).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a type this plugin does not own', () => {
		expect(entityRefOf({ type: 'daily-note', id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a non-string type', () => {
		expect(entityRefOf({ type: 7, id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('distinguishes ours-but-idless from not-ours, because only one is a diagnostic', () => {
		expect(entityRefOf({ type: 'renovation-plan' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: '' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: 42 })).toEqual({ kind: 'no-id' });
	});
});

/**
 * The claim is "one function answers this, and exactly two callers ask it". A docblock
 * saying so is worth nothing without the measurement, so the measurement is the test.
 *
 * The instrument's blind spot, stated rather than implied: this reads source TEXT, so a
 * call reached through a re-export under another name is invisible to it. Nothing
 * re-exports this module today.
 */
function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [path] : [];
	});
}

describe('entityRefOf callers', () => {
	it('is named by exactly two modules in src/, and they are the scan and the pipeline', () => {
		const naming = sourceFilesUnder('src').filter((path) =>
			readFileSync(path, 'utf8').includes('entityRefOf'),
		);
		expect(naming.map((path) => path.replaceAll('\\', '/')).toSorted()).toEqual([
			'src/infrastructure/persistence/index/VaultChangeAdapter.ts',
			'src/infrastructure/persistence/index/buildProjectIndexEntries.ts',
		]);
	});
});
